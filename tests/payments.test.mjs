import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,scryptSync} from 'node:crypto';
import Stripe from 'stripe';
const temp=mkdtempSync(join(tmpdir(),'powerplanet-payments-'));
process.env.DB_PATH=join(temp,'store.sqlite');
process.env.PUBLIC_SITE_URL='http://localhost:3000';
process.env.STRIPE_SECRET_KEY='sk_test_fixture';
process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';
const {app}=await import('../server/app.mjs');
const {db,get,put,all}=await import('../server/db.mjs');
const {checkout,applyStripeEvent,cancelCardOrder}=await import('../server/payments.mjs');
let server,base,cookie;
const fixture={id:'payment-product',name:'Confirmed solar panel',price:12500.25,stock:30,status:'published',minQuantity:2,availability:'in-stock'};
const payload=(extra={})=>({name:'Payment Test',phone:'03001234567',email:'test@example.com',city:'Lahore',address:'House 12, Main Road',paymentMethod:'cod',checkoutKey:randomUUID(),items:[{id:fixture.id,quantity:2}],...extra});
async function request(path,method='GET',body,headers={}){return fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});}
before(async()=>{
  put('products',fixture);
  db.prepare('INSERT INTO admins VALUES(?,?,?)').run('payments@example.com',scryptSync('test-payment-password','salt',64).toString('hex'),'salt');
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}/api`;
  const login=await request('/auth/login','POST',{email:'payments@example.com',password:'test-payment-password'});cookie=login.headers.get('set-cookie').split(';')[0];
});
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});});
test('COD reserves stock, ignores forged price, is idempotent and protects customer/order access',async()=>{
  const data=payload({total:1,paymentStatus:'paid',items:[{id:fixture.id,quantity:2,price:1}]});
  const result=await request('/orders','POST',data);assert.equal(result.status,201);const {order}=await result.json();
  assert.equal(order.total,2500050);assert.equal(order.paymentStatus,'due_on_delivery');assert.equal(get('products',fixture.id).stock,28);
  const again=await (await request('/orders','POST',data)).json();assert.equal(again.order.id,order.id);assert.equal(get('products',fixture.id).stock,28);
  assert.equal((await request(`/orders/${order.id}`)).status,404);
  const visible=await (await request(`/orders/${order.id}`,'GET',null,{Authorization:`Bearer ${data.checkoutKey}`})).json();assert.equal(visible.id,order.id);assert.equal(visible.address,undefined);assert.equal(visible.keyHash,undefined);
  assert.equal((await request('/orders','POST',{...data,address:'Another delivery address'})).status,409);
  assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status:'processing'})).status,401);
  for(const status of ['processing','shipped','delivered'])assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status,paymentStatus:'fake'},{cookie})).status,200);
  assert.equal(get('orders',order.id).paymentStatus,'paid');assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status:'new'},{cookie})).status,409);
});
test('invalid basket and address never create an order or reserve stock',async()=>{
  const count=all('orders').length,stock=get('products',fixture.id).stock;
  for(const patch of [{items:[]},{address:'bad'},{items:[{id:fixture.id,quantity:1}]},{items:[{id:fixture.id,quantity:101}]},{items:[{id:fixture.id,quantity:2},{id:fixture.id,quantity:2}]},{items:[{id:'missing',quantity:2}]}])await assert.rejects(checkout(payload(patch)));
  put('products',{...fixture,status:'draft'});await assert.rejects(checkout(payload()));
  put('products',{...fixture,stock});assert.equal(all('orders').length,count);assert.equal(get('products',fixture.id).stock,stock);
});
test('COD accepts unknown price and unavailable stock, persists contact details, and never invents stock',async()=>{
  const original=get('products',fixture.id);
  try{
    for(const patch of [{price:null},{price:0},{status:'preview'},{availability:'on-request'},{availability:'out-of-stock'}]){
      put('products',{...fixture,...patch,stock:0,minQuantity:1});
      const data=payload({items:[{id:fixture.id,quantity:1}],expectedTotal:0});
      const {order}=await checkout(data);
      assert.equal(order.status,'new');
      assert.equal(order.requiresConfirmation,true);
      assert.equal(order.items[0].reservedQuantity,0);
      assert.equal(get('products',fixture.id).stock,0);
      assert.equal(get('orders',order.id).phone,data.phone);
      if(patch.price===null||patch.price===0||patch.status==='preview')assert.equal(order.total,null);
      assert.equal((await checkout(data)).order.id,order.id);
      assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status:'cancelled'},{cookie})).status,200);
      assert.equal(get('products',fixture.id).stock,0);
    }
  }finally{put('products',original);}
});
test('card checkout still requires a verified price, stock and matching total',async()=>{
  const original=get('products',fixture.id);
  try{
    for(const patch of [{price:0},{price:null},{status:'preview'},{status:'draft'},{stock:0},{availability:'on-request'},{availability:'out-of-stock'}]){
      put('products',{...fixture,...patch});
      await assert.rejects(checkout(payload({paymentMethod:'card'})));
    }
    put('products',fixture);
    await assert.rejects(checkout(payload({paymentMethod:'card',expectedTotal:100})),/prices have changed/);
  }finally{put('products',original);}
});
test('card option stays disabled without configuration',async()=>{
  const secret=process.env.STRIPE_SECRET_KEY;delete process.env.STRIPE_SECRET_KEY;
  assert.equal((await (await request('/payments/config')).json()).card,false);
  await assert.rejects(checkout(payload({paymentMethod:'card'})),/unavailable/);
  process.env.STRIPE_SECRET_KEY=secret;
});
test('COD cancellation releases stock once and cannot reopen cancelled orders',async()=>{
  const stock=get('products',fixture.id).stock;const {order}=await checkout(payload());
  for(let i=0;i<2;i++)assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status:'cancelled'},{cookie})).status,200);
  assert.equal(get('products',fixture.id).stock,stock);assert.equal(get('orders',order.id).paymentStatus,'cancelled');
  assert.equal((await request(`/admin/orders/${order.id}`,'PUT',{status:'processing'},{cookie})).status,409);
});
function mockGateway(onCreate){return ()=>({checkout:{sessions:{create:onCreate}}});}
function sessionFor(order,extra={}){return {id:'cs_test_'+order.id,metadata:{orderId:order.id},client_reference_id:order.id,currency:'pkr',amount_total:order.total,payment_status:'paid',...extra};}
test('card checkout uses server totals and signed webhook is required to mark paid',async()=>{
  const data=payload({paymentMethod:'card'});let params,options;
  const result=await checkout(data,mockGateway(async(p,o)=>{params=p;options=o;return {id:'cs_test_'+p.client_reference_id,url:'https://checkout.stripe.com/test'};}));
  assert.equal(params.line_items[0].price_data.unit_amount,1250025);assert.equal(params.line_items[0].quantity,2);assert.deepEqual(params.payment_method_types,['card']);assert.equal(options.idempotencyKey,result.order.id);assert.match(params.success_url,/localhost:3000\/checkout\?order=/);assert.equal(result.order.paymentStatus,'pending');
  assert.equal((await request(`/admin/orders/${result.order.id}`,'PUT',{status:'processing'},{cookie})).status,409);
  const event={id:'evt_fixture',type:'checkout.session.completed',data:{object:sessionFor(result.order)}};
  assert.equal((await request('/payments/stripe/webhook','POST',event)).status,400);assert.equal(get('orders',result.order.id).paymentStatus,'pending');
  const stripe=new Stripe('sk_test_fixture');const body=JSON.stringify(event);const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
  for(let i=0;i<2;i++){const response=await fetch(base+'/payments/stripe/webhook',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body});assert.equal(response.status,200);}
  assert.equal(get('orders',result.order.id).paymentStatus,'paid');assert.equal(get('orders',result.order.id).status,'new');
  applyStripeEvent({type:'checkout.session.expired',data:{object:sessionFor(result.order)}});assert.equal(get('orders',result.order.id).paymentStatus,'paid');
});
test('wrong amounts/currency/session and unpaid completion cannot mark paid; expiry releases once',async()=>{
  const stock=get('products',fixture.id).stock;
  const {order}=await checkout(payload({paymentMethod:'card'}),mockGateway(async p=>({id:'cs_test_'+p.client_reference_id,url:'https://checkout.stripe.com/test'})));
  for(const patch of [{amount_total:1},{currency:'usd'},{id:'cs_other'}])assert.throws(()=>applyStripeEvent({type:'checkout.session.completed',data:{object:sessionFor(order,patch)}}));
  applyStripeEvent({type:'checkout.session.completed',data:{object:sessionFor(order,{payment_status:'unpaid'})}});assert.equal(get('orders',order.id).paymentStatus,'pending');
  for(let i=0;i<2;i++)applyStripeEvent({type:'checkout.session.expired',data:{object:sessionFor(order,{payment_status:'unpaid'})}});
  assert.equal(get('products',fixture.id).stock,stock);assert.equal(get('orders',order.id).paymentStatus,'expired');
});
test('network timeout retries resume one order with the same provider idempotency key',async()=>{
  const data=payload({paymentMethod:'card'}),stock=get('products',fixture.id).stock;let first;
  await assert.rejects(checkout(data,mockGateway(async(p,o)=>{first=o.idempotencyKey;throw Error('timeout');})),/Retry/);
  const result=await checkout(data,mockGateway(async(p,o)=>{assert.equal(o.idempotencyKey,first);return {id:'cs_test_'+first,url:'https://checkout.stripe.com/test'};}));
  assert.equal(result.order.id,first);assert.equal(get('products',fixture.id).stock,stock-2);
  const session=sessionFor(result.order,{status:'open',payment_status:'unpaid'});
  const gateway=()=>({checkout:{sessions:{retrieve:async()=>session,expire:async()=>({...session,status:'expired'})}}});
  await cancelCardOrder(result.order.id,data.checkoutKey,gateway);assert.equal(get('products',fixture.id).stock,stock);
});
test('definitive gateway rejection releases stock and marks failed',async()=>{
  const stock=get('products',fixture.id).stock;
  await assert.rejects(checkout(payload({paymentMethod:'card'}),mockGateway(async()=>{const error=Error('invalid');error.type='StripeInvalidRequestError';throw error;})),/could not accept/);
  assert.equal(get('products',fixture.id).stock,stock);
});
