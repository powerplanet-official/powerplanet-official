'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ProductCarousel from './ProductCarousel';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Sun, Zap } from 'lucide-react';
import brandAssets from '../lib/featured-brands.json';
import mobileBrandAssets from '../lib/solar-mobile-brands.json';
import {
  homepageSlides,
  mobileHomepageSlides,
  solarCollections,
  collectionProducts,
} from '../lib/homepage.mjs';
import { priceLabel, categoryIdsFor, inCategory } from '../lib/catalog.mjs';

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
// The desktop carousel keeps its original catalog-backed offers and styling.
export function DealHero({ products, categories, settings }) {
  const slides = useMemo(() => homepageSlides(products, categories), [products, categories]);
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  const reduced = useReducedMotion(),
    touchStart = useRef(null);
  const slide =
    index === 0 && settings?.heroTitle
      ? { ...slides[index], title: settings.heroTitle }
      : slides[index];
  const move = (direction) =>
    setIndex((current) => (current + direction + slides.length) % slides.length);
  useEffect(() => {
    if (paused || hovered || focused || reduced) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, hovered, focused, reduced, slides.length]);
  return (
    <section
      className={`deal-hero tone-${slide.tone}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Solar deals"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStart.current !== null) {
          const delta = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1);
          touchStart.current = null;
        }
      }}
    >
      <div className="deal-sun" aria-hidden="true">
        <Sun />
      </div>
      <div
        className="deal-content"
        key={slide.category}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${slides.length}`}
      >
        <div className="deal-copy">
          <span className="deal-eyebrow">
            <Zap size={15} />
            {slide.eyebrow}
          </span>
          <h1>
            {slide.title.split('\n').map((text, i) => (
              <span key={i}>
                {text}
                <br />
              </span>
            ))}
          </h1>
          <p className="deal-product-name">
            {slide.product?.name || 'Explore solar products for your home and business.'}
          </p>
          {slide.product && (
            <div className="deal-price">
              {slide.saving > 0 && <del>{priceLabel(slide.product.originalPrice)}</del>}
              <strong>{priceLabel(slide.product.price)}</strong>
            </div>
          )}
          <Link href={slide.href} className="primary">
            {slide.saving > 0 ? 'Explore this deal' : 'Explore collection'}
            <ArrowRight size={18} />
          </Link>
          <Link className="deal-collection-link" href={`/category/${slide.category}`}>
            Browse the full collection <ArrowRight size={15} />
          </Link>
          <p className="deal-note">
            {slide.product?.minQuantity > 1
              ? `Minimum order: ${slide.product.minQuantity} units. `
              : ''}
            Confirm current price & availability with our team.
          </p>
        </div>
        <Link
          className="deal-art"
          href={slide.href}
          aria-label={slide.product ? `View ${slide.product.name}` : 'Explore solar collection'}
        >
          <span className="deal-orbit" />
          <img
            src={slide.image}
            alt={slide.product?.name || 'Solar product collection'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
          {slide.saving > 0 ? (
            <span className="deal-saving">
              Save<strong>{priceLabel(slide.saving)}</strong>
            </span>
          ) : (
            <span className="deal-saving">
              POWER PLANET<strong>The Power you Own</strong>
            </span>
          )}
        </Link>
      </div>
      <div className="deal-controls">
        <div className="carousel-dots">
          {slides.map((s, i) => (
            <button
              key={s.category}
              aria-label={`Show slide ${i + 1}`}
              aria-pressed={i === index}
              className={i === index ? 'selected' : ''}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <span className="deal-counter">
          0{index + 1} / 0{slides.length}
        </span>
        <div className="deal-arrows">
          <button
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button aria-label="Previous slide" onClick={() => move(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button aria-label="Next slide" onClick={() => move(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

// Native scroll snapping preserves vertical page scrolling and horizontal touch gestures.
export function MobileHero() {
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
    }, 6000);
    return () => clearInterval(timer);
  }, [index, paused, interacting, touching, reduced]);
  return (
    <section
      className="solar-hero"
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
              src={slide.image}
              alt={slide.title}
              width="1000"
              height="1250"
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
    }, 7000);
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
