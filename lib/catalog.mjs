import { searchProducts } from './search.mjs';

export function categoryIdsFor(categories, id) {
  const ids = new Set(id ? [id] : categories.map((category) => category.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}
export function inCategory(product, ids) {
  return [product.categoryId, ...(product.categoryIds || [])].some((id) => ids.has(id));
}
export function available(product) {
  return product.availability ? product.availability === 'in-stock' : product.stock > 0;
}
export const availabilityLabel = {
  'in-stock': 'In Stock',
  'out-of-stock': 'Out of Stock',
  'on-request': 'On Request',
};
export const productAvailability = (product) =>
  product.availability || (product.stock > 0 ? 'in-stock' : 'out-of-stock');
export const priceLabel = (number) =>
  number == null ? 'Request price' : `Rs. ${Number(number).toLocaleString('en-PK')}/-`;

export function catalogSelection(products, categories, categoryId, params) {
  const ids = categoryIdsFor(categories, categoryId);
  const query = (params.get('q') || '').trim();
  const brands = params.getAll('brand');
  const categoryFilters = params.getAll('category').filter((id) => ids.has(id));
  const subcategoryIds = new Set(
    categoryFilters.flatMap((id) => [...categoryIdsFor(categories, id)]),
  );
  const availability = [
    ...new Set([
      ...params.getAll('availability').filter((value) => value in availabilityLabel),
      ...(params.has('available') ? ['in-stock'] : []),
    ]),
  ];
  const parsePrice = (key) => {
    const value = params.get(key);
    return value !== null &&
      value.trim() !== '' &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0
      ? Number(value)
      : null;
  };
  const min = parsePrice('min');
  const max = parsePrice('max');
  const base = searchProducts(
    products.filter((product) => inCategory(product, ids)),
    query,
  );
  const matchesBrand = (product) => !brands.length || brands.includes(product.brand);
  const matchesCategory = (product) => !subcategoryIds.size || inCategory(product, subcategoryIds);
  const matchesAvailability = (product) =>
    !availability.length || availability.includes(productAvailability(product));
  const matchesPrice = (product) =>
    (min === null || (product.price != null && product.price >= min)) &&
    (max === null || (product.price != null && product.price <= max));
  const counts = (items, key) => {
    const values = new Map();
    for (const product of items) {
      const value = key(product);
      if (value) values.set(value, (values.get(value) || 0) + 1);
    }
    return values;
  };
  // Each facet respects all other filters, but allows changing its own selection.
  const brandCounts = counts(
    base.filter(
      (product) =>
        matchesCategory(product) && matchesAvailability(product) && matchesPrice(product),
    ),
    (product) => product.brand,
  );
  for (const brand of brands) if (!brandCounts.has(brand)) brandCounts.set(brand, 0);
  const availabilityCounts = counts(
    base.filter(
      (product) => matchesBrand(product) && matchesCategory(product) && matchesPrice(product),
    ),
    productAvailability,
  );
  const categoryBase = base.filter(
    (product) => matchesBrand(product) && matchesAvailability(product) && matchesPrice(product),
  );
  const selected = base.filter(
    (product) =>
      matchesBrand(product) &&
      matchesCategory(product) &&
      matchesAvailability(product) &&
      matchesPrice(product),
  );
  const sort = params.get('sort') || 'default';
  selected.sort((a, b) => {
    if (sort === 'price-low' || sort === 'price-high') {
      if (a.price == null) return b.price == null ? 0 : 1;
      if (b.price == null) return -1;
      return sort === 'price-low' ? a.price - b.price : b.price - a.price;
    }
    if (sort === 'name-desc') return b.name.localeCompare(a.name);
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'model')
      return (a.model || '').localeCompare(b.model || '', undefined, { numeric: true });
    if (sort === 'model-desc')
      return (b.model || '').localeCompare(a.model || '', undefined, { numeric: true });
    // searchProducts already ranked matches; stable sort preserves relevance.
    if (query) return 0;
    return (
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name)
    );
  });
  const limit = [20, 25, 50, 75, 100].includes(Number(params.get('limit')))
    ? Number(params.get('limit'))
    : 20;
  const pages = Math.max(1, Math.ceil(selected.length / limit));
  const page = Math.min(pages, Math.max(1, parseInt(params.get('page') || '1') || 1));
  return {
    base,
    selected,
    visible: selected.slice((page - 1) * limit, page * limit),
    brandCounts: [...brandCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
    availabilityCounts,
    categoryBase,
    categoryFilters,
    availability,
    limit,
    pages,
    page,
    brands,
  };
}
