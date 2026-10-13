import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'powerplanet-checkout-browser-'));
process.env.DB_PATH=join(temp,'store.sqlite');
delete process.env.STRIPE_SECRET_KEY;delete process.env.STRIPE_WEBHOOK_SECRET;
const {app}=await import('../server/app.mjs');
const {db,put,all}=await import('../server/db.mjs');
put('products',{id:'checkout-panel',name:'Checkout solar panel',categoryId:'solar-panels',price:12500,stock:20,status:'published',availability:'in-stock',minQuantity:1,image:'/images/panel.svg',brand:'Test',description:'Browser checkout fixture',specs:'',featured:true});
db.prepare('INSERT INTO admins VALUES(?,?,?)').run('checkout@example.com',scryptSync('checkout-test-password','salt',64).toString('hex'),'salt');
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const apiOrigin=`http://127.0.0.1:${server.address().port}`;
const port=process.env.TEST_WEB_PORT||'3007';
const base=`http://localhost:${port}`;
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',port],{env:{...process.env,BACKEND_URL:apiOrigin},stdio:['ignore','pipe','pipe']});
let logs='',browser;web.stdout.on('data',b=>logs+=b);web.stderr.on('data',b=>logs+=b);
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===59)throw Error(logs);await new Promise(r=>setTimeout(r,300));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 let loseResponse=false;
 await context.route('**/api/**',async route=>{
   const request=route.request();const url=new URL(request.url());
   const response=await route.fetch({url:apiOrigin+url.pathname+url.search});
   if(loseResponse&&url.pathname==='/api/orders'&&request.method()==='POST'){loseResponse=false;await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Connection interrupted. Please retry.'})});return;}
   await route.fulfill({response});
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('heading',{name:'Featured Solar Products'}).waitFor();
 await page.evaluate(()=>localStorage.setItem('pp-cart',JSON.stringify([{id:'checkout-panel',quantity:2}])));
 await page.goto(base+'/cart');await page.getByRole('link',{name:'Proceed to checkout'}).click();
 await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor();
 assert.equal(await page.getByRole('radio',{name:/Credit \/ Debit Card/}).count(),0);
 await page.getByLabel('Full name').fill('COD Browser Customer');await page.getByRole('textbox',{name:'Phone number *',exact:true}).fill('03001234567');await page.getByLabel('City').fill('Lahore');await page.getByLabel('Delivery address').fill('House 20, Main Road, Lahore');
 await page.screenshot({path:'/tmp/powerplanet-checkout-desktop.png',fullPage:true});
 loseResponse=true;await page.getByRole('button',{name:'Place order — Cash on Delivery'}).click();await page.getByText('Connection interrupted. Please retry.').waitFor();
 await page.reload();await page.getByRole('button',{name:'Retry checkout'}).waitFor();assert.equal(await page.getByLabel('Full name').inputValue(),'COD Browser Customer');
 await page.getByRole('button',{name:'Retry checkout'}).click();await page.getByRole('heading',{name:'Your order has been placed successfully'}).waitFor();
 assert.equal(all('orders').length,1);assert.equal(all('orders')[0].total,2500000);assert.equal(all('orders')[0].paymentStatus,'due_on_delivery');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pp-cart'))),[]);
 await page.reload();await page.getByRole('heading',{name:'Your order has been placed successfully'}).waitFor();
 await page.goto(base+'/admin');await page.getByLabel('Email address').fill('checkout@example.com');await page.getByLabel('Password',{exact:true}).fill('checkout-test-password');await page.getByRole('button',{name:'Sign in to administration'}).click();await page.getByRole('button',{name:'Orders',exact:true}).click();
 await page.getByText('COD Browser Customer',{exact:true}).waitFor();await page.getByRole('button',{name:'View order'}).click();await page.getByText('House 20, Main Road, Lahore',{exact:false}).waitFor();
 for(const status of ['processing','shipped','delivered']){await page.getByLabel('Order status').selectOption(status);await page.getByRole('button',{name:'Save order status'}).click();await page.waitForFunction(()=>document.querySelector('.admin-table tbody tr')?.textContent.includes(''+document.querySelector('select[aria-label="Order status"]').value));await page.getByRole('button',{name:'Save order status'}).waitFor({state:'visible'});await page.waitForTimeout(150);}
 assert.equal(all('orders')[0].paymentStatus,'paid');
 await page.screenshot({path:'/tmp/powerplanet-checkout-admin.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>localStorage.setItem('pp-cart',JSON.stringify([{id:'checkout-panel',quantity:1}])));await page.goto(base+'/checkout');await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'/tmp/powerplanet-checkout-mobile.png',fullPage:true});
 // A single unit with no confirmed price or stock still becomes a saved COD order.
 put('products',{...all('products').find(p=>p.id==='checkout-panel'),price:null,stock:0,availability:'on-request'});
 await page.goto(base+'/checkout');
 await page.getByRole('heading',{name:'Checkout',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Place order — Cash on Delivery'}).isEnabled(),true);
 assert.equal(await page.getByText('Some items need a confirmed price or stock quantity.',{exact:false}).count(),0);
 await page.getByLabel('Full name').fill('Single Panel Customer');
 await page.getByRole('textbox',{name:'Phone number *',exact:true}).fill('03001234567');
 await page.getByLabel('City').fill('Lahore');
 await page.getByLabel('Delivery address').fill('House 21, Main Road, Lahore');
 await page.getByRole('button',{name:'Place order — Cash on Delivery'}).click();
 await page.getByRole('heading',{name:'Your order has been placed successfully'}).waitFor();
 const pending=all('orders').find(o=>o.name==='Single Panel Customer');
 assert.ok(pending);
 assert.equal(pending.items[0].quantity,1);
 assert.equal(pending.total,null);
 assert.equal(pending.requiresConfirmation,true);
 assert.equal(all('products').find(p=>p.id==='checkout-panel').stock,0);
 await page.screenshot({path:'/tmp/powerplanet-order-success.png',fullPage:true});
 await context.unrouteAll({behavior:'wait'});
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile checkout, hidden unconfigured card option and successful single-unit unconfirmed COD order, COD order, lost-response retry after reload, confirmation reload, cart clearing, admin order and payment status, no browser errors.');
}finally{await browser?.close();web.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});}
