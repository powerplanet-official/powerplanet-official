import { categoryIdsFor, inCategory } from './catalog.mjs';

// Navigation counts ignore stock and price filters: customers can still discover
// the rest of a brand's range, including items available on request.
export function catalogNavigation(products, categories, categoryId, selectedBrands = []) {
  const visible = products.filter((product) => product.status !== 'draft');
  const scopeIds = categoryIdsFor(categories, categoryId);
  const scoped = visible.filter((product) =>
    inCategory(product, scopeIds),
  );
  const brands = [...new Set(scoped.map((product) => product.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const selected = selectedBrands.length
    ? visible.filter((product) => selectedBrands.includes(product.brand))
    : visible;
  const current = categories.find((category) => category.id === categoryId);
  const hasChildren = categories.some((category) => category.parentId === categoryId);
  const parentId = current ? (hasChildren ? current.id : current.parentId) : null;
  const groups = categories
    .filter((category) => (category.parentId || null) === (parentId || null))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map((category) => {
      const ids = categoryIdsFor(categories, category.id);
      const matches = selected.filter((product) => inCategory(product, ids));
      return {
        ...category,
        count: matches.length,
        image: matches.find((product) => product.image)?.image,
      };
    })
    .filter((category) => category.count > 0);
  return { brands, groups };
}

export function categoryBrowseHref(categoryId, brands = []) {
  const params = new URLSearchParams();
  brands.forEach((brand) => params.append('brand', brand));
  return `/category/${encodeURIComponent(categoryId)}${params.size ? `?${params}` : ''}`;
}
