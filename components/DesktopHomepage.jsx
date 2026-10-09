import Link from 'next/link';
import ProductCarousel from './ProductCarousel';
import {
  ArrowRight,
  ChevronRight,
  Grid2X2,
  Headphones,
  PanelsTopLeft,
  Zap,
  BatteryCharging,
  Plug,
  Sun,
  Package,
} from 'lucide-react';
import { DealHero, FeaturedBrands, HomeCatalog } from './HomeShowcase';
import { categoryIdsFor, inCategory } from '../lib/catalog.mjs';

// Preserve the original desktop layout independently of the mobile storefront.
export default function DesktopHomepage({ products, categories, settings, renderCard }) {
  const parents = categories.filter((category) => !category.parentId);
  const categoryIcons = [PanelsTopLeft, Zap, BatteryCharging, Plug, Grid2X2, Sun, Package];
  const categoryPhoto = (id) =>
    products.find(
      (product) =>
        product.status === 'published' && inCategory(product, categoryIdsFor(categories, id)),
    )?.image;
  const card = renderCard;
  return (
    <div className="desktop-homepage">
      <section className="container home-top">
        <aside className="category-sidebar">
          {parents.map((c, i) => {
            const Icon = categoryIcons[i % categoryIcons.length];
            return (
              <div className="category-row" key={c.id}>
                <Link href={`/category/${c.id}`}>
                  <Icon size={20} />
                  <span>{c.name}</span>
                  <ChevronRight size={14} />
                </Link>
                <div className="category-flyout">
                  <h3>{c.name}</h3>
                  {categories
                    .filter((s) => s.parentId === c.id)
                    .map((s) => (
                      <Link key={s.id} href={`/category/${s.id}`}>
                        {s.name}
                        <ChevronRight size={13} />
                      </Link>
                    ))}
                  <h3 className="flyout-brand-heading">Shop by brand</h3>
                  {[
                    ...new Set(
                      products
                        .filter((p) => inCategory(p, categoryIdsFor(categories, c.id)))
                        .map((p) => p.brand),
                    ),
                  ]
                    .filter(Boolean)
                    .sort()
                    .map((brand) => (
                      <Link
                        key={brand}
                        href={`/category/${c.id}?brand=${encodeURIComponent(brand)}`}
                      >
                        {brand}
                        <ChevronRight size={13} />
                      </Link>
                    ))}
                  <Link className="accent" href={`/category/${c.id}`}>
                    View all {c.name.toLowerCase()} →
                  </Link>
                </div>
              </div>
            );
          })}
          <Link className="all-category" href="/shop">
            <Grid2X2 size={18} /> View all solar products
          </Link>
          <div className="sidebar-help">
            <Headphones size={24} />
            <div>
              <b>Need help choosing?</b>
              <Link href="/quote">Talk to our solar team →</Link>
            </div>
          </div>
        </aside>
        <DealHero />
      </section>

      <section className="container section">
        <SectionTitle
          title="Solar Categories"
          subtitle="Everything you need for your solar system"
          href="/shop"
        />
        <div className="category-tiles">
          {parents.slice(0, 6).map((c, i) => (
            <Link href={`/category/${c.id}`} key={c.id}>
              <img
                src={
                  categoryPhoto(c.id) ||
                  `/images/${['panel', 'inverter', 'battery', 'portable', 'accessory', 'inverter'][i]}.svg`
                }
                alt=""
              />
              <b>{c.name}</b>
              <span>
                Explore collection <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          title="Featured Solar Products"
          subtitle="Explore the essentials for a brighter tomorrow"
          href="/shop"
        />
        {settings.catalogNotice && <p className="catalog-note">{settings.catalogNotice}</p>}
        <ProductCarousel label="Featured Solar Products" railClassName="home-products">
          {products
            .filter((p) => p.featured)
            .slice(0, 12)
            .map(card)}
        </ProductCarousel>
      </section>
      <section className="container promo-grid">
        <Link href="/category/solar-batteries" className="promo-card">
          <div>
            <span>ENERGY, WHEN YOU NEED IT</span>
            <h2>
              Keep your home
              <br />
              powered after sunset.
            </h2>
            <p>Explore solar battery storage</p>
            <b>
              SHOP BATTERIES <ArrowRight size={16} />
            </b>
          </div>
          <img
            src={categoryPhoto('solar-batteries') || '/images/battery.svg'}
            alt="Solar battery"
          />
        </Link>
        <Link href="/category/solar-inverters" className="promo-card blue">
          <div>
            <span>THE HEART OF YOUR SOLAR SYSTEM</span>
            <h2>
              Smarter conversion.
              <br />
              Better possibilities.
            </h2>
            <p>Find your solar inverter</p>
            <b>
              SHOP INVERTERS <ArrowRight size={16} />
            </b>
          </div>
          <img
            src={categoryPhoto('solar-inverters') || '/images/inverter.svg'}
            alt="Solar inverter"
          />
        </Link>
      </section>
      <section className="container section">
        <SectionTitle
          title="Solar Panels & Complete Systems"
          subtitle="Start your journey to solar energy"
          href="/category/solar-panels"
        />
        <ProductCarousel label="Solar Panels & Complete Systems" railClassName="home-products">
          {products
            .filter(
              (p) =>
                inCategory(p, categoryIdsFor(categories, 'solar-panels')) ||
                inCategory(p, categoryIdsFor(categories, 'solar-packages')),
            )
            .slice(0, 12)
            .map(card)}
        </ProductCarousel>
      </section>

      <FeaturedBrands products={products} />
      <HomeCatalog categories={categories} products={products} />
    </div>
  );
}
function SectionTitle({ title, subtitle, href }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <Link href={href}>
        View all <ArrowRight size={15} />
      </Link>
    </div>
  );
}
