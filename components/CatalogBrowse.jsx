'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PanelsTopLeft } from 'lucide-react';
import brandAssets from '../lib/featured-brands.json';
import panelBrands from '../lib/solar-mobile-brands.json';
import { catalogNavigation, categoryBrowseHref } from '../lib/catalog-navigation.mjs';

const logos = new Map(
  [...brandAssets, ...panelBrands].map((brand) => [brand.name.toLowerCase(), brand.image]),
);
const featuredOrder = [...brandAssets, ...panelBrands].map((brand) => brand.name.toLowerCase());
const categoryArtwork = {
  'solar-panels': '/images/solar-home/solar-panels.png',
  'solar-inverters': '/images/solar-home/hybrid-inverters.png',
  'solar-batteries': '/images/solar-home/lithium-batteries.png',
};

function BrandImage({ brand }) {
  const [failed, setFailed] = useState(false);
  const image = logos.get(brand.toLowerCase());
  return image && !failed ? (
    <img
      src={image}
      alt={brand}
      width="120"
      height="80"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="browse-brand-name">{brand}</span>
  );
}

function CategoryImage({ category }) {
  const [failed, setFailed] = useState(false);
  const source = categoryArtwork[category.id] || category.image;
  return source && !failed ? (
    <img
      src={source}
      alt=""
      width="120"
      height="120"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <PanelsTopLeft size={40} aria-hidden="true" />
  );
}

// Keep brand and category discovery above the listing on both screen sizes.
export default function CatalogBrowse({ products, categories, category, brands, onBrand }) {
  const [showAll, setShowAll] = useState(false);
  const navigation = useMemo(
    () => catalogNavigation(products, categories, category?.id, brands),
    [products, categories, category?.id, brands],
  );
  const orderedBrands = [...navigation.brands].sort(
    (a, b) =>
      Number(logos.has(b.toLowerCase())) - Number(logos.has(a.toLowerCase())) ||
      featuredOrder.indexOf(a.toLowerCase()) - featuredOrder.indexOf(b.toLowerCase()) ||
      a.localeCompare(b),
  );
  // Always keep selected brands visible, even when the full directory is collapsed.
  const shownBrands = showAll
    ? orderedBrands
    : orderedBrands.filter((brand, index) => index < 16 || brands.includes(brand));
  return (
    <div className="catalog-browse">
      {orderedBrands.length > 0 && (
        <section aria-label="Shop by brand">
          <div className="catalog-browse-heading">
            <h2>Shop by Brand</h2>
            <a href="#catalog-products">
              Skip to products <ChevronRight size={16} />
            </a>
          </div>
          <div className="browse-brand-grid">
            {shownBrands.map((brand) => (
              <button
                key={brand}
                type="button"
                aria-label={`Browse ${brand}`}
                aria-pressed={brands.includes(brand)}
                onClick={() => onBrand(brand)}
              >
                <BrandImage brand={brand} />
              </button>
            ))}
          </div>
          {orderedBrands.length > 16 && (
            <button
              className="browse-show-all"
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show fewer brands' : `View all ${orderedBrands.length} brands`}{' '}
              <ChevronDown size={16} />
            </button>
          )}
        </section>
      )}
      {navigation.groups.length > 0 && (
        <section aria-label="Browse solar categories">
          <div className="catalog-browse-heading">
            <h2>{brands.length === 1 ? `${brands[0]} Categories` : 'Shop by Category'}</h2>
            {category && (
              <Link
                href={
                  brands.length
                    ? `/shop?${new URLSearchParams(brands.map((brand) => ['brand', brand]))}`
                    : '/shop'
                }
              >
                All solar products
              </Link>
            )}
          </div>
          <div className="browse-category-grid">
            {navigation.groups.map((group) => (
              <Link
                key={group.id}
                href={categoryBrowseHref(group.id, brands)}
                aria-current={category?.id === group.id ? 'page' : undefined}
              >
                <span className="browse-category-photo">
                  <CategoryImage category={group} />
                </span>
                <strong>{group.name}</strong>
                <small>{group.count} products</small>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// A single scrolling mobile drawer replaces the desktop mega-menu's nested
// scrollbars. Native disclosure controls support touch and keyboard equally.
export function MobileCategoryMenu({ categories, products, onNavigate }) {
  const [brandSearch, setBrandSearch] = useState('');
  const { brands, groups } = useMemo(
    () => catalogNavigation(products, categories),
    [products, categories],
  );
  return (
    <div className="mobile-category-directory">
      <Link className="mobile-browse-all" href="/shop" onClick={onNavigate}>
        All solar products <ChevronRight size={18} />
      </Link>
      <h2>Shop by Category</h2>
      {groups.map((group) => (
        <details key={group.id} name="mobile-solar-category">
          <summary>
            <span className="mobile-category-icon">
              <CategoryImage category={group} />
            </span>
            <span>
              {group.name}
              <small>{group.count} products</small>
            </span>
            <ChevronDown size={18} />
          </summary>
          <div className="mobile-category-children">
            <Link href={categoryBrowseHref(group.id)} onClick={onNavigate}>
              View all {group.name} <ChevronRight size={16} />
            </Link>
            {categories
              .filter((child) => child.parentId === group.id)
              .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
              .map((child) => (
                <Link key={child.id} href={categoryBrowseHref(child.id)} onClick={onNavigate}>
                  {child.name}
                  <ChevronRight size={16} />
                </Link>
              ))}
          </div>
        </details>
      ))}
      <details className="mobile-brand-directory" name="mobile-solar-category">
        <summary>
          <span>
            Shop by Brand<small>{brands.length} brands</small>
          </span>
          <ChevronDown size={18} />
        </summary>
        <label className="mobile-brand-search">
          Find a brand
          <input
            type="search"
            value={brandSearch}
            onChange={(event) => setBrandSearch(event.target.value)}
            placeholder="e.g. Solis, Knox, Jinko"
          />
        </label>
        <div className="browse-brand-grid">
          {brands
            .filter((brand) => brand.toLowerCase().includes(brandSearch.trim().toLowerCase()))
            .map((brand) => (
              <Link
                key={brand}
                href={`/shop?brand=${encodeURIComponent(brand)}`}
                onClick={onNavigate}
              >
                <BrandImage brand={brand} />
              </Link>
            ))}
        </div>
        {!brands.some((brand) =>
          brand.toLowerCase().includes(brandSearch.trim().toLowerCase()),
        ) && <p>No matching brands.</p>}
      </details>
    </div>
  );
}
