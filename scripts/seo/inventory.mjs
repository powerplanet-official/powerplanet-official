import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolveSeoRoute, metadataForRoute, sitemapPaths } from '../../lib/seo.mjs';

const source = process.argv[2] || 'data/catalog-source/solar-catalog.json';
const captured = readFileSync(source);
const snapshot = JSON.parse(source.endsWith('.gz') ? gunzipSync(captured).toString('utf8') : captured.toString('utf8'));
const data = { ...snapshot, settings: snapshot.settings || { name: 'Powerplanet' } };
const extra = [
  '/cart',
  '/checkout',
  '/wishlist',
  '/compare',
  ...data.categories.map((c) => `/category/${encodeURIComponent(c.id)}`),
];
const paths = [...new Set([...sitemapPaths(data), ...extra])];
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = [
  'path',
  'canonical',
  'indexable',
  'template',
  'primary_intent',
  'related_terms',
  'title',
  'description',
  'data_source',
];
const rows = [];
const issues = [];
const descriptionGroups = new Map();
for (const path of paths) {
  const url = new URL(path, 'https://powerplanet.pk');
  const route = resolveSeoRoute(data, url.pathname, url.searchParams);
  if (!route) continue;
  const metadata = metadataForRoute(route, data.settings);
  const related = route.product
    ? [route.product.brand, route.product.model].filter(Boolean).join('; ')
    : route.category
      ? `${route.category.name} specifications; ${route.category.name} quotation`
      : path.startsWith('/shop?brand=')
        ? `${url.searchParams.get('brand')} models; product specifications`
        : 'solar products; Lahore quotation';
  const intent = route.product
    ? `${route.product.name} specifications / quotation`
    : route.category
      ? `${route.category.name} Pakistan product selection`
      : path === '/contact'
        ? 'Powerplanet Lahore contact and address'
        : path === '/'
          ? 'Powerplanet solar products Pakistan'
          : route.title;
  rows.push([
    path,
    metadata.alternates.canonical,
    route.index,
    route.kind,
    intent,
    related,
    metadata.title.absolute,
    route.description,
    route.product
      ? 'public API products record; imported source snapshot; owner verification pending'
      : route.category
        ? 'public API categories plus matching products'
        : 'public API settings and existing visible page copy',
  ]);
}
for (const product of data.products) {
  const notes = [];
  if (!product.description || product.description.length < 80)
    notes.push('Description under 80 characters; expand only from verified model documentation.');
  const watts = [...product.name.matchAll(/\b(\d+(?:\.\d+)?)\s*W\b/gi)].map((match) =>
    Number(match[1]),
  );
  const specWatts = [
    ...(product.specs || '').matchAll(
      /(?:Power|Watts|Wattage|Rated Power)\s*:\s*(\d+(?:\.\d+)?)\s*W\b/gi,
    ),
  ].map((match) => Number(match[1]));
  if (watts.length && specWatts.length && !watts.some((value) => specWatts.includes(value)))
    notes.push(
      `Possible name/spec power mismatch: name ${watts.join('/')}W, specs ${specWatts.join('/')}W. Manual check required; heuristic, not an automatic correction.`,
    );
  if (product.image?.startsWith('/images/') && !existsSync(`public${product.image}`))
    notes.push('Primary image missing from repository.');
  const key = product.description?.trim();
  if (key) descriptionGroups.set(key, [...(descriptionGroups.get(key) || []), product.id]);
  if (notes.length)
    issues.push({
      id: product.id,
      name: product.name,
      url: `https://powerplanet.pk/product/${product.id}`,
      source: product.sourceUrl || product.source,
      notes,
    });
}
const duplicateDescriptions = [...descriptionGroups.values()].filter((ids) => ids.length > 1);
mkdirSync('docs/seo', { recursive: true });
writeFileSync(
  'docs/seo/route-metadata.csv',
  [columns, ...rows].map((row) => row.map(csv).join(',')).join('\n') + '\n',
);
writeFileSync(
  'docs/seo/catalog-review.json',
  JSON.stringify(
    {
      source,
      note: 'Review queue, not verified corrections. Imported claims and stock need merchant confirmation. Existing visible product data have not been changed.',
      issues,
      duplicateDescriptions,
    },
    null,
    2,
  ),
);
const titles = new Set(rows.map((row) => row[6]));
const descriptions = new Set(rows.map((row) => row[7]));
const summary = {
  source,
  publicProducts: data.products.filter((p) => p.status !== 'draft').length,
  categories: data.categories.length,
  brands: new Set(data.products.map((p) => p.brand).filter(Boolean)).size,
  sitemapUrls: sitemapPaths(data).length,
  mappedRoutes: rows.length,
  uniqueTitles: titles.size,
  uniqueDescriptions: descriptions.size,
  emptyOrPrivateRoutes: rows.filter((row) => !row[2]).map((row) => row[0]),
  catalogReviewRows: issues.length,
  duplicateDescriptionGroups: duplicateDescriptions.length,
};
writeFileSync('docs/seo/catalog-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
