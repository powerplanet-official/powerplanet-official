import { createServer, request as httpRequest } from 'node:http';
import { publicStorefrontData } from '../lib/public-store.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { chromium } from '@playwright/test';
import { resolveSeoRoute, sitemapPaths } from '../lib/seo.mjs';

const snapshot = JSON.parse(readFileSync('data/catalog-source/solar-catalog.json', 'utf8'));
const catalog = {
  products: snapshot.products,
  categories: snapshot.categories,
  settings: {
    name: 'Powerplanet',
    phone: '+92 301 4101700',
    whatsapp: '923014101700',
    address: '',
    facebook: 'https://www.facebook.com/Powerplanet.1/',
  },
};
let apiCalls = 0;
const api = createServer((request, response) => {
  apiCalls++;
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(publicStorefrontData(catalog)));
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${process.env.SEO_TEST_PORT || '3021'}`;
const web = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    new URL(base).port,
  ],
  {
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${api.address().port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '',
  browser;
web.stdout.on('data', (chunk) => (logs += chunk));
web.stderr.on('data', (chunk) => (logs += chunk));
const report = {
  base,
  checks: [],
  note: 'Local production build, isolated public catalog fixture. No production database writes.',
};
async function checkPage(path, status = 200) {
  const response = await fetch(base + path);
  const html = await response.text();
  assert.equal(response.status, status, `${path}: HTTP status`);
  const $ = load(html);
  if (status === 404) {
    assert.match(
      $('meta[name="robots"]')
        .map((_, item) => $(item).attr('content'))
        .get()
        .join(','),
      /noindex/,
    );
    report.checks.push({ path, status });
    return $;
  }
  const url = new URL(path, base);
  const expected = resolveSeoRoute(catalog, url.pathname, url.searchParams);
  assert.ok(expected);
  assert.equal($('title').length, 1, `${path}: one title`);
  assert.equal($('meta[name="description"]').length, 1, `${path}: one description`);
  assert.equal($('link[rel="canonical"]').length, 1, `${path}: one canonical`);
  assert.equal(
    new URL($('link[rel="canonical"]').attr('href')).href,
    'https://powerplanet.pk' + expected.canonicalPath,
  );
  assert.equal($('meta[name="robots"]').attr('content').includes('noindex'), !expected.index);
  assert.equal($('h1').length, 1, `${path}: one H1 in raw HTML`);
  const schema = JSON.parse($('script[type="application/ld+json"]').text());
  assert.equal(schema['@context'], 'https://schema.org');
  assert.ok(!schema['@graph'].some((node) => node.offers || node.aggregateRating));
  if (expected.kind === 'catalog' && expected.selection.selected.length)
    assert.ok($('a[href^="/product/"]').length > 0);
  if (expected.product) {
    assert.equal($('h1').text(), expected.product.name);
    assert.ok($('.specifications').text().includes(expected.product.specs));
    assert.equal(
      schema['@graph'].find((node) => node['@type'] === 'Product').name,
      expected.product.name,
    );
  }
  report.checks.push({
    path,
    status,
    title: $('title').text(),
    canonical: $('link[rel="canonical"]').attr('href'),
    robots: $('meta[name="robots"]').attr('content'),
    productLinks: $('a[href^="/product/"]').length,
    bytes: Buffer.byteLength(html),
  });
  return $;
}
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(base + '/robots.txt')).ok) break;
    } catch {}
    if (attempt === 79) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  for (const path of [
    '/',
    '/shop',
    '/shop?page=2',
    '/shop?brand=Solis',
    '/shop?brand=Solis&page=2',
    '/category/solar-inverters',
    '/category/solar-inverters?page=2',
    '/product/w11-35462',
    '/about',
    '/contact',
    '/quote',
    '/cart',
    '/checkout?order=private-order',
    '/wishlist',
    '/compare',
    '/shop?q=inverter',
    '/shop?brand=Solis&min=1000',
    '/shop?sort=price-low',
    '/shop?limit=50&page=2',
    '/shop?utm_source=test',
    '/category/solar-packages',
  ])
    await checkPage(path);
  for (const path of [
    '/missing-seo-page',
    '/product/missing-product',
    '/category/missing-category',
    '/product/w11-35462/extra',
    '/shop?page=999999',
    '/shop?page=0',
  ])
    await checkPage(path, 404);
  const admin = await fetch(base + '/admin');
  const adminHtml = load(await admin.text());
  assert.match(adminHtml('meta[name="robots"]').attr('content'), /noindex/);
  const robots = await fetch(base + '/robots.txt');
  assert.match(robots.headers.get('content-type'), /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https:\/\/powerplanet.pk\/sitemap.xml/);
  const sitemap = await fetch(base + '/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /xml/);
  const xml = load(await sitemap.text(), { xmlMode: true });
  const urls = xml('loc')
    .map((_, item) => xml(item).text())
    .get();
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.length, sitemapPaths(catalog).length);
  assert.equal(xml('lastmod').length, 0);
  for (const url of urls) {
    const parsed = new URL(url);
    const route = resolveSeoRoute(catalog, parsed.pathname, parsed.searchParams);
    assert.ok(route?.index, url);
    assert.equal(url, 'https://powerplanet.pk' + route.canonicalPath);
  }
  const categoryPaths = sitemapPaths(catalog).filter((path) => path.startsWith('/category/'));
  for (const path of categoryPaths)
    if (!report.checks.some((item) => item.path === path)) await checkPage(path);
  const page2 = await checkPage('/shop?page=2');
  assert.equal(page2('a[aria-label="Next page"]').attr('href'), '/shop?page=3');
  // Undici fetch rewrites Host to the URL host; use HTTP directly for this check.
  const redirect = await new Promise((resolve, reject) => {
    const request = httpRequest(
      base + '/shop?brand=Solis',
      { headers: { host: 'www.powerplanet.pk' } },
      (response) => {
        response.resume();
        resolve({ status: response.statusCode, location: response.headers.location });
      },
    );
    request.on('error', reject);
    request.end();
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.location, 'https://powerplanet.pk/shop?brand=Solis');

  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(base + '/product/w11-35462');
  assert.match(await page.locator('h1').textContent(), /Astronergy/);
  await page.goto(base + '/shop');
  assert.equal(await page.locator('.reference-product-card').count(), 20);
  await page.getByRole('link', { name: 'Next page', exact: true }).click();
  assert.match(page.url(), /page=2/);
  const mobile = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(base);
  assert.equal(await mobilePage.locator('.mobile-homepage').count(), 1);
  assert.equal(await mobilePage.locator('h1').count(), 1);
  report.sitemapUrls = urls.length;
  report.apiCalls = apiCalls;
  assert.ok(apiCalls < 10, `Catalog fetched ${apiCalls} times; expected shared short cache.`);
  report.javascriptDisabledNavigation = 'passed';
  report.wwwRedirect = '308, path/query preserved';
  report.status = 'passed';
  mkdirSync('docs/seo/verification', { recursive: true });
  writeFileSync('docs/seo/verification/routes.json', JSON.stringify(report, null, 2));
  console.log(
    `PASS: ${report.checks.length} raw HTML route checks, ${urls.length} sitemap policy checks, real 404s, robots, www redirect, JS-disabled pagination and mobile SSR. API calls: ${apiCalls}.`,
  );
} catch (error) {
  console.error(logs.slice(-5000));
  throw error;
} finally {
  await browser?.close();
  web.kill('SIGTERM');
  await new Promise((resolve) => api.close(resolve));
}
