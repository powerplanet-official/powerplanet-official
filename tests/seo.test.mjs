import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  metadataForRoute,
  resolveSeoRoute,
  serializeJsonLd,
  sitemapPaths,
  structuredDataForRoute,
} from '../lib/seo.mjs';

const product = {
  id: 'real-panel',
  name: 'Test 585W panel',
  description: 'Listed panel specifications.',
  brand: 'Test Solar',
  model: 'T-585',
  categoryId: 'panels',
  image: '/images/panel.svg',
  price: 100,
  stock: 10,
  status: 'published',
};
const data = {
  settings: {
    name: 'Powerplanet',
    phone: '+92 301 4101700',
    address: '',
    facebook: 'https://www.facebook.com/Powerplanet.1/',
  },
  categories: [
    { id: 'panels', name: 'Solar Panels', parentId: null },
    { id: 'empty', name: 'Empty category', parentId: null },
  ],
  products: Array.from({ length: 25 }, (_, index) => ({
    ...product,
    id: index ? `panel-${index}` : product.id,
  })),
};

test('known routes have distinct canonicals; missing records and excess segments are 404s', () => {
  for (const path of [
    '/missing',
    '/product/missing',
    '/category/missing',
    '/product/real-panel/extra',
    '/shop/extra',
  ])
    assert.equal(resolveSeoRoute(data, path), null);
  const home = resolveSeoRoute(data);
  const detail = resolveSeoRoute(data, '/product/real-panel');
  assert.equal(home.canonicalPath, '/');
  assert.equal(detail.canonicalPath, '/product/real-panel');
  assert.notEqual(
    metadataForRoute(home, data.settings).title.absolute,
    metadataForRoute(detail, data.settings).title.absolute,
  );
});

test('private, empty, search and faceted pages are noindex while single-brand pages are eligible', () => {
  for (const path of ['/cart', '/checkout', '/compare', '/wishlist', '/category/empty'])
    assert.equal(resolveSeoRoute(data, path).index, false, path);
  for (const search of [
    { q: 'panel' },
    { min: '1' },
    { brand: ['Test Solar', 'Other'] },
    { sort: 'price-low' },
    { view: 'list' },
    { limit: '50' },
  ])
    assert.equal(resolveSeoRoute(data, '/shop', search).index, false);
  const brand = resolveSeoRoute(data, '/shop', { brand: 'Test Solar', utm_source: 'campaign' });
  assert.equal(brand.index, true);
  assert.equal(brand.canonicalPath, '/shop?brand=Test+Solar');
  assert.equal(resolveSeoRoute(data, '/category/panels', { brand: 'Test Solar' }).index, false);
});

test('pagination is self-canonical, validates range, and never canonicalizes page 2 to page 1', () => {
  const route = resolveSeoRoute(data, '/shop', { page: '2', utm_source: 'campaign' });
  assert.equal(route.canonicalPath, '/shop?page=2');
  assert.match(route.title, /Page 2/);
  assert.equal(route.selection.visible.length, 5);
  assert.equal(resolveSeoRoute(data, '/shop', { page: '1' }).canonicalPath, '/shop');
  for (const page of ['0', '-1', '3', 'foo', '2x'])
    assert.equal(resolveSeoRoute(data, '/shop', { page }), null);
});

test('drafts, illustrative previews and empty categories are excluded from the sitemap', () => {
  const fixture = {
    ...data,
    products: [
      ...data.products,
      { ...product, id: 'draft', status: 'draft' },
      { ...product, id: 'preview', status: 'preview' },
    ],
  };
  const paths = sitemapPaths(fixture);
  assert.equal(new Set(paths).size, paths.length);
  for (const path of paths) {
    const url = new URL(path, 'https://powerplanet.pk');
    const route = resolveSeoRoute(fixture, url.pathname, url.searchParams);
    assert.ok(route?.index, path);
    assert.equal(route.canonicalPath, path);
  }
  assert.ok(!paths.includes('/category/empty'));
  assert.ok(!paths.includes('/product/draft'));
  assert.ok(!paths.includes('/product/preview'));
  assert.equal(resolveSeoRoute(fixture, '/product/draft'), null);
  assert.equal(resolveSeoRoute(fixture, '/product/preview').index, false);
});

test('schema follows visible breadcrumbs and never treats snapshot prices as confirmed Offers', () => {
  const route = resolveSeoRoute(data, '/product/real-panel');
  const graph = structuredDataForRoute(route, data)['@graph'];
  const schema = graph.find((node) => node['@type'] === 'Product');
  assert.equal(schema.name, product.name);
  assert.equal(schema.description, product.description);
  for (const key of ['offers', 'aggregateRating', 'review']) assert.equal(schema[key], undefined);
  const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
  assert.deepEqual(
    crumbs.itemListElement.map((item) => item.name),
    route.breadcrumbs.map((item) => item.name),
  );
  const home = structuredDataForRoute(resolveSeoRoute(data), data);
  assert.match(home['@graph'][0].address, /Bhatta Chowk/);
});

test('JSON-LD serialization cannot terminate the script element', () => {
  const payload = { name: '</script><script>alert(1)</script>\u2028\u2029' };
  const serialized = serializeJsonLd(payload);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), payload);
});

test('compact public payload preserves fields used by navigation, search and checkout', async () => {
  const { publicStorefrontData } = await import('../lib/public-store.mjs');
  const compact = publicStorefrontData({
    ...data,
    faqs: [{ answer: 'Unused in this UI' }],
    products: [
      {
        ...product,
        specs: 'Voltage: 48V',
        source: 'import-only',
        specifications: [{ name: 'Voltage', value: '48V' }],
        minQuantity: 2,
      },
      { ...product, id: 'draft', status: 'draft' },
    ],
  });
  assert.equal(compact.products.length, 1);
  assert.equal(compact.products[0].specs, 'Voltage: 48V');
  assert.equal(compact.products[0].price, 100);
  assert.equal(compact.products[0].minQuantity, 2);
  assert.equal(compact.products[0].source, undefined);
  assert.equal(compact.faqs, undefined);
  assert.deepEqual(compact.categories, data.categories);
});
