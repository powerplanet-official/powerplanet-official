import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'powerplanet-homepage-'));process.env.DB_PATH=join(temp,'store.sqlite');
const {app}=await import('../server/app.mjs');const {db,put,all}=await import('../server/db.mjs');
const catalog=JSON.parse(readFileSync('data/catalog-source/solar-catalog.json','utf8'));for(const c of catalog.categories)put('categories',c);for(const p of catalog.products)put('products',p);
const api=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const apiOrigin=`http://127.0.0.1:${api.address().port}`;
const base='http://localhost:3008',web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3008'],{stdio:['ignore','pipe','pipe']});let logs='',browser;web.stdout.on('data',d=>logs+=d);web.stderr.on('data',d=>logs+=d);
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}if(i===59)throw Error(logs);await new Promise(r=>setTimeout(r,300));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:apiOrigin+url.pathname+url.search})});});
 const page=await context.newPage(),errors=[];page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE:',m.text());});page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR:',e.message);});
 await page.goto(base);await page.getByRole('region',{name:'Solar deals'}).waitFor();
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
 const logo=await context.request.get(apiOrigin+'/api/branding/logo');assert.equal(logo.status(),200);assert.match(logo.headers()['content-type'],/image\/svg\+xml/);
 const promiseSection=page.getByRole('region',{name:'Why choose Power Planet'});assert.equal(await promiseSection.locator('.store-promise').count(),4);assert.equal(await promiseSection.getByRole('heading',{name:'30,000+ PRODUCTS AVAILABLE',exact:true}).count(),1);assert.equal(await page.locator('.home-catalog + .store-promises').count(),1);
 const hero=page.getByRole('region',{name:'Solar deals'}),images=new Set();
 for(let i=1;i<=4;i++){await hero.getByRole('button',{name:`Show slide ${i}`,exact:true}).click();images.add(await hero.locator('.deal-art img').getAttribute('src'));assert.equal(await hero.getByRole('button',{name:`Show slide ${i}`,exact:true}).getAttribute('aria-pressed'),'true');assert.ok((await hero.locator('.deal-copy .primary').getAttribute('href')).startsWith('/product/'));}
 assert.equal(images.size,4);await hero.getByRole('button',{name:'Next slide',exact:true}).click();assert.equal(await hero.getByRole('button',{name:'Show slide 1',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('link',{name:'Powerplanet home',exact:true}).focus();await page.mouse.move(1400,970);await page.waitForTimeout(6400);assert.equal(await hero.getByRole('button',{name:'Show slide 2',exact:true}).getAttribute('aria-pressed'),'true');
 await hero.getByRole('button',{name:'Pause slideshow'}).click();await page.getByRole('link',{name:'Powerplanet home',exact:true}).focus();await page.waitForTimeout(6200);assert.equal(await hero.getByRole('button',{name:'Show slide 2',exact:true}).getAttribute('aria-pressed'),'true');
 await hero.getByRole('button',{name:'Show slide 1',exact:true}).click();await page.screenshot({path:'/tmp/powerplanet-brand-home-desktop.png',fullPage:true});
 const brands=page.getByRole('region',{name:'Featured brands'});await brands.scrollIntoViewIfNeeded();assert.ok(await brands.locator('.brand-tile').count()>=8);
 await brands.getByRole('button',{name:'Show brands page 3'}).click();await page.waitForTimeout(600);assert.equal(await brands.getByRole('button',{name:'Show brands page 3'}).getAttribute('aria-pressed'),'true');
 await brands.getByRole('button',{name:'Show brands page 1'}).click();await page.waitForTimeout(500);await brands.getByRole('link',{name:'Shop Knox',exact:true}).click();await page.locator('.reference-product-grid').waitFor();assert.match(page.url(),/brand=Knox/);assert.ok(await page.locator('.reference-product-card').count()>0);
 await page.goto(base);await page.getByRole('region',{name:'Our catalog'}).getByRole('link',{name:'Solar Inverters',exact:true}).click();await page.getByRole('heading',{name:'Solar Inverters',exact:true,level:1}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(base);await hero.waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.screenshot({path:'/tmp/powerplanet-brand-home-mobile.png',fullPage:true});await hero.screenshot({path:'/tmp/powerplanet-hero-mobile.png'});
 await brands.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.waitForFunction(()=>[...document.querySelectorAll('.brand-tile img')].every(img=>{const rect=img.getBoundingClientRect();return rect.right<=0||rect.left>=innerWidth||(img.complete&&img.naturalWidth>0);}));
 for(const src of await page.locator('.brand-tile img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')))){const response=await context.request.get(base+src);assert.equal(response.status(),200);}
 await brands.screenshot({path:'/tmp/powerplanet-featured-brands.png'});await promiseSection.screenshot({path:'/tmp/powerplanet-promises-mobile.png'});await page.setViewportSize({width:1440,height:1000});await promiseSection.screenshot({path:'/tmp/powerplanet-promises-desktop.png'});await page.locator('.main-header').screenshot({path:'/tmp/powerplanet-vector-header.png'});
 assert.deepEqual(errors,[]);console.log('PASS: four unique product-image slides, linked deals, autoplay, pause, wraparound, brand pagination/filter links, catalog links, mobile layout and loaded brand logos.');
}catch(error){console.error(logs);throw error;}finally{await browser?.close();web.kill('SIGTERM');await new Promise(resolve=>api.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});}
