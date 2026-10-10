import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Read-only catalog fixtures; no live backend, orders, or production DB writes.
const catalog = JSON.parse(readFileSync('data/catalog-source/solar-catalog.json', 'utf8'));
const base = 'http://127.0.0.1:3018';
const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3018'], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser;
web.stdout.on('data', (chunk) => logs += chunk);
web.stderr.on('data', (chunk) => logs += chunk);
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i === 59) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.route('**/api/store', (route) => route.fulfill({ json: {
    products: catalog.products, categories: catalog.categories, faqs: [],
    settings: { name: 'Powerplanet', whatsapp: '923014101700', facebook: 'https://www.facebook.com/Powerplanet.1/' },
  } }));
  await context.route('**/api/branding/logo*', (route) => route.fulfill({ contentType: 'image/jpeg', body: readFileSync('public/images/powerplanet-logo-original.jpeg') }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/shop');
  await page.locator('.browse-brand-grid button').first().waitFor();
  const positions = await page.evaluate(() => ['.browse-brand-grid', '.browse-category-grid', '.reference-catalog-layout'].map((selector) => document.querySelector(selector).getBoundingClientRect().top));
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2]);
  assert.equal(await page.locator('.browse-brand-grid').first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length), 8);
  await page.screenshot({ path: '/tmp/powerplanet-catalog-desktop.png' });
  await page.getByRole('button', { name: 'Browse Solis', exact: true }).click();
  await page.waitForURL(/brand=Solis/);
  await page.getByRole('heading', { name: 'Solis Categories', exact: true }).waitFor();
  assert.ok((await page.locator('.reference-product-card').evaluateAll((cards) => cards.map((card) => card.dataset.productId))).every((id) => catalog.products.find((product) => product.id === id).brand === 'Solis'));
  await page.locator('.browse-category-grid a').filter({ hasText: 'Solar Inverters' }).click();
  await page.waitForURL(/category\/solar-inverters\?brand=Solis/);
  await page.locator('.browse-category-grid a').first().waitFor();
  assert.ok(await page.locator('.browse-category-grid a').count() > 0);
  assert.ok((await page.locator('.browse-category-grid a').evaluateAll((links) => links.map((link) => link.href))).every((href) => href.includes('brand=Solis')));
  for (const width of [320, 375, 390, 640, 760, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/shop');
    await page.locator('.browse-category-grid').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base + '/shop');
  await page.locator('.browse-category-grid').waitFor();
  assert.equal(await page.locator('.browse-brand-grid').first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length), 4);
  assert.equal(await page.locator('.browse-category-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length), 2);
  await page.screenshot({ path: '/tmp/powerplanet-catalog-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open categories', exact: true }).click();
  const menu = page.locator('.mobile-category-directory');
  await menu.waitFor();
  assert.equal(await page.locator('.solar-mega-menu').isVisible(), false);
  assert.equal(await menu.locator('details[open]').count(), 0);
  await menu.locator('summary').filter({ hasText: 'Solar Panels' }).click();
  await menu.getByRole('link', { name: 'Astronergy Solar Panels', exact: true }).waitFor();
  await menu.locator('summary').filter({ hasText: 'Solar Inverters' }).click();
  assert.equal(await menu.locator('details[open]').count(), 1);
  await page.screenshot({ path: '/tmp/powerplanet-category-menu-mobile.png' });
  await menu.getByRole('link', { name: 'Hybrid Inverters', exact: true }).click();
  await page.waitForURL(/category\/hybrid-inverters/);
  assert.equal(await menu.count(), 0);
  await page.getByRole('button', { name: 'Open categories', exact: true }).click();
  await menu.locator('summary').filter({ hasText: 'Shop by Brand' }).click();
  await menu.getByRole('searchbox', { name: 'Find a brand' }).fill('pylon');
  await menu.getByRole('link', { name: 'PylonTech', exact: true }).click();
  await page.waitForURL(/shop\?brand=PylonTech/);
  assert.equal(await menu.count(), 0);
  await page.getByRole('button', { name: 'Open categories', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await menu.count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: brand-first discovery, scoped categories, filters, 8 viewport widths, mobile accordion, brand search, navigation and Escape.');
} finally {
  await browser?.close();
  web.kill('SIGTERM');
}
