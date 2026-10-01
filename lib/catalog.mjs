export function categoryIdsFor(categories, id) {
  const ids = new Set(id ? [id] : categories.map(c => c.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) if (ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); changed = true; }
  }
  return ids;
}
export function inCategory(product, ids) {
  return [product.categoryId, ...(product.categoryIds || [])].some(id => ids.has(id));
}
export function available(product) {
  return product.availability ? product.availability === 'in-stock' : product.stock > 0;
}
export const priceLabel = n => n == null ? 'Request price' : `Rs. ${Number(n).toLocaleString('en-PK')}/-`;
export function catalogSelection(products, categories, categoryId, params) {
  const ids = categoryIdsFor(categories, categoryId);
  const query = (params.get('q') || '').trim().toLowerCase();
  const brands = params.getAll('brand');
  const base = products.filter(p => p.status !== 'draft' && inCategory(p, ids) && (!query || `${p.name} ${p.brand} ${p.model || ''}`.toLowerCase().includes(query)));
  const brandCounts = new Map();
  for (const p of base) if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  const selected = base.filter(p => (!brands.length || brands.includes(p.brand)) && (!params.has('available') || available(p)) && (!params.get('min') || (p.price !== null && p.price >= Number(params.get('min')))) && (!params.get('max') || (p.price !== null && p.price <= Number(params.get('max')))));
  const sort = params.get('sort') || 'default';
  selected.sort((a,b) => {
    if (sort.startsWith('price')) { if (a.price == null) return b.price == null ? 0 : 1; if (b.price == null) return -1; return sort === 'price-low' ? a.price-b.price : b.price-a.price; }
    if (sort === 'name-desc') return b.name.localeCompare(a.name);
    if (sort === 'name') return a.name.localeCompare(b.name);
    return Number(b.featured)-Number(a.featured) || a.name.localeCompare(b.name);
  });
  const limit = [20,25,50,75,100].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 20;
  const pages = Math.max(1, Math.ceil(selected.length/limit));
  const page = Math.min(pages, Math.max(1, parseInt(params.get('page') || '1') || 1));
  return {base, selected, visible:selected.slice((page-1)*limit,page*limit), brandCounts:[...brandCounts.entries()].sort(([a],[b])=>a.localeCompare(b)), limit, pages, page, brands};
}
