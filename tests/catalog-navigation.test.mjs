import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogNavigation, categoryBrowseHref } from '../lib/catalog-navigation.mjs';

const categories = [
  { id: 'panels', name: 'Panels' },
  { id: 'inverters', name: 'Inverters' },
  { id: 'hybrid', name: 'Hybrid', parentId: 'inverters' },
  { id: 'ongrid', name: 'On Grid', parentId: 'inverters' },
  { id: 'empty', name: 'Empty' },
];
const products = [
  { id: '1', brand: 'Solis', categoryId: 'hybrid', status: 'published', image: '/hybrid.webp' },
  { id: '2', brand: 'Knox', categoryId: 'ongrid', status: 'published' },
  { id: '3', brand: 'Jinko', categoryId: 'panels', status: 'preview', price: null },
  { id: '4', brand: 'Hidden', categoryId: 'empty', status: 'draft' },
];

test('root discovery includes stocked and request-only categories but excludes drafts and empty groups', () => {
  const result = catalogNavigation(products, categories);
  assert.deepEqual(result.brands, ['Jinko', 'Knox', 'Solis']);
  assert.deepEqual(result.groups.map((group) => [group.id, group.count]), [['panels', 1], ['inverters', 2]]);
});
test('category discovery scopes brands and shows only relevant children for selected brands', () => {
  const result = catalogNavigation(products, categories, 'inverters', ['Solis']);
  assert.deepEqual(result.brands, ['Knox', 'Solis']);
  assert.deepEqual(result.groups.map((group) => group.id), ['hybrid']);
  assert.equal(result.groups[0].image, '/hybrid.webp');
});
test('leaf categories offer sibling navigation and root brand selections retain only relevant categories', () => {
  assert.deepEqual(catalogNavigation(products, categories, 'hybrid').groups.map((group) => group.id), ['hybrid', 'ongrid']);
  assert.deepEqual(catalogNavigation(products, categories, null, ['Jinko']).groups.map((group) => group.id), ['panels']);
});
test('category links preserve every selected brand and encode special characters', () => {
  const url = new URL(categoryBrowseHref('hybrid', ['A&B', 'Solis']), 'https://example.test');
  assert.equal(url.pathname, '/category/hybrid');
  assert.deepEqual(url.searchParams.getAll('brand'), ['A&B', 'Solis']);
});
