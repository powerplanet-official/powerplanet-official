'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ProductCarousel from './ProductCarousel';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import brandAssets from '../lib/featured-brands.json';
import mobileBrandAssets from '../lib/solar-mobile-brands.json';
import { mobileHomepageSlides, solarCollections, collectionProducts } from '../lib/homepage.mjs';
import { categoryIdsFor, inCategory } from '../lib/catalog.mjs';

// Default to no animation until the browser’s motion preference is known.
function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
// Both layouts share the same solar campaigns, with artwork composed for each screen.
export function DealHero() {
  return <MobileHero desktop />;
}

// Native scroll snapping preserves vertical page scrolling and horizontal touch gestures.
export function MobileHero({ desktop = false }) {
  const slides = useMemo(() => mobileHomepageSlides(), []);
  const rail = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [touching, setTouching] = useState(false);
  const reduced = useReducedMotion();
  const goToSlide = (next) => {
    const node = rail.current;
    if (!node) return;
    const slideIndex = (next + slides.length) % slides.length;
    node.scrollTo({
      left: slideIndex * node.clientWidth,
      behavior: reduced ? 'instant' : 'smooth',
    });
  };
  useEffect(() => {
    if (paused || interacting || touching || reduced) return;
    const timer = setInterval(() => {
      if (!document.hidden) goToSlide(index + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, [index, paused, interacting, touching, reduced]);
  return (
    <section
      className={`solar-hero${desktop ? ' desktop-solar-hero' : ''}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Solar deals"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setInteracting(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setInteracting(false);
      }}
      onFocusCapture={(event) => {
        // Touch taps must not leave autoplay paused after using the controls.
        if (event.target.matches(':focus-visible')) setInteracting(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
      }}
    >
      <h1 className="sr-only">
        Solar Panels, Hybrid Solar Inverters, Lithium Batteries & ESS Energy
      </h1>
      <div
        className="solar-hero-rail"
        ref={rail}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
        onScroll={(event) => {
          const node = event.currentTarget;
          setIndex(Math.round(node.scrollLeft / node.clientWidth));
        }}
      >
        {slides.map((slide, slideIndex) => (
          <Link
            key={slide.category}
            className="solar-hero-slide"
            href={slide.href}
            aria-label={`Shop ${slide.title}`}
            tabIndex={slideIndex === index ? 0 : -1}
          >
            <img
              src={desktop ? slide.banner : slide.image}
              alt={slide.title}
              width={desktop ? 1400 : 1000}
              height={desktop ? 520 : 1250}
              fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
            />
          </Link>
        ))}
      </div>
      <div className="solar-hero-controls">
        <button aria-label="Previous slide" onClick={() => goToSlide(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="carousel-dots">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.category}
              aria-label={`Show slide ${slideIndex + 1}`}
              aria-pressed={slideIndex === index}
              className={slideIndex === index ? 'selected' : ''}
              onClick={() => goToSlide(slideIndex)}
            />
          ))}
        </div>
        <button
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button aria-label="Next slide" onClick={() => goToSlide(index + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

// Each collection has its own linked artwork, swipeable products, and relevant brands.
export function SolarCollections({ products, categories, renderCard }) {
  return solarCollections.map((collection) => (
    <SolarCollection
      key={collection.category}
      collection={collection}
      products={collectionProducts(products, categories, collection)}
      renderCard={renderCard}
    />
  ));
}

function SolarCollection({ collection, products, renderCard }) {
  const visibleProducts = products.slice(0, 12);
  return (
    <section className="container solar-collection" aria-label={collection.title}>
      <div className="solar-collection-layout">
        <Link
          className={`solar-collection-banner collection-${collection.category}`}
          href={`/category/${collection.category}`}
          aria-label={`View all ${collection.title}`}
        >
          <div className="solar-collection-heading">
            <h2>{collection.title}</h2>
            <span>
              VIEW ALL <ChevronRight size={14} />
            </span>
          </div>
          <div className="solar-collection-art">
            <img
              src={collection.artwork}
              alt={collection.title}
              width={collection.artworkWidth}
              height={collection.artworkHeight}
              loading="lazy"
            />
          </div>
        </Link>
        {visibleProducts.length ? (
          <ProductCarousel label={collection.title} railClassName="solar-products-rail">
            {visibleProducts.map(renderCard)}
          </ProductCarousel>
        ) : (
          <p className="solar-collection-empty">
            New products are on the way.{' '}
            <Link href={`/category/${collection.category}`}>Explore this collection</Link>
          </p>
        )}
      </div>
      <FeaturedBrands products={products} compact label={`${collection.title} brands`} />
    </section>
  );
}

// Show only brands in the catalog and measure pages from the visible rail width.
export function FeaturedBrands({ products, compact = false, label = 'Featured brands' }) {
  const preferred = [
    'Knox',
    'DONGJIN POWER',
    'Solis',
    'Itel Energy',
    'PylonTech',
    'GOODWE',
    'Ecoflow',
    'Astronergy Solar',
    'Ziewnic',
    'Crown Solar Energy',
    'Volnex',
  ];
  const available = new Set(
    products.filter((p) => p.status !== 'draft').map((p) => p.brand?.toLowerCase()),
  );
  const brands = (compact ? [...brandAssets, ...mobileBrandAssets] : brandAssets)
    .filter((b) => available.has(b.name.toLowerCase()))
    .sort(
      (a, b) =>
        (preferred.includes(a.name) ? preferred.indexOf(a.name) : 999) -
        (preferred.includes(b.name) ? preferred.indexOf(b.name) : 999),
    );
  const rail = useRef(null),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const go = (next) => {
    if (rail.current)
      rail.current.scrollTo({
        left: next * rail.current.clientWidth,
        behavior: reduced ? 'instant' : 'smooth',
      });
  };
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth <= 0) return;
      setPages(Math.max(1, Math.ceil((node.scrollWidth - 1) / node.clientWidth)));
      setPage(
        node.scrollLeft >= node.scrollWidth - node.clientWidth - 2
          ? Math.max(0, Math.ceil((node.scrollWidth - 1) / node.clientWidth) - 1)
          : Math.round(node.scrollLeft / node.clientWidth),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [brands.length]);
  useEffect(() => {
    if (reduced || hovered || pages < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden && !rail.current?.contains(document.activeElement))
        go((page + 1) % pages);
    }, 5000);
    return () => clearInterval(timer);
  }, [reduced, hovered, pages, page]);
  if (!brands.length) return null;
  return (
    <section
      className={compact ? 'collection-brands' : 'container showcase-section featured-brands'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
    >
      {!compact && (
        <div className="showcase-heading">
          <h2>Featured Brand</h2>
          <span />
        </div>
      )}
      <div className="brand-carousel">
        <button
          className="brand-arrow before"
          aria-label="Previous brands"
          onClick={() => go((page - 1 + pages) % pages)}
          disabled={pages < 2}
        >
          <ChevronLeft />
        </button>
        <div
          className="brand-rail"
          ref={rail}
          onScroll={() => {
            const node = rail.current;
            if (node && node.clientWidth > 0)
              setPage(
                node.scrollLeft >= node.scrollWidth - node.clientWidth - 2
                  ? pages - 1
                  : Math.min(pages - 1, Math.round(node.scrollLeft / node.clientWidth)),
              );
          }}
        >
          {brands.map((b) => (
            <Link
              className="brand-tile"
              key={b.name}
              href={`/shop?brand=${encodeURIComponent(b.name)}`}
              aria-label={`Shop ${b.name}`}
            >
              <img src={b.image} alt={b.name} loading="lazy" />
            </Link>
          ))}
        </div>
        <button
          className="brand-arrow after"
          aria-label="Next brands"
          onClick={() => go((page + 1) % pages)}
          disabled={pages < 2}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="carousel-dots brand-dots">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            aria-label={`Show brands page ${i + 1}`}
            aria-pressed={page === i}
            className={page === i ? 'selected' : ''}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}
// Group category links and product counts under their top-level solar categories.
export function MobileHomeCatalog({ categories, products }) {
  const roots = categories.filter((c) =>
    ['solar-panels', 'hybrid-inverters', 'lithium-ion-batteries'].includes(c.id),
  );
  return (
    <section className="container showcase-section home-catalog" aria-label="Our catalog">
      <div className="showcase-heading">
        <h2>Our Catalog</h2>
        <span />
      </div>
      <div className="home-catalog-grid">
        {roots.map((root) => {
          const children = categories.filter((c) => c.parentId === root.id);
          const matchingProducts = products.filter(
            (product) =>
              product.status !== 'draft' &&
              inCategory(product, categoryIdsFor(categories, root.id)),
          );
          const count = matchingProducts.length;
          const brands = [
            ...new Set(matchingProducts.map((product) => product.brand).filter(Boolean)),
          ].slice(0, 7);
          return (
            <section key={root.id}>
              <h3>
                <Link href={`/category/${root.id}`}>{root.name}</Link>
                <small>{count}</small>
              </h3>
              {children.map((c) => (
                <Link key={c.id} href={`/category/${c.id}`}>
                  <ChevronRight size={15} />
                  {c.name}
                </Link>
              ))}
              {!children.length &&
                brands.map((brand) => (
                  <Link
                    key={brand}
                    href={`/category/${root.id}?brand=${encodeURIComponent(brand)}`}
                  >
                    <ChevronRight size={15} />
                    {brand}
                  </Link>
                ))}
              <Link className="catalog-all" href={`/category/${root.id}`}>
                <ChevronRight size={15} />
                All {root.name.toLowerCase()}
              </Link>
            </section>
          );
        })}
      </div>
    </section>
  );
}

// Original desktop directory; mobile uses its own three-collection directory.
export function HomeCatalog({ categories, products }) {
  const roots = categories.filter((c) => !c.parentId);
  return (
    <section className="container showcase-section home-catalog" aria-label="Our catalog">
      <div className="showcase-heading">
        <h2>Our Catalog</h2>
        <span />
      </div>
      <div className="home-catalog-grid">
        {roots.map((root) => {
          const children = categories.filter((c) => c.parentId === root.id);
          const count = products.filter((p) =>
            inCategory(p, categoryIdsFor(categories, root.id)),
          ).length;
          return (
            <section key={root.id}>
              <h3>
                <Link href={`/category/${root.id}`}>{root.name}</Link>
                <small>{count}</small>
              </h3>
              {children.map((c) => (
                <Link key={c.id} href={`/category/${c.id}`}>
                  <ChevronRight size={15} />
                  {c.name}
                </Link>
              ))}
              <Link className="catalog-all" href={`/category/${root.id}`}>
                <ChevronRight size={15} />
                All {root.name.toLowerCase()}
              </Link>
            </section>
          );
        })}
      </div>
    </section>
  );
}
