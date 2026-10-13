import { catalogSelection, categoryIdsFor, inCategory } from './catalog.mjs';
import { absoluteUrl, siteOrigin, storeAddress } from './site-config.mjs';

export const staticPages = {
  '/': [
    'Solar Panels, Inverters & Batteries in Pakistan',
    'Explore solar panels, inverters, batteries and accessories from Powerplanet. Browse the catalog and contact our Lahore team for a quotation.',
  ],
  '/shop': [
    'Solar Products in Pakistan',
    'Browse solar panels, inverters, batteries and accessories at Powerplanet. Compare product specifications and request a quotation from our Lahore team.',
  ],
  '/about': [
    'About Powerplanet',
    'Explore Powerplanet’s solar product catalog, including panels, inverters, batteries and accessories. Contact our Lahore team to discuss your requirements.',
  ],
  '/contact': [
    'Contact Powerplanet in Lahore',
    'Contact Powerplanet at E-175, New Airport Road Main, Bhatta Chowk, Lahore. Ask about solar products, specifications and quotations.',
  ],
  '/quote': [
    'Request a Solar Product Quotation',
    'Request a quotation from Powerplanet for solar panels, inverters, batteries or accessories. Share your requirements with our Lahore team.',
  ],
  '/cart': ['Shopping Basket', 'Review your Powerplanet shopping basket.'],
  '/checkout': ['Checkout', 'Complete your Powerplanet order.'],
  '/wishlist': ['My Wishlist', 'View your saved Powerplanet products.'],
  '/compare': ['Compare Solar Products', 'Compare your selected Powerplanet products.'],
};
const privatePages = new Set(['/cart', '/checkout', '/wishlist', '/compare']);
const catalogParams = new Set([
  'brand',
  'category',
  'q',
  'availability',
  'available',
  'min',
  'max',
  'sort',
  'view',
  'limit',
  'page',
]);
const plainText = (value = '') =>
  String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const excerpt = (value, max = 165) => {
  const text = plainText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

export function toSearchParams(input = {}) {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) params.append(key, item);
    }
  }
  return params;
}

function categoryTrail(categories, category) {
  const trail = [];
  const seen = new Set();
  while (category && !seen.has(category.id)) {
    seen.add(category.id);
    trail.unshift({ name: category.name, path: `/category/${encodeURIComponent(category.id)}` });
    category = categories.find((item) => item.id === category.parentId);
  }
  return trail;
}

// This is the single route policy used by metadata, JSON-LD, sitemap and tests.
// Preserve established product IDs: renaming every product URL would break links.
export function resolveSeoRoute(data, path = '/', search = {}) {
  const params = toSearchParams(search);
  const segments = path.split('/').filter(Boolean);
  const product =
    segments.length === 2 && segments[0] === 'product'
      ? data.products.find(
          (item) => item.id === decodeURIComponent(segments[1]) && item.status !== 'draft',
        )
      : null;
  const category =
    segments.length === 2 && segments[0] === 'category'
      ? data.categories.find((item) => item.id === decodeURIComponent(segments[1]))
      : null;
  if (!staticPages[path] && !product && !category) return null;

  let [title, description] = staticPages[path] || ['', ''];
  let index = !privatePages.has(path);
  let canonicalPath = path;
  let selection;
  let kind = product ? 'product' : category || path === '/shop' ? 'catalog' : 'page';
  const breadcrumbs = [{ name: 'Home', path: '/' }];
  if (kind === 'catalog') {
    selection = catalogSelection(data.products, data.categories, category?.id, params);
    const requestedPage = params.get('page');
    if (
      requestedPage &&
      (!/^[1-9]\d*$/.test(requestedPage) || Number(requestedPage) > selection.pages)
    )
      return null;
    const singleBrand =
      path === '/shop' &&
      selection.brands.length === 1 &&
      data.products.some((item) => item.brand === selection.brands[0]);
    const filtered = [...params.keys()].some(
      (key) => catalogParams.has(key) && !['brand', 'page'].includes(key),
    );
    index =
      selection.selected.some((item) => item.status === 'published') &&
      !filtered &&
      (!selection.brands.length || singleBrand);
    const heading = params.get('q')
      ? `Search results for “${params.get('q')}”`
      : category?.name ||
        (singleBrand ? `${selection.brands[0]} Solar Products` : 'Solar Products');
    title = `${heading} in Pakistan`;
    description = `Browse ${heading.toLowerCase()} at Powerplanet. View listed models and specifications, and contact our Lahore team for a quotation.`;
    if (selection.page > 1) {
      title += ` – Page ${selection.page}`;
      description = `Page ${selection.page}: ${description}`;
    }
    const canonicalParams = new URLSearchParams();
    // Sorting and display size are duplicate presentations. Meaningful filters
    // keep a normalized self-canonical and noindex, instead of claiming equivalence.
    for (const key of [...catalogParams].sort()) {
      if (['sort', 'view', 'limit', 'page'].includes(key)) continue;
      for (const value of [...new Set(params.getAll(key))].sort()) {
        if (value) canonicalParams.append(key, value);
      }
    }
    if (selection.page > 1) canonicalParams.set('page', String(selection.page));
    // A nondefault page size changes the content of each page.
    if (selection.limit !== 20) canonicalParams.set('limit', String(selection.limit));
    canonicalPath += canonicalParams.size ? `?${canonicalParams}` : '';
    if (category)
      breadcrumbs.push(
        { name: 'Solar Products', path: '/shop' },
        ...categoryTrail(data.categories, category),
      );
    else breadcrumbs.push({ name: heading, path: canonicalPath });
  } else if (product) {
    index = product.status === 'published';
    title = product.name;
    const duplicateName = data.products.some(
      (item) =>
        item.id !== product.id &&
        item.name.trim().toLowerCase() === product.name.trim().toLowerCase(),
    );
    if (duplicateName) title += ` – ${product.id}`;
    // Imported specs may conflict with a model name. Keep the snippet factual
    // and direct readers to the unchanged specification sheet for confirmation.
    description = `${title}. View listed specifications and request a quotation from Powerplanet in Lahore, Pakistan. Confirm current availability with our team.`;
    breadcrumbs.push(
      { name: 'Solar Products', path: '/shop' },
      ...categoryTrail(
        data.categories,
        data.categories.find((item) => item.id === product.categoryId),
      ),
      { name: product.name, path },
    );
  } else if (path !== '/') breadcrumbs.push({ name: title, path });
  if (path === '/contact')
    description = `Contact Powerplanet at ${storeAddress(data.settings)}. Ask about solar products, specifications and quotations.`;
  return {
    path,
    kind,
    title: plainText(title),
    description: excerpt(description),
    index,
    canonicalPath,
    product,
    category,
    selection,
    breadcrumbs,
  };
}

