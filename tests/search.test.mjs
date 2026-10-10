import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, searchProducts } from '../lib/search.mjs';
import { catalogSelection } from '../lib/catalog.mjs';

const categories = [
  { id: 'inverters', name: 'Inverters' },
  { id: 'hybrid', name: 'Hybrid', parentId: 'inverters' },
  { id: 'grid', name: 'On Grid', parentId: 'inverters' },
];
const products = [
  {
    id: 'six',
    name: 'Solis 6KW Hybrid Inverter',
    model: 'S6-EH1',
    brand: 'Solis',
    categoryId: 'hybrid',
    price: 200000,
    availability: 'in-stock',
    status: 'published',
  },
  {
    id: 'sixteen',
    name: 'Solis 16KW Hybrid Inverter',
    model: 'S16-EH1',
    brand: 'Solis',
    categoryId: 'hybrid',
    price: 400000,
    availability: 'out-of-stock',
    status: 'published',
  },
  {
    id: 'knox',
    name: 'Knox 6 kW On Grid Inverter',
    model: 'KX-6',
    brand: 'Knox',
    categoryId: 'grid',
    price: 150000,
    availability: 'out-of-stock',
    status: 'published',
  },
  {
    id: 'request',
    name: 'Knox 6 kW Hybrid Inverter',
    brand: 'Knox',
    categoryId: 'hybrid',
    price: null,
    availability: 'on-request',
    status: 'published',
  },
  {
    id: 'draft',
    name: 'Solis 6KW secret product',
    brand: 'Solis',
    categoryId: 'hybrid',
    price: 1,
    availability: 'in-stock',
    status: 'draft',
  },
];
const ids = (products) => products.map((product) => product.id);
const select = (value) =>
  catalogSelection(products, categories, 'inverters', new URLSearchParams(value));

test('search supports reordered words, unit spacing, plural forms and exact capacities', () => {
  assert.deepEqual(ids(searchProducts(products, 'inverters 6 kw solis')), ['six']);
  assert.deepEqual(ids(searchProducts(products, 'Solis 16 kilowatt')), ['sixteen']);
  assert.deepEqual(ids(searchProducts(products, '7 kw')), []);
  assert.equal(normalizeSearch('585 Watt BI-FACIAL N-Type Panels'), '585w bifacial ntype panel');
});
test('model punctuation and typo fallback work without revealing draft products', () => {
  assert.equal(searchProducts(products, 'S6EH1')[0].id, 'six');
  assert.deepEqual(ids(searchProducts(products, 'solsi hybrid 6kw')), ['six']);
  assert.deepEqual(ids(searchProducts(products, 'secret')), []);
  assert.deepEqual(ids(searchProducts(products, 'unknown solar product')), []);
});
test('search order is relevance unless an explicit sort is selected', () => {
  const extras = [
    ...products,
    { ...products[0], id: 'other', name: 'AAA inverter Solis 6KW', model: 'other' },
  ];
  const ranked = catalogSelection(
    extras,
    categories,
    null,
    new URLSearchParams('q=Solis+6KW+Hybrid'),
  );
  assert.equal(ranked.selected[0].id, 'six');
  assert.deepEqual(ids(select('q=6kw&sort=price-low').selected), ['knox', 'six', 'request']);
});
test('facets intersect while counts exclude their own selection', () => {
  const result = select('category=hybrid&brand=Solis&availability=out-of-stock&min=250000');
  assert.deepEqual(ids(result.selected), ['sixteen']);
  assert.equal(result.availabilityCounts.get('out-of-stock'), 1);
  assert.deepEqual(result.brandCounts, [['Solis', 1]]);
  assert.deepEqual(
    ids(select('category=hybrid&category=grid&availability=out-of-stock').selected),
    ['knox', 'sixteen'],
  );
});
test('legacy stock links, null prices, invalid values, and selected empty facets remain usable', () => {
  assert.deepEqual(ids(select('available=1').selected), ['six']);
  assert.ok(!ids(select('min=0').selected).includes('request'));
  assert.equal(select('min=NaN&max=-1').selected.length, 4);
  const result = select('brand=Knox&available=1');
  assert.equal(result.selected.length, 0);
  assert.ok(result.brandCounts.some(([brand, count]) => brand === 'Knox' && count === 0));
});
