import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import nodemailer from 'nodemailer';
const temp=mkdtempSync(join(tmpdir(),'powerplanet-notifications-'));process.env.DB_PATH=join(temp,'store.sqlite');
for(const key of Object.keys(process.env))if(key.startsWith('SMTP_')||key.startsWith('WHATSAPP_')||key==='ORDER_NOTIFICATION_EMAIL')delete process.env[key];
const {db,all,get,put}=await import('../server/db.mjs');
const {checkout,applyStripeEvent}=await import('../server/payments.mjs');
const {enqueueOrderConfirmation,processNotifications,notificationConfig,normalizeWhatsAppPhone,confirmationEmail,createSmtpTransport,sendWhatsApp,retryOrderNotifications}=await import('../server/notifications.mjs');
const product={id:'notify-panel',name:'Solar panel',price:10000,stock:100,status:'published'};put('products',product);
const payload=(extra={})=>({name:'Customer <script>alert(1)</script>',phone:'03001234567',email:'buyer@example.test',city:'Lahore',address:'House 12, Main Road',paymentMethod:'cod',items:[{id:product.id,quantity:1}],checkoutKey:randomUUID(),...extra});
after(()=>{db.close();rmSync(temp,{recursive:true,force:true});});
test('COD confirmation queues transactionally, duplicate requests do not duplicate messages, WhatsApp is opt-in',async()=>{
  const p=payload(),{order}=await checkout(p);await checkout(p);
  assert.equal(all('notifications').filter(n=>n.orderId===order.id).length,1);
  assert.equal(all('notifications').find(n=>n.orderId===order.id).channel,'email');
  const opted=await checkout(payload({whatsappConsent:true}));const jobs=all('notifications').filter(n=>n.orderId===opted.order.id);assert.equal(jobs.length,2);assert.equal(jobs.find(n=>n.channel==='whatsapp').to,'923001234567');
});
test('missing configuration blocks notifications without failing an order or claiming delivery',async()=>{
  let attempts=0;await processNotifications({email:async()=>{attempts++;},whatsapp:async()=>{attempts++;}});
  assert.equal(attempts,0);assert.ok(all('notifications').every(n=>n.status==='blocked'));assert.deepEqual(notificationConfig(),{email:false,whatsapp:false});
});
test('SMTP settings use TLS, confirmations escape HTML and a local SMTP server accepts the email',async()=>{
  process.env.SMTP_HOST='smtp.example.test';process.env.SMTP_FROM='orders@example.test';process.env.SMTP_PORT='587';
  assert.equal(createSmtpTransport().options.requireTLS,true);
  const order=all('orders')[0];const mail=confirmationEmail(order);assert.ok(!mail.html.includes('<script>'));assert.match(mail.html,/&lt;script&gt;/);assert.match(mail.text,/Cash on Delivery/);assert.match(mail.text,/PKR 10,000.00/);
  let received='';
  const smtp=createServer(socket=>{
    socket.setEncoding('utf8');socket.write('220 localhost test SMTP\r\n');let buffer='',data=false;
    socket.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\r\n')){const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);if(data){if(line==='.') {data=false;socket.write('250 Message accepted\r\n');}else received+=line+'\r\n';}else if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 8BITMIME\r\n');else if(/^DATA/.test(line)){data=true;socket.write('354 End with a dot\r\n');}else if(/^QUIT/.test(line)){socket.end('221 Bye\r\n');}else socket.write('250 OK\r\n');}});
  });
  await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));
  const transport=nodemailer.createTransport({host:'127.0.0.1',port:smtp.address().port,secure:false,ignoreTLS:true});
  try{
    retryOrderNotifications(order.id);
    await processNotifications({email:async(job,o)=>{const result=await transport.sendMail({...confirmationEmail(o),from:'orders@example.test',to:job.to});assert.equal(result.accepted.length,1);return {providerId:result.messageId};}});
    assert.match(received,/Order received/);assert.match(received,/buyer@example.test/);
    assert.equal(all('notifications').find(n=>n.orderId===order.id&&n.channel==='email').status,'accepted');
  }finally{transport.close();await new Promise(resolve=>smtp.close(resolve));}
});
test('unknown COD amounts stay unconfirmed in customer notifications',()=>{
  const order={...all('orders')[0],paymentMethod:'cod',total:null,requiresConfirmation:true,items:[{id:'unknown',name:'Solar panel',quantity:1,unitAmount:null}]};
  const mail=confirmationEmail(order);
  assert.match(mail.text,/To be confirmed/);
  assert.match(mail.html,/placed successfully/);
  assert.ok(!mail.text.includes('PKR 0.00'));
});
test('provider failure is retryable and accepted messages are not resent',async()=>{
  const {order}=await checkout(payload());let calls=0;
  await processNotifications({email:async()=>{calls++;throw Error('secret provider error');}});
  const failed=all('notifications').find(n=>n.orderId===order.id);assert.equal(failed.status,'retry');assert.ok(!failed.lastError.includes('secret'));
  retryOrderNotifications(order.id);await processNotifications({email:async()=>{calls++;return {providerId:'test-message'};}});const accepted=all('notifications').find(n=>n.orderId===order.id);assert.equal(accepted.status,'accepted');const before=calls;
  retryOrderNotifications(order.id);await processNotifications({email:async()=>{calls++;return {providerId:'duplicate'};}});assert.equal(calls,before);
});
test('card confirmation is queued only after verified payment and repeated webhook is harmless',async()=>{
  process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';process.env.PUBLIC_SITE_URL='http://localhost:3000';
  const {order}=await checkout(payload({paymentMethod:'card'}),()=>({checkout:{sessions:{create:async p=>({id:'cs_'+p.client_reference_id,url:'https://checkout.stripe.com/test'})}}}));
  assert.equal(all('notifications').filter(n=>n.orderId===order.id).length,0);
  const event={type:'checkout.session.completed',data:{object:{id:'cs_'+order.id,metadata:{orderId:order.id},client_reference_id:order.id,currency:'pkr',amount_total:order.total,payment_status:'paid'}}};
  applyStripeEvent(event);applyStripeEvent(event);assert.equal(all('notifications').filter(n=>n.orderId===order.id).length,1);assert.match(confirmationEmail(get('orders',order.id)).text,/payment verified/);
});
test('WhatsApp uses the configured approved template and normalizes local numbers',async()=>{
  assert.equal(normalizeWhatsAppPhone('0300 1234567'),'923001234567');assert.equal(normalizeWhatsAppPhone('+92 300 1234567'),'923001234567');assert.equal(normalizeWhatsAppPhone('00923001234567'),'923001234567');assert.equal(normalizeWhatsAppPhone('abc'),null);
  process.env.WHATSAPP_PHONE_NUMBER_ID='123456';process.env.WHATSAPP_API_VERSION='v25.0';process.env.WHATSAPP_ACCESS_TOKEN='test-token';process.env.WHATSAPP_ORDER_TEMPLATE='powerplanet_order_confirmation';
  const order=all('orders')[0];let called=false;
  const result=await sendWhatsApp({to:'923001234567'},order,async(url,options)=>{called=true;assert.equal(url,'https://graph.facebook.com/v25.0/123456/messages');const body=JSON.parse(options.body);assert.equal(body.type,'template');assert.equal(body.to,'923001234567');assert.equal(body.template.name,'powerplanet_order_confirmation');assert.equal(body.template.components[0].parameters.length,4);return {ok:true,json:async()=>({messages:[{id:'wamid.test'}]})};});assert.equal(called,true);assert.equal(result.providerId,'wamid.test');
});
test('cancelled orders skip unsent notifications and store alert uses a separate recipient',async()=>{
  process.env.ORDER_NOTIFICATION_EMAIL='shop@example.test';const {order}=await checkout(payload());assert.equal(all('notifications').filter(n=>n.orderId===order.id).length,2);
  put('orders',{...get('orders',order.id),status:'cancelled'});await processNotifications({email:async()=>({providerId:'fixture'})});assert.ok(all('notifications').filter(n=>n.orderId===order.id).every(n=>n.status==='skipped'));
});
