import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'powerplanet-homepage-'));process.env.DB_PATH=join(temp,'store.sqlite');
const {app}=await import('../server/app.mjs');const {db,put,all}=await import('../server/db.mjs');
// Match the production importer, which hides the initial demo products.
for(const product of all('products'))put('products',{...product,status:'draft'});
const catalog=JSON.parse(readFileSync('data/catalog-source/solar-catalog.json','utf8'));for(const c of catalog.categories)put('categories',c);for(const p of catalog.products)put('products',{...p,minQuantity:1});
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
 assert.ok(await desktop.locator('.desktop-solar-hero').evaluate(e=>e.clientHeight>200));
 assert.equal(await hero.locator('img').first().getAttribute('src'), '/images/solar-home/solar-range.png');
 for(let i=1;i<=3;i++){
   await hero.getByRole('button',{name:`Show slide ${i}`,exact:true}).click();
   await page.waitForFunction(index=>document.querySelectorAll('.solar-hero-controls .carousel-dots button')[index].getAttribute('aria-pressed')==='true',i-1);
   assert.ok((await hero.locator('.solar-hero-slide').nth(i-1).getAttribute('href')).startsWith('/category/'));
 }
 await hero.getByRole('button',{name:'Next slide',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.solar-hero-controls .carousel-dots button').getAttribute('aria-pressed')==='true');
 await hero.getByRole('button',{name:'Pause slideshow'}).click();
 await page.locator('img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
 await page.screenshot({path:'/tmp/desktop-restored-full.png',fullPage:true});
 await page.screenshot({path:'/tmp/desktop-restored.png'});
 // Exact uploaded artwork is shared by both logo placements without recoloring.
 const logos = page.locator('.main-header .official-logo, .footer-logo .official-logo');
 assert.equal(await logos.count(), 2);
 assert.ok(await logos.evaluateAll(images => images.every(image => image.naturalWidth === 1280 && image.naturalHeight === 1280)));
 assert.ok(await logos.evaluateAll(images => images.every(image => getComputedStyle(image).objectFit === 'cover' && getComputedStyle(image).filter === 'none')));
 // Check hero autoplay timing before interacting with the product rails.
 await hero.getByRole('button', {name:'Play slideshow'}).click();
 await page.evaluate(()=>document.activeElement?.blur());
 await page.mouse.move(0,0);
 await page.waitForFunction(()=>document.querySelectorAll('.solar-hero-controls .carousel-dots button')[1].getAttribute('aria-pressed')==='true',{}, {timeout:5500});
 await hero.getByRole('button', {name:'Pause slideshow'}).click();
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
 await page.screenshot({path:'/tmp/mobile-solar-home.png',fullPage:true});
 await page.screenshot({path:'/tmp/mobile-solar-first-screen.png'});
 for(let i=0;i<3;i++){await collections.nth(i).scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/mobile-collection-${i+1}.png`});}
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
 // Search suggestions, submitted results, and browser navigation share one query.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base);await hero.waitFor();
 const search=page.locator('.main-header .product-search input');
 await search.fill('585 watt astronergy');
 await page.getByRole('option',{name:/Astronergy 585W/}).waitFor();
 await page.screenshot({path:'/tmp/powerplanet-search-desktop.png'});
 await search.press('ArrowDown');await search.press('Enter');
 await page.waitForURL(/product\/w11-35462$/);
 await page.goto(base);await hero.waitFor();
 await search.fill('585 watt astronergy');await search.press('Enter');
 await page.waitForURL(/q=585/);
 await page.locator('.reference-product-card').waitFor();
 assert.equal(await page.locator('.reference-product-card').count(),1);
 assert.equal(await page.locator('.reference-product-card').getAttribute('data-product-id'),'w11-35462');
 await page.goto(base+'/shop');
 await page.locator('.reference-product-grid').waitFor();
 await page.getByRole('checkbox',{name:/Out of Stock/}).check();
 await page.waitForURL(/availability=out-of-stock/);
 let shown=await page.locator('.reference-product-card').evaluateAll(cards=>cards.map(card=>card.dataset.productId));
 assert.ok(shown.length>0&&shown.every(id=>catalog.products.find(product=>product.id===id)?.availability==='out-of-stock'));
 await page.getByLabel('Minimum price',{exact:true}).fill('10000');
 await page.getByLabel('Maximum price',{exact:true}).fill('50000');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await page.waitForURL(/max=50000/);
 await page.getByRole('button',{name:'Remove price filter'}).click();
 await page.waitForURL(url=>!url.searchParams.has('min')&&!url.searchParams.has('max'));
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await page.waitForURL(base+'/shop');
 await page.goto(base+'/category/solar-inverters');
 await page.getByRole('checkbox',{name:/Hybrid Inverters/}).check();
 await page.waitForURL(/category=hybrid-inverters/);
 await page.getByLabel('Find a brand').fill('Solis');
 await page.getByRole('checkbox',{name:/^Solis/}).check();
 await page.waitForURL(/brand=Solis/);
 assert.equal(await page.locator('.reference-product-card').count(),15);
 await page.screenshot({path:'/tmp/powerplanet-filters-desktop.png'});
 await page.goBack();
 await page.waitForURL(url=>!url.searchParams.has('brand'));
 assert.equal(await page.getByRole('checkbox',{name:/^Solis/}).isChecked(),false);
 await page.setViewportSize({width:390,height:844});
 await page.goto(base);await hero.waitFor();
 const mobileSearch=page.locator('.mobile-store-search input');
 await mobileSearch.fill('astronerqy 585 w');
 await page.getByRole('option',{name:/Astronergy 585W/}).waitFor();
 await page.screenshot({path:'/tmp/powerplanet-search-mobile.png'});
 await page.getByRole('option',{name:/Astronergy 585W/}).tap();
 await page.waitForURL(/product\/w11-35462$/);
 await page.locator('.imported-product-detail').waitFor();
 assert.equal(await page.getByRole('spinbutton',{name:'Quantity',exact:true}).inputValue(),'1');
 await context.unrouteAll({behavior:'wait'});
 assert.deepEqual(errors,[]);
 console.log('PASS: shared three-campaign desktop/mobile hero, original logo bytes and framing, faster autoplay, product rails, reduced motion, touch, category links, search, and no overflow at eight widths.');
}catch(error){console.error(logs);throw error;}finally{await browser?.close();web.kill('SIGTERM');await new Promise(resolve=>api.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});}
