'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProductPrice from './ProductPrice';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Grid3X3,
  List,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Mail,
  Heart,
  SlidersHorizontal,
  X,
  Check,
  ShoppingCart,
} from 'lucide-react';
import {
  available,
  availabilityLabel,
  catalogSelection,
  categoryIdsFor,
  inCategory,
} from '../lib/catalog.mjs';

// Respect each product’s minimum order and the basket limit of 100 units.
export function Quantity({ value, onChange, min = 1, name = 'Quantity' }) {
  return (
    <div className="reference-stepper">
      <input
        type="number"
        min={min}
        max={100}
        step={1}
        aria-label={name}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value === ''
              ? ''
              : Math.min(100, Math.max(min, Math.floor(Number(e.target.value)))),
          )
        }
        onBlur={() => onChange(Math.min(100, Math.max(min, Number(value) || min)))}
      />
      <span>
        <button
          type="button"
          aria-label={`Increase ${name}`}
          onClick={() => onChange(Math.min(100, Number(value) + 1))}
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${name}`}
          onClick={() => onChange(Math.max(min, Number(value) - 1))}
        >
          <ChevronDown size={15} />
        </button>
      </span>
    </div>
  );
}
// Catalog cards keep quantity, wishlist, comparison, and inquiry actions together.
export function ListingCard({ p, add, wish, compare, wished, compared, inquiry }) {
  const minimum = p.minQuantity || 1;
  const [quantity, setQuantity] = useState(minimum);
  const [imageError, setImageError] = useState(false);
  return (
    <article className="reference-product-card" data-product-id={p.id}>
      <div className="reference-product-image">
        <Link href={`/product/${p.id}`} aria-label={p.name}>
          {imageError ? (
            <span className="photo-unavailable">Product photo unavailable</span>
          ) : (
            <img src={p.image} alt={p.name} loading="lazy" onError={() => setImageError(true)} />
          )}
        </Link>
        <div className="reference-card-actions">
          <button onClick={wish} aria-label={`Save ${p.name}`} aria-pressed={wished}>
            <Heart size={17} fill={wished ? 'currentColor' : 'none'} />
          </button>
          <button onClick={compare} aria-label={`Compare ${p.name}`} aria-pressed={compared}>
            <ArrowLeftRight size={17} />
          </button>
        </div>
        {p.status !== 'preview' && p.price != null && p.originalPrice > p.price && (
          <span className="reference-sale">SALE</span>
        )}
      </div>
      <div className="reference-card-info">
        <Link className="reference-product-name" href={`/product/${p.id}`}>
          {p.name}
        </Link>
        <p className="reference-list-description">{p.description}</p>
        <ProductPrice product={p} />
        <div className="reference-cart-group">
          <Quantity
            value={quantity}
            onChange={setQuantity}
            min={minimum}
            name={`Quantity for ${p.name}`}
          />
          <button
            className="reference-cart-button"
            onClick={() => add(p, Math.max(minimum, Number(quantity) || minimum))}
          >
            ADD TO CART
          </button>
        </div>
        <button
          className="reference-inquiry"
          onClick={() => inquiry(p, Math.max(minimum, Number(quantity) || minimum))}
        >
          <Mail size={17} /> SEND INQUIRY
        </button>
      </div>
    </article>
  );
}

// Filters live in the URL so catalog selections can be shared and revisited.
export default function SolarCatalog({
  products,
  categories,
  category,
  add,
  wishlist,
  compareIds,
  onWish,
  onCompare,
  inquiry,
}) {
  const urlParams = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  // Reflect rapid filter changes immediately while the router finishes navigation.
  const [pendingQuery, setPendingQuery] = useState(null);
  const params = useMemo(
    () => new URLSearchParams(pendingQuery ?? urlParams.toString()),
    [pendingQuery, urlParams],
  );
  useEffect(() => setPendingQuery(null), [urlParams]);
  const result = catalogSelection(products, categories, category?.id, params);
  const [filtersOpen, setFiltersOpen] = useState(false),
    [brandSearch, setBrandSearch] = useState('');
  const [min, setMin] = useState(params.get('min') || ''),
    [max, setMax] = useState(params.get('max') || '');
  useEffect(() => {
    setMin(params.get('min') || '');
    setMax(params.get('max') || '');
  }, [params]);
  useEffect(() => setFiltersOpen(false), [pathname]);
  function update(key, value, multiple = false) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (key === 'availability' && next.has('available')) {
      next.delete('available');
      if (!next.getAll('availability').includes('in-stock'))
        next.append('availability', 'in-stock');
    }
    if (multiple) {
      const old = next.getAll(key);
      next.delete(key);
      (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]).forEach((v) =>
        next.append(key, v),
      );
    } else {
      next.delete(key);
      if (value) next.set(key, value);
    }
    setPendingQuery(next.toString());
    router.push(`${pathname}${next.size ? '?' + next : ''}`, { scroll: false });
  }
  function clear() {
    const next = new URLSearchParams();
    if (params.get('q')) next.set('q', params.get('q'));
    setPendingQuery(next.toString());
    router.push(`${pathname}${next.size ? '?' + next : ''}`, { scroll: false });
    setBrandSearch('');
  }
  function clearPrice() {
    const next = new URLSearchParams(params);
    ['min', 'max', 'page'].forEach((key) => next.delete(key));
    setPendingQuery(next.toString());
    router.push(`${pathname}${next.size ? '?' + next : ''}`, { scroll: false });
  }
  const root = category?.parentId ? categories.find((c) => c.id === category.parentId) : category;
  // Only offer descendants of the current category; sibling filters would
  // otherwise be impossible to satisfy inside the current listing.
  const related = categories.filter((c) => (category ? c.parentId === category.id : !c.parentId));
  const active = !!(
    result.brands.length ||
    result.availability.length ||
    result.categoryFilters.length ||
    params.get('min') ||
    params.get('max')
  );
  const title = params.get('q')
    ? `Search results for “${params.get('q')}”`
    : category?.name ||
      (result.brands.length === 1 ? `${result.brands[0]} Solar Products` : 'Solar Products');
  return (
    <section className="reference-catalog">
      <h1 className="reference-catalog-title">{title}</h1>
      <div className="reference-catalog-layout">
        <aside
          className={`reference-filters ${filtersOpen ? 'is-open' : ''}`}
          aria-label="Product filters"
        >
          <div className="reference-filter-title">
            <h2>FILTER</h2>
            <button onClick={clear} aria-label="Clear filters">
              <X size={12} /> Clear
            </button>
          </div>
          <details open className="reference-filter-section">
            <summary>
              Brands <ChevronDown size={19} />
            </summary>
            {(result.brandCounts.length > 8 || brandSearch) && (
              <input
                className="brand-filter-search"
                aria-label="Find a brand"
                placeholder="Find a brand…"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
              />
            )}
            <div className="reference-filter-options">
              {result.brandCounts
                .filter(([b]) => b.toLowerCase().includes(brandSearch.toLowerCase()))
                .map(([brand, count]) => (
                  <label key={brand}>
                    <input
                      type="checkbox"
                      checked={result.brands.includes(brand)}
                      onChange={() => update('brand', brand, true)}
                    />
                    <span>{brand}</span>
                    <small>{count}</small>
                  </label>
                ))}
              {!result.brandCounts.length && <p>No brands in this category.</p>}
            </div>
          </details>
          <details open className="reference-filter-section">
            <summary>
              Availability <ChevronDown size={19} />
            </summary>
            {Object.entries(availabilityLabel).map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={result.availability.includes(value)}
                  onChange={() => update('availability', value, true)}
                />
                <span>{label}</span>
                <small>{result.availabilityCounts.get(value) || 0}</small>
              </label>
            ))}
          </details>
          <details open className="reference-filter-section">
            <summary>
              {category ? 'Subcategories' : 'Categories'} <ChevronDown size={19} />
            </summary>
            <div className="reference-category-filter">
              {category && (
                <Link href={root && root.id !== category.id ? `/category/${root.id}` : '/shop'}>
                  <ChevronLeft size={14} />{' '}
                  {root && root.id !== category.id ? root.name : 'All solar products'}
                </Link>
              )}
              {related.map((c) => {
                const ids = categoryIdsFor(categories, c.id);
                const count = result.categoryBase.filter((product) =>
                  inCategory(product, ids),
                ).length;
                return (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={result.categoryFilters.includes(c.id)}
                      onChange={() => update('category', c.id, true)}
                    />
                    <span>{c.name}</span>
                    <small>{count}</small>
                  </label>
                );
              })}
            </div>
          </details>
          <details open className="reference-filter-section">
            <summary>
              Price (PKR) <ChevronDown size={19} />
            </summary>
            <form
              className="reference-price-filter"
              onSubmit={(e) => {
                e.preventDefault();
                const next = new URLSearchParams(params);
                next.delete('page');
                for (const [k, v] of [
                  ['min', min],
                  ['max', max],
                ]) {
                  next.delete(k);
                  if (v !== '') next.set(k, v);
                }
                setPendingQuery(next.toString());
                router.push(`${pathname}?${next}`, { scroll: false });
              }}
            >
              <input
                aria-label="Minimum price"
                type="number"
                min={0}
                placeholder="Min"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
              <input
                aria-label="Maximum price"
                type="number"
                min={min || 0}
                placeholder="Max"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
              <button type="submit">Apply</button>
            </form>
          </details>
        </aside>
        <div className="reference-results">
          <div className="reference-toolbar">
            <div className="reference-view-controls">
              <button
                className="reference-mobile-filter"
                onClick={() => setFiltersOpen(!filtersOpen)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={19} /> Filters
              </button>
              <button
                aria-label="Grid view"
                aria-pressed={params.get('view') !== 'list'}
                onClick={() => update('view', '')}
              >
                <Grid3X3 size={23} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={params.get('view') === 'list'}
                onClick={() => update('view', 'list')}
              >
                <List size={25} />
              </button>
              <Link href="/compare">
                <ArrowLeftRight size={22} /> <span>Product Compare</span>
                <b>{compareIds.length}</b>
              </Link>
            </div>
            <div className="reference-sort-controls">
              <label>
                Sort By:
                <select
                  aria-label="Sort products"
                  value={params.get('sort') || 'default'}
                  onChange={(e) => update('sort', e.target.value)}
                >
                  <option value="default">{params.get('q') ? 'Relevance' : 'Default'}</option>
                  <option value="name">Name (A – Z)</option>
                  <option value="name-desc">Name (Z – A)</option>
                  <option value="price-low">Price (Low → High)</option>
                  <option value="price-high">Price (High → Low)</option>
                  <option value="model">Model (A – Z)</option>
                  <option value="model-desc">Model (Z – A)</option>
                </select>
              </label>
              <label>
                Show:
                <select
                  aria-label="Products per page"
                  value={result.limit}
                  onChange={(e) => update('limit', e.target.value)}
                >
                  {[20, 25, 50, 75, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {active && (
            <div className="reference-active-filters">
              {result.brands.map((b) => (
                <button key={b} onClick={() => update('brand', b, true)}>
                  {b}
                  <X size={12} />
                </button>
              ))}
              {result.availability.map((value) => (
                <button key={value} onClick={() => update('availability', value, true)}>
                  {availabilityLabel[value]}
                  <X size={12} />
                </button>
              ))}
              {result.categoryFilters.map((id) => (
                <button key={id} onClick={() => update('category', id, true)}>
                  {categories.find((category) => category.id === id)?.name}
                  <X size={12} />
                </button>
              ))}
              {(params.get('min') || params.get('max')) && (
                <button onClick={clearPrice} aria-label="Remove price filter">
                  Price: {params.get('min') || '0'} – {params.get('max') || 'Any'}
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          {result.visible.length ? (
            <div
              className={`reference-product-grid ${params.get('view') === 'list' ? 'reference-list-view' : ''}`}
            >
              {result.visible.map((p) => (
                <ListingCard
                  key={p.id}
                  p={p}
                  add={add}
                  inquiry={inquiry}
                  wished={wishlist.includes(p.id)}
                  compared={compareIds.includes(p.id)}
                  wish={() => onWish(p.id)}
                  compare={() => onCompare(p.id)}
                />
              ))}
            </div>
          ) : (
            <div className="reference-empty">
              <h2>No products match these filters.</h2>
              <p>Try another brand, model or capacity, or clear the selected filters.</p>
              <button className="secondary" onClick={clear}>
                Clear filters
              </button>
              {params.get('q') && <Link href="/shop">Browse all solar products</Link>}
            </div>
          )}
          <div className="reference-pagination">
            <span>
              Showing {result.selected.length ? (result.page - 1) * result.limit + 1 : 0} to{' '}
              {Math.min(result.page * result.limit, result.selected.length)} of{' '}
              {result.selected.length} ({result.pages} {result.pages === 1 ? 'Page' : 'Pages'})
            </span>
            {result.pages > 1 && (
              <nav aria-label="Product pagination">
                <button
                  aria-label="Previous page"
                  disabled={result.page === 1}
                  onClick={() => update('page', String(result.page - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: result.pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === result.pages || Math.abs(n - result.page) < 2)
                  .map((n, i, ns) => (
                    <span key={n}>
                      {i > 0 && n - ns[i - 1] > 1 && <span className="pagination-ellipsis">…</span>}
                      <button
                        aria-current={n === result.page ? 'page' : undefined}
                        onClick={() => update('page', String(n))}
                      >
                        {n}
                      </button>
                    </span>
                  ))}
                <button
                  aria-label="Next page"
                  disabled={result.page === result.pages}
                  onClick={() => update('page', String(result.page + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Build category and brand links from the catalog rather than maintaining a separate menu.
export function SolarMegaMenu({ categories, products, onNavigate }) {
  const preferred = [
    'Knox',
    'Solis',
    'Volnex',
    'PylonTech',
    'Ecoflow',
    'Goodwe',
    'Itel Energy',
    'Ziewnic',
    'Dyness',
    'Inverex',
    'BYD',
    'Jinko',
    'SolarMax',
    'Astronergy Solar',
    'Dongjin Power',
    'MaxPower',
    'Crown Solar Energy',
  ];
  const allBrands = [
    ...new Set(products.filter((p) => p.status !== 'draft').map((p) => p.brand)),
  ].filter(Boolean);
  const brands = allBrands.sort((a, b) => {
    const ai = preferred.findIndex((v) => v.toLowerCase() === a.toLowerCase()),
      bi = preferred.findIndex((v) => v.toLowerCase() === b.toLowerCase());
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
  });
  const names = {
    'solar-panels': 'Solar Panel',
    'portable-systems': 'Solar Portable Home System’s',
    'solar-inverters': 'Solar Inverter',
    'other-solar': 'Other Solar Products',
    'solar-batteries': 'Solar Batteries',
    'solar-accessories': 'Shop By Accessories',
  };
  function group(id) {
    return (
      <section key={id}>
        <h3>
          <Link href={`/category/${id}`} onClick={onNavigate}>
            {names[id]}
          </Link>
        </h3>
        {categories
          .filter(
            (c) =>
              c.parentId === id &&
              (!categories.some((s) => s.parentId === id && s.sourceUrl) || c.sourceUrl),
          )
          .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
          .map((c) => (
            <Link key={c.id} href={`/category/${c.id}`} onClick={onNavigate}>
              <ChevronRight size={16} />
              {c.name}
            </Link>
          ))}
        {['solar-inverters', 'solar-batteries'].includes(id) && (
          <Link href="/category/solar-combo-deals" onClick={onNavigate}>
            <ChevronRight size={16} />
            Solar Combo Deals
          </Link>
        )}
        <Link className="solar-menu-see-all" href={`/category/${id}`} onClick={onNavigate}>
          <ChevronRight size={16} />
          See All
        </Link>
      </section>
    );
  }
  return (
    <div className="solar-mega-menu">
      <div className="solar-mega-brands">
        <h3>Shop By Brands</h3>
        {brands.map((b) => (
          <Link href={`/shop?brand=${encodeURIComponent(b)}`} key={b} onClick={onNavigate}>
            <ChevronRight size={16} />
            {b}
          </Link>
        ))}
      </div>
      <div className="solar-mega-column">
        {group('solar-panels')}
        {group('portable-systems')}
      </div>
      <div className="solar-mega-column">
        {group('solar-inverters')}
        {group('other-solar')}
      </div>
      <div className="solar-mega-column">
        {group('solar-batteries')}
        {group('solar-accessories')}
      </div>
    </div>
  );
}

// Detail view adds the image gallery and specifications to the shared buying controls.
export function SolarProductDetail({ p, categories, add, wish, inquiry }) {
  const [quantity, setQuantity] = useState(p.minQuantity || 1),
    [photo, setPhoto] = useState(p.image);
  useEffect(() => {
    setQuantity(p.minQuantity || 1);
    setPhoto(p.image);
  }, [p.id, p.image, p.minQuantity]);
  return (
    <>
      <div className="product-detail imported-product-detail">
        <div>
          <div className="detail-image">
            <img src={photo} alt={p.name} />
          </div>
          {p.images?.length > 1 && (
            <div className="product-gallery-thumbs">
              {p.images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setPhoto(src)}
                  aria-label={`Product photo ${i + 1}`}
                  aria-pressed={photo === src}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Link className="eyebrow" href={`/shop?brand=${encodeURIComponent(p.brand)}`}>
            {p.brand}
          </Link>
          <h1>{p.name}</h1>
          <ProductPrice product={p} className="detail-prices" />
          <p>{p.description}</p>
          <div className="detail-meta">
            <p>
              <b>Brand:</b>{' '}
              <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`}>{p.brand}</Link>
            </p>
            <p>
              <b>Model:</b> {p.model || p.id}
            </p>
            <p>
              <b>Availability:</b>{' '}
              {available(p)
                ? 'In Stock'
                : p.availability === 'out-of-stock'
                  ? 'Out of Stock'
                  : 'Available on request'}
            </p>
            <p>
              <b>Category:</b>{' '}
              <Link href={`/category/${p.categoryId}`}>
                {categories.find((c) => c.id === p.categoryId)?.name}
              </Link>
            </p>
            {p.minQuantity > 1 && (
              <p>
                <b>Minimum quantity:</b> {p.minQuantity}
              </p>
            )}
          </div>
          <div className="reference-detail-cart">
            <Quantity value={quantity} onChange={setQuantity} min={p.minQuantity || 1} />
            <button
              className="reference-cart-button"
              onClick={() => add(p, Number(quantity) || p.minQuantity || 1)}
            >
              <ShoppingCart size={17} /> ADD TO CART
            </button>
            <button className="secondary" onClick={wish} aria-label="Save product">
              <Heart size={18} />
            </button>
          </div>
          <button
            className="reference-detail-inquiry"
            onClick={() => inquiry(p, Number(quantity) || p.minQuantity || 1)}
          >
            <Mail size={17} /> SEND INQUIRY
          </button>
          {p.sourceCheckedAt && (
            <p className="price-updated">
              Price checked{' '}
              {new Date(p.sourceCheckedAt).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              . Confirm current availability with our team.
            </p>
          )}
        </div>
      </div>
      <div className="specifications">
        <h2>Product specifications</h2>
        <p>{p.specs}</p>
      </div>
    </>
  );
}