export function metadataForRoute(route, settings) {
  const title = `${route.title} | ${settings.name || 'Powerplanet'}`;
  const image = route.product?.image || '/images/powerplanet-logo-original.jpeg';
  return {
    title: { absolute: title },
    description: route.description,
    alternates: { canonical: absoluteUrl(route.canonicalPath) },
    robots: { index: route.index, follow: true },
    openGraph: {
      type: 'website',
      locale: 'en_PK',
      siteName: settings.name || 'Powerplanet',
      title,
      description: route.description,
      url: absoluteUrl(route.canonicalPath),
      images: [{ url: absoluteUrl(image), alt: route.product?.name || 'Powerplanet logo' }],
    },
    twitter: {
      card: 'summary',
      title,
      description: route.description,
      images: [absoluteUrl(image)],
    },
  };
}

export function structuredDataForRoute(route, data) {
  const nodes = [];
  if (route.path === '/') {
    const { settings } = data;
    nodes.push(
      {
        '@type': 'Organization',
        '@id': `${siteOrigin}/#organization`,
        name: settings.name || 'Powerplanet',
        url: absoluteUrl('/'),
        logo: absoluteUrl('/api/branding/logo'),
        ...(settings.phone ? { telephone: settings.phone } : {}),
        ...(settings.email ? { email: settings.email } : {}),
        address: storeAddress(settings),
        ...(settings.facebook ? { sameAs: [settings.facebook] } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${siteOrigin}/#website`,
        url: absoluteUrl('/'),
        name: settings.name || 'Powerplanet',
        inLanguage: 'en-PK',
        publisher: { '@id': `${siteOrigin}/#organization` },
      },
    );
  }
  if (route.breadcrumbs.length > 1 && route.index)
    nodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: route.breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    });
  if (route.product && route.index) {
    const product = route.product;
    nodes.push({
      '@type': 'Product',
      '@id': `${absoluteUrl(route.path)}#product`,
      url: absoluteUrl(route.path),
      name: product.name,
      description: plainText(product.description || route.description),
      sku: product.id,
      image: [...new Set([product.image, ...(product.images || [])].filter(Boolean))].map(
        absoluteUrl,
      ),
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(product.model ? { model: product.model } : {}),
      // The source snapshot is not merchant-confirmed stock or pricing. Do not
      // fabricate Offers, ratings, warranties or Google rich-result eligibility.
    });
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export const serializeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export function sitemapPaths(data) {
  const products = data.products.filter((product) => product.status === 'published');
  const categories = data.categories.filter((category) => {
    const ids = categoryIdsFor(data.categories, category.id);
    return products.some((product) => inCategory(product, ids));
  });
  return [
    ...Object.keys(staticPages).filter((path) => !privatePages.has(path)),
    ...categories.map((category) => `/category/${encodeURIComponent(category.id)}`),
    ...products.map((product) => `/product/${encodeURIComponent(product.id)}`),
    ...[...new Set(products.map((product) => product.brand).filter(Boolean))]
      .sort()
      .map((brand) => `/shop?${new URLSearchParams({ brand })}`),
  ];
}
