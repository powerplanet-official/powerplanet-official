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
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});await context.route('**/api/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:apiOrigin+url.pathname+url.search})});});
 const page=await context.newPage(),errors=[];page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE:',m.text());});page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR:',e.message);});
 await page.goto(base);
 const hero=page.getByRole('region',{name:'Solar deals'});
 await hero.waitFor();
 const desktop=page.locator('.desktop-homepage');
 assert.equal(await desktop.count(),1);
 assert.equal(await page.locator('.mobile-homepage').count(),0);
 assert.equal(await desktop.locator('.category-sidebar').count(),1);
 assert.equal(await desktop.locator('.category-tiles > a').count(),6);
 assert.equal(await desktop.locator('.home-products').count(),2);
 assert.equal(await desktop.locator('.promo-card').count(),2);
 assert.equal(await desktop.getByRole('region',{name:'Featured brands'}).count(),1);
 assert.ok(await desktop.locator('.home-catalog-grid > section').count()>3);
 assert.equal(await desktop.locator('.home-catalog-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),4);
 assert.ok(await desktop.locator('.deal-hero').evaluate(e=>e.clientHeight>=455));
 for(let i=1;i<=4;i++){
   await hero.getByRole('button',{name:`Show slide ${i}`,exact:true}).click();
   assert.equal(await hero.getByRole('button',{name:`Show slide ${i}`,exact:true}).getAttribute('aria-pressed'),'true');
   assert.ok((await hero.locator('.deal-copy .primary').getAttribute('href')).startsWith('/product/'));
 }
 await hero.getByRole('button',{name:'Next slide',exact:true}).click();
 assert.equal(await hero.getByRole('button',{name:'Show slide 1',exact:true}).getAttribute('aria-pressed'),'true');
 await hero.getByRole('button',{name:'Pause slideshow'}).click();
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
 await page.screenshot({path:'docs/previews/desktop-restored-full.png',fullPage:true});
 await page.screenshot({path:'docs/previews/desktop-restored.png'});
 // Product rows advance automatically without a toolbar or visible scrollbar.
 const featured=page.getByRole('region',{name:'Featured Solar Products carousel',exact:true});
 const desktopRail=featured.locator('.product-carousel-rail');
 await featured.scrollIntoViewIfNeeded();
 assert.equal(await featured.locator('.product-carousel-toolbar').count(),0);
 assert.equal(await desktopRail.evaluate(e=>getComputedStyle(e).scrollbarWidth),'none');
 await page.mouse.move(0,0);
 await page.waitForFunction(()=>document.querySelector('.home-products').scrollLeft>20);
 await desktopRail.focus();await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>document.querySelector('.home-products').scrollLeft<=3);
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
 await page.waitForFunction(()=>document.querySelector('.home-products').scrollLeft>20,{},{timeout:8000});
 await desktopRail.focus();

 for(const width of [320,390,430,760,761,1024,1440,1920]){
   await page.setViewportSize({width,height:844});
   await page.waitForTimeout(150);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow at ${width}`);
   assert.equal(await page.locator('.desktop-homepage').count(),width>760?1:0);
   assert.equal(await page.locator('.mobile-homepage').count(),width<=760?1:0);
   if(width<=760){
     const banner=await page.locator('.solar-hero-rail').boundingBox();
     assert.ok(Math.abs(banner.width-width)<1,`full-width hero at ${width}`);
     assert.ok(banner.height>=width/3,`large hero at ${width}`);
   }
 }
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base);await hero.waitFor();
 const collections=page.locator('.solar-collection');
 const categoryIds=['solar-panels','hybrid-inverters','lithium-ion-batteries'];
 assert.equal(await collections.count(),3);
 assert.equal(await page.locator('.solar-collection-tabs').count(),0);
 const heroImages=new Set(await hero.locator('img').evaluateAll(imgs=>imgs.map(i=>i.src)));
 assert.equal(heroImages.size,3);
 for(let i=0;i<3;i++){
   assert.equal(await collections.nth(i).locator('.solar-collection-banner').getAttribute('href'),`/category/${categoryIds[i]}`);
   await hero.getByRole('button',{name:`Show slide ${i+1}`,exact:true}).click();
   await page.waitForFunction(index=>document.querySelectorAll('.solar-hero-controls .carousel-dots button')[index].getAttribute('aria-pressed')==='true',i);
 }
 await hero.getByRole('button',{name:'Show slide 1',exact:true}).click();
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
 assert.deepEqual(await page.locator('.solar-collection-banner img, .solar-hero img, .brand-tile img').evaluateAll(imgs=>imgs.filter(i=>!i.naturalWidth).map(i=>i.src)),[]);
 await page.screenshot({path:'docs/previews/mobile-solar-home.png',fullPage:true});
 await page.screenshot({path:'docs/previews/mobile-solar-first-screen.png'});
 for(let i=0;i<3;i++){await collections.nth(i).scrollIntoViewIfNeeded();await page.screenshot({path:`docs/previews/mobile-collection-${i+1}.png`});}
 // Each visible hero call to action opens its matching collection.
 for(let i=0;i<3;i++){
   await hero.getByRole('button',{name:`Show slide ${i+1}`,exact:true}).click();
   await page.waitForFunction(index=>document.querySelectorAll('.solar-hero-controls .carousel-dots button')[index].getAttribute('aria-pressed')==='true',i);
   await hero.locator('.solar-hero-slide').nth(i).click();
   await page.locator('.reference-product-grid').waitFor();
   assert.ok(page.url().endsWith(`/category/${categoryIds[i]}`));
   await page.goto(base);await hero.waitFor();
 }
 const rail=collections.first().locator('.solar-products-rail');
 assert.ok(await rail.evaluate(e=>e.scrollWidth>e.clientWidth));
 assert.equal(await collections.first().getByRole('button',{name:'Pause Solar Panels products',exact:true}).count(),0);
 await rail.scrollIntoViewIfNeeded();await page.waitForTimeout(5500);assert.ok(await rail.evaluate(e=>e.scrollLeft<=3));
 await rail.focus();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.solar-products-rail').scrollLeft>0);
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>document.querySelector('.solar-products-rail').scrollLeft<=3);
 // Exercise actual touch scrolling, rather than only synthetic scrollLeft changes.
 const cdp=await context.newCDPSession(page);
 await rail.scrollIntoViewIfNeeded();
 const box=await rail.boundingBox();const y=Math.min(700,box.y+90);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y}]});
 for(const x of [280,230,180,120,60])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.querySelector('.solar-products-rail').scrollLeft>20);
 await page.evaluate(()=>scrollTo(0,900));
 assert.equal(Math.round((await page.locator('.main-header').boundingBox()).y),0);
 await page.getByRole('button',{name:'Open categories',exact:true}).click();
 await page.locator('.solar-mega-menu').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Close categories',exact:true}).click();
 assert.equal(await page.locator('.solar-mega-menu').count(),0);
 for(let i=0;i<3;i++){
   await page.goto(base);await hero.waitFor();
   await collections.nth(i).locator('.solar-collection-banner').click();
   await page.locator('.reference-product-grid').waitFor();
   assert.match(page.url(),new RegExp(`/category/${categoryIds[i]}$`));
   assert.ok(await page.locator('.reference-product-card').count()>0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.locator('.reference-product-name').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13));
 }
 await page.goto(base);await hero.waitFor();
 const productLink=collections.first().locator('.product-name').first();
 const productHref=await productLink.getAttribute('href');await productLink.click();
 await page.locator('.imported-product-detail').waitFor();assert.ok(page.url().endsWith(productHref));
 await page.goto(base);await hero.waitFor();
 const brands=collections.nth(1).locator('.collection-brands');
 const brandLink=brands.locator('.brand-tile').first();const brandHref=await brandLink.getAttribute('href');
 await brandLink.click();await page.locator('.reference-product-grid').waitFor();assert.ok(page.url().endsWith(brandHref));
 await page.goto(base);await hero.waitFor();
 await page.locator('.mobile-store-search input').fill('solar');
 await page.locator('.mobile-store-search button').click();
 await page.locator('.reference-product-grid').waitFor();assert.match(page.url(),/q=solar/);
 assert.deepEqual(errors,[]);
 console.log('PASS: original desktop restored (sidebar, four-slide hero, tiles, grids, promos, brands, directory); mobile-only three solar sections with larger full-width hero; automatic product scrolling, arrows, keyboard, reduced motion, native swipe, hero collection links, menu, search; no overflow and correct layout switching at eight widths.');
}catch(error){console.error(logs);throw error;}finally{await browser?.close();web.kill('SIGTERM');await new Promise(resolve=>api.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});}
