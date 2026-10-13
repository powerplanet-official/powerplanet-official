'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import ProductPrice from './ProductPrice';
import Checkout from './Checkout';
import { MobileHero, SolarCollections, MobileHomeCatalog } from './HomeShowcase';
import DesktopHomepage from './DesktopHomepage';
import BrandLogo from './BrandLogo';
import ProductSearch from './ProductSearch';
import SolarCatalog, { SolarMegaMenu, SolarProductDetail } from './SolarCatalog';
import { available, priceLabel } from '../lib/catalog.mjs';
import { solarCollections } from '../lib/homepage.mjs';
import { readApiResponse } from '../lib/api-response.mjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Sun,
  Heart,
  ChartNoAxesColumnIncreasing,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
  CheckCircle2,
  Send,
  MessageCircle,
  MapPin,
  Mail,
  Phone,
  Grid2X2,
  SlidersHorizontal,
  Zap,
  BatteryCharging,
  Plug,
  PanelsTopLeft,
  Package,
  Minus,
  Plus,
  Trash2,
  Facebook,
  ArrowUp,
  UserRound,
} from 'lucide-react';
const currency = priceLabel;
const defaultStoreAddress = 'E-175, New Airport Road Main, Bhatta Chowk, Lahore, Pakistan';
async function request(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readApiResponse(r);
  if (!r.ok) throw new Error(data.error || 'Please try again');
  return data;
}
// Read browser storage after mount; do not overwrite it with defaults during hydration.
function useSaved(key, initial) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      if (v !== null) setValue(v);
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready) localStorage.setItem(key, JSON.stringify(value));
  }, [value, ready, key]);
  return [value, setValue];
}
// Match the CSS breakpoint and mount only the active homepage, avoiding hidden
// image downloads, duplicate headings, and background carousels on phones.
function subscribeMobileViewport(onChange) {
  const viewport = window.matchMedia('(max-width: 760px)');
  viewport.addEventListener('change', onChange);
  return () => viewport.removeEventListener('change', onChange);
}
const getMobileViewport = () => window.matchMedia('(max-width: 760px)').matches;
const getServerViewport = () => false;

// Shared shop shell and customer state used by the home, catalog, and basket routes.
export default function Storefront() {
  const mobileView = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewport,
    getServerViewport,
  );
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState('');
  const [cart, setCart] = useSaved('pp-cart', []),
    [wishlist, setWishlist] = useSaved('pp-wishlist', []),
    [compare, setCompare] = useSaved('pp-compare', []);
  const path = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  useEffect(() => {
    fetch('/api/store')
      .then((r) => {
        if (!r.ok) throw Error('The store could not be loaded. Please try again.');
        return readApiResponse(r);
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path, params]);
  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menu]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  if (error)
    return (
      <main className="loading">
        <Sun size={42} />
        <h1>Powerplanet</h1>
        <p role="alert">{error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!data)
    return (
      <div className="loading">
        <Sun className="spin" size={40} />
        <p>Loading your solar store…</p>
      </div>
    );
  const { products, categories, settings } = data;
  const storeAddress = settings.address?.trim() || defaultStoreAddress;
  const cartCount = cart.reduce((n, p) => n + p.quantity, 0);
  const add = (p, quantity = p.minQuantity || 1) => {
    const amount = Math.min(100, Math.max(p.minQuantity || 1, Math.floor(Number(quantity)) || 1));
    setCart((old) =>
      old.some((x) => x.id === p.id)
        ? old.map((x) =>
            x.id === p.id ? { ...x, quantity: Math.min(x.quantity + amount, 100) } : x,
          )
        : [...old, { id: p.id, quantity: amount }],
    );
    setToast('Added to your shopping basket');
  };
  const inquire = (p, quantity = p.minQuantity || 1) => {
    add(p, quantity);
    router.push('/quote');
  };

  const toggle = (id, value, set, label) => {
    if (value.includes(id)) {
      set(value.filter((x) => x !== id));
      setToast(`Removed from ${label}`);
    } else {
      if (label === 'comparison' && value.length >= 4) {
        setToast('Compare up to 4 products at a time');
        return;
      }
      set([...value, id]);
      setToast(`Added to ${label}`);
    }
  };
  const card = (p) => (
    <ProductCard
      key={p.id}
      p={p}
      add={add}
      wished={wishlist.includes(p.id)}
      compared={compare.includes(p.id)}
      wish={() => toggle(p.id, wishlist, setWishlist, 'wishlist')}
      compare={() => toggle(p.id, compare, setCompare, 'comparison')}
    />
  );
  const isHome = path === '/',
    isShop = path === '/shop' || path.startsWith('/category/'),
    product = path.startsWith('/product/')
      ? products.find((p) => p.id === decodeURIComponent(path.split('/')[2]))
      : null;
  const activeCategory = categories.find((c) => c.id === path.split('/')[2]);
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>Welcome to {settings.name} — Your solar energy partner</span>
          {settings.phone && (
            <a
              className="topbar-phone"
              href={
                settings.whatsapp
                  ? `https://wa.me/${settings.whatsapp}`
                  : `tel:${settings.phone.replace(/\s/g, '')}`
              }
              {...(settings.whatsapp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {settings.whatsapp ? <MessageCircle size={12} /> : <Phone size={12} />}
              {settings.whatsapp ? 'WHATSAPP US AT:' : 'CALL US AT:'} {settings.phone}
            </a>
          )}
          <div>
            <Link href="/contact">Contact us</Link>
            <span className="separator">|</span>
            <Link href="/quote">Request a quotation</Link>
            <span className="separator">|</span>
            <span>
              Rs. Pakistani Rupee <b>PKR</b> <ChevronDown size={11} />
            </span>
          </div>
        </div>
      </div>
      <header className="main-header">
        <div className="container header-inner">
          <button
            className="mobile-menu-toggle"
            aria-label={menu ? 'Close categories' : 'Open categories'}
            aria-expanded={menu}
            aria-controls="store-category-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link href="/" className="logo" aria-label="Powerplanet home">
            <BrandLogo />
          </Link>
          <ProductSearch products={products} />
          <div className="header-actions">
            <Link className="header-account" href="/admin">
              <UserRound />
              <span>
                Account<small>Store administration</small>
              </span>
            </Link>
            <Link href="/wishlist">
              <Heart />
              <span>
                Wishlist<small>Saved products ({wishlist.length})</small>
              </span>
            </Link>
            <Link href="/compare">
              <ChartNoAxesColumnIncreasing />
              <span>
                Compare<small>Compare products ({compare.length})</small>
              </span>
            </Link>
            <Link
              href="/cart"
              className="cart-button"
              aria-label={`Shopping basket, ${cartCount} items`}
            >
              <ShoppingCart />
              <b>{cartCount}</b>
            </Link>
          </div>
        </div>
      </header>
      <ProductSearch products={products} mobile />
      <nav
        id="store-category-navigation"
        className={`navigation ${menu ? 'mobile-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="container nav-inner">
          <button className="category-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu}>
            <Menu size={20} /> Shop By Category <ChevronDown size={16} />
          </button>
          <div className="nav-links">
            <Link href="/quote">Send us Inquiry</Link>
            <Link href="/shop">Solar Products</Link>
            <Link href="/category/solar-packages">Solar Packages</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <Link className="nav-quote" href="/cart">
            {cartCount} item(s) · Shopping basket <ShoppingCart size={20} />
          </Link>
          {menu && (
            <SolarMegaMenu
              categories={categories}
              products={products}
              onNavigate={() => setMenu(false)}
            />
          )}
        </div>
      </nav>
      <main>
        {isHome ? (
          <>
            {mobileView ? (
              <div className="mobile-homepage">
                <section className="solar-home-top">
                  <MobileHero />
                </section>
                <SolarCollections products={products} categories={categories} renderCard={card} />
                <MobileHomeCatalog categories={categories} products={products} />
              </div>
            ) : (
              <DesktopHomepage
                products={products}
                categories={categories}
                settings={settings}
                renderCard={card}
              />
            )}
            <section className="store-promises" aria-label="Why choose Power Planet">
              <div className="container store-promises-grid">
                {[
                  [ShieldCheck, '100% GENUINE PRODUCTS', 'Featuring trusted brands'],
                  [
                    BatteryCharging,
                    'HYBRID SOLAR SYSTEM EXPERTS',
                    'With large-scale energy storage (ESS)',
                  ],
                  [
                    Sun,
                    'GRADE A SOLAR PANELS',
                    'All types of solar panels available at wholesale prices',
                  ],
                  [ShoppingCart, '30,000+ PRODUCTS AVAILABLE', 'One-Stop Technology Marketplace'],
                ].map(([Icon, title, subtitle]) => (
                  <div className="store-promise" key={title}>
                    <span className="store-promise-icon">
                      <Icon size={32} aria-hidden="true" />
                    </span>
                    <h3>{title}</h3>
                    <p>{subtitle}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="quote-banner">
              <div className="container">
                <Sun size={56} />
                <div>
                  <span>LET’S FIND YOUR SOLAR SOLUTION</span>
                  <h2>A little sunshine. A lot of possibilities.</h2>
                  <p>Tell us what you need. We’ll help you take the next step.</p>
                </div>
                <Link href="/quote" className="primary">
                  Request a quotation <ArrowRight size={17} />
                </Link>
              </div>
            </section>
          </>
        ) : (
          <div className="container inner-page">
            <div className="breadcrumbs">
              <Link href="/">Home</Link>
              <ChevronRight size={13} />
              <span>
                {activeCategory?.name ||
                  product?.name ||
                  {
                    '/shop': 'All Solar Products',
                    '/wishlist': 'My Wishlist',
                    '/compare': 'Compare Products',
                    '/cart': 'Shopping Basket',
                    '/checkout': 'Checkout',
                    '/quote': 'Request a Quotation',
                    '/contact': 'Contact Us',
                    '/about': 'About Powerplanet',
                  }[path] ||
                  'Page not found'}
              </span>
            </div>
            {isShop ? (
              <SolarCatalog
                products={products}
                categories={categories}
                category={activeCategory}
                add={add}
                inquiry={inquire}
                wishlist={wishlist}
                compareIds={compare}
                onWish={(id) => toggle(id, wishlist, setWishlist, 'wishlist')}
                onCompare={(id) => toggle(id, compare, setCompare, 'comparison')}
              />
            ) : product ? (
              <SolarProductDetail
                p={product}
                add={add}
                inquiry={inquire}
                wish={() => toggle(product.id, wishlist, setWishlist, 'wishlist')}
                categories={categories}
              />
            ) : path === '/wishlist' ? (
              <>
                <h1>My Wishlist</h1>
                {wishlist.length ? (
                  <div className="product-grid">
                    {products.filter((p) => wishlist.includes(p.id)).map(card)}
                  </div>
                ) : (
                  <Empty
                    title="Your wishlist is waiting"
                    text="Save products with the heart button and find them here."
                  />
                )}
              </>
            ) : path === '/compare' ? (
              <>
                <h1>Compare Products</h1>
                {compare.length ? (
                  <div className="compare-wrap">
                    <table className="compare-table">
                      <tbody>
                        <tr>
                          <th>Product</th>
                          {products
                            .filter((p) => compare.includes(p.id))
                            .map((p) => (
                              <td key={p.id}>
                                <img src={p.image} alt={p.name} />
                                <Link href={`/product/${p.id}`}>
                                  <b>{p.name}</b>
                                </Link>
                                <button
                                  onClick={() => setCompare(compare.filter((x) => x !== p.id))}
                                >
                                  Remove
                                </button>
                              </td>
                            ))}
                        </tr>
                        {[
                          ['Brand', 'brand'],
                          ['Price', 'price'],
                          ['Description', 'description'],
                          ['Specifications', 'specs'],
                        ].map(([label, key]) => (
                          <tr key={key}>
                            <th>{label}</th>
                            {products
                              .filter((p) => compare.includes(p.id))
                              .map((p) => (
                                <td key={p.id}>
                                  {key === 'price'
                                    ? currency(p.price)
                                    : p[key] || 'To be confirmed'}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Compare your solar options"
                    text="Use the comparison button on up to four products."
                  />
                )}
              </>
            ) : path === '/cart' ? (
              <>
                <h1>Shopping Basket</h1>
                <p className="muted">
                  Review your products, then pay by card or choose Cash on Delivery. You can also
                  request a quotation.
                </p>
                {cart.length ? (
                  <>
                    <div className="basket">
                      {cart.map((item) => {
                        const p = products.find((x) => x.id === item.id);
                        return (
                          <div className="basket-row" key={item.id}>
                            <img src={p?.image || '/images/panel.svg'} alt="" />
                            <div>
                              <Link href={`/product/${item.id}`}>
                                <b>{p?.name || 'Unavailable product'}</b>
                              </Link>
                              <p>{p ? currency(p.price) : 'Please remove this item'}</p>
                            </div>
                            <div className="quantity">
                              <button
                                aria-label="Decrease quantity"
                                onClick={() =>
                                  setCart(
                                    cart.map((x) =>
                                      x.id === item.id
                                        ? {
                                            ...x,
                                            quantity: Math.max(p?.minQuantity || 1, x.quantity - 1),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Minus size={14} />
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                aria-label="Increase quantity"
                                onClick={() =>
                                  setCart(
                                    cart.map((x) =>
                                      x.id === item.id
                                        ? { ...x, quantity: Math.min(100, x.quantity + 1) }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button
                              className="icon-btn"
                              aria-label="Remove item"
                              onClick={() => setCart(cart.filter((x) => x.id !== item.id))}
                            >
                              <Trash2 size={19} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="basket-bottom">
                      <p>
                        Place your order; our team will confirm availability, price and delivery
                        with you.
                      </p>
                      <Link href="/checkout" className="primary">
                        Proceed to checkout <ArrowRight size={17} />
                      </Link>
                      <Link href="/quote" className="primary">
                        Request quotation ({cartCount} items) <ArrowRight size={17} />
                      </Link>
                    </div>
                  </>
                ) : (
                  <Empty
                    title="Your basket is empty"
                    text="Add solar products to request a personalized quotation."
                  />
                )}
              </>
            ) : path === '/checkout' ? (
              <Checkout
                key={params.get('order') || 'checkout'}
                cart={cart}
                products={products}
                params={params}
                done={(items) =>
                  setCart((current) =>
                    current.flatMap((i) => {
                      const ordered = items.find((x) => x.id === i.id);
                      const quantity = i.quantity - (ordered?.quantity || 0);
                      return quantity > 0 ? [{ ...i, quantity }] : [];
                    }),
                  )
                }
              />
            ) : path === '/quote' || path === '/contact' ? (
              <div className="contact-layout">
                <div>
                  <span className="eyebrow">LET’S TALK SOLAR</span>
                  <h1>{path === '/quote' ? 'Request a Quotation' : 'Contact Powerplanet'}</h1>
                  <p>
                    Tell us about your requirements. Our team will review your request and help you
                    choose a suitable solar solution.
                  </p>
                  <div className="contact-details">
                    {settings.phone && (
                      <a href={`tel:${settings.phone}`}>
                        <Phone size={21} />
                        {settings.phone}
                      </a>
                    )}
                    {settings.email && (
                      <a href={`mailto:${settings.email}`}>
                        <Mail size={21} />
                        {settings.email}
                      </a>
                    )}
                    <p>
                      <MapPin size={21} />
                      {storeAddress}
                    </p>
                    <a href={settings.facebook} target="_blank" rel="noreferrer">
                      <Facebook size={21} />
                      Powerplanet on Facebook <ArrowRight size={16} />
                    </a>
                  </div>
                  <div className="contact-tip">
                    <Sun size={29} />
                    <div>
                      <b>A better quote starts with a few details.</b>
                      <p>
                        Include your monthly electricity usage, your city and whether you need
                        battery backup.
                      </p>
                    </div>
                  </div>
                </div>
                <QuoteForm cart={cart} products={products} done={() => setCart([])} />
              </div>
            ) : path === '/about' ? (
              <article className="about-content">
                <span className="eyebrow">WELCOME TO POWERPLANET</span>
                <h1>
                  Your journey to solar
                  <br />
                  starts here.
                </h1>
                <p>
                  Explore solar panels, inverters, batteries and accessories in one place. We make
                  it easier to browse your options and request a solution tailored to your needs.
                </p>
                <img src="/images/solar-hero.jpg" alt="Solar panels capturing sunlight" />
                <h2>Everything for your solar system</h2>
                <p>
                  Browse our organized solar catalog, compare your options and tell us what you
                  need. Product specifications, availability, installation scope and pricing are
                  confirmed with each quotation.
                </p>
                <Link href="/quote" className="primary">
                  Speak to our team <ArrowRight size={16} />
                </Link>
              </article>
            ) : (
              <Empty title="Page not found" text="This product or page may have been moved." />
            )}
          </div>
        )}
      </main>
      <footer>
        <div className="container footer-grid">
          <div>
            <Link href="/" className="logo footer-logo">
              <BrandLogo />
            </Link>
            <p>
              Solar panels, inverters, batteries and more.
              <br />
              Explore the possibilities of clean energy.
            </p>
            <a
              className="social"
              href={settings.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="Visit Powerplanet Facebook"
            >
              <Facebook size={17} />
            </a>
          </div>
          <div>
            <h3>Solar Products</h3>
            <>
              {categories
                .filter((category) => !category.parentId)
                .slice(0, 5)
                .map((category) => (
                  <Link
                    className="desktop-footer-category"
                    key={category.id}
                    href={`/category/${category.id}`}
                  >
                    {category.name}
                  </Link>
                ))}
            </>
            <>
              {solarCollections.map((collection) => (
                <Link
                  className="mobile-footer-category"
                  key={collection.category}
                  href={`/category/${collection.category}`}
                >
                  {collection.title}
                </Link>
              ))}
            </>
          </div>
          <div>
            <h3>Customer Service</h3>
            <Link href="/contact">Contact Us</Link>
            <Link href="/quote">Request a Quotation</Link>
            <Link href="/wishlist">My Wishlist</Link>
            <Link href="/compare">Product Comparison</Link>
            <Link href="/cart">Shopping Basket</Link>
          </div>
          <div>
            <h3>Stay Connected</h3>
            <p>
              Have a question about going solar?
              <br />
              We’re here to help you get started.
            </p>
            <Link href="/contact" className="footer-contact">
              <MessageCircle size={18} /> Talk to our team
            </Link>
            {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
            <address className="footer-address">
              <MapPin size={18} aria-hidden="true" />
              <span>{storeAddress}</span>
            </address>
            <Link href="/admin" className="admin-link">
              <UserRound size={13} /> Store administration
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container">
            <span>
              © {new Date().getFullYear()} {settings.name}. All rights reserved.
            </span>
            <span>
              Powering possibilities with solar energy. <Sun size={15} />
            </span>
          </div>
        </div>
      </footer>
      <Chatbot whatsapp={settings.whatsapp} />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </>
  );
}
// Compact card reused by homepage collections and the saved-products page.
function ProductCard({ p, add, wish, compare, wished, compared }) {
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/product/${p.id}`}>
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/panel.svg';
            }}
          />
        </Link>
        <span className={`product-badge ${p.status === 'preview' ? 'preview' : ''}`}>
          {p.status === 'preview' ? 'CATALOG PREVIEW' : available(p) ? 'AVAILABLE' : 'ON REQUEST'}
        </span>
        <div className="product-actions">
          <button
            className={wished ? 'selected' : ''}
            onClick={wish}
            aria-label={`Save ${p.name}`}
            aria-pressed={wished}
          >
            <Heart size={16} />
          </button>
          <button
            className={compared ? 'selected' : ''}
            onClick={compare}
            aria-label={`Compare ${p.name}`}
            aria-pressed={compared}
          >
            <ChartNoAxesColumnIncreasing size={16} />
          </button>
        </div>
      </div>
      <div className="product-info">
        <span className="brand">{p.brand}</span>
        <Link href={`/product/${p.id}`} className="product-name">
          {p.name}
        </Link>
        <ProductPrice product={p} className="product-price" />
        <div className="product-bottom">
          <span>
            {p.status === 'preview'
              ? 'Details to be confirmed'
              : available(p)
                ? 'In stock'
                : 'Ask about availability'}
          </span>
          <button onClick={() => add(p)} aria-label={`Add ${p.name} to basket`}>
            <ShoppingCart size={17} />
            <span>Add to cart</span>
          </button>
        </div>
      </div>
    </article>
  );
}
function Empty({ title, text }) {
  return (
    <div className="empty">
      <Sun size={45} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link href="/shop" className="primary">
        Browse solar products <ArrowRight size={15} />
      </Link>
    </div>
  );
}
// Submit customer details with the current basket as a quotation request.
function QuoteForm({ cart, products, done }) {
  const [state, setState] = useState(''),
    [error, setError] = useState(''),
    [id, setId] = useState('');
  async function submit(e) {
    e.preventDefault();
    setState('sending');
    setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await request('/api/quotes', { ...values, items: cart });
      setId(r.id);
      setState('sent');
      done();
    } catch (e) {
      setError(e.message);
      setState('');
    }
  }
  if (state === 'sent')
    return (
      <div className="quote-form success">
        <CheckCircle2 size={52} />
        <h2>Your request has been received.</h2>
        <p>
          Our team will review your requirements and contact you using the details you provided.
        </p>
        <small>Reference: {id}</small>
        <Link href="/shop" className="primary">
          Continue browsing
        </Link>
      </div>
    );
  return (
    <form className="quote-form" onSubmit={submit}>
      <h2>Tell us what you need</h2>
      <p>Fields marked * are required.</p>
      <div className="form-row">
        <label>
          Full name *
          <input name="name" required maxLength={200} placeholder="Your name" autoComplete="name" />
        </label>
        <label>
          Phone number *
          <input
            name="phone"
            type="tel"
            required
            minLength={7}
            maxLength={25}
            placeholder="03XX XXXXXXX"
            autoComplete="tel"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Email address
          <input name="email" type="email" placeholder="you@example.com" autoComplete="email" />
        </label>
        <label>
          City *
          <input
            name="city"
            required
            maxLength={200}
            placeholder="Your city"
            autoComplete="address-level2"
          />
        </label>
      </div>
      <label>
        Your requirements
        <textarea
          name="message"
          rows={5}
          maxLength={3000}
          placeholder="Tell us about your electricity usage, preferred products or backup needs…"
        />
      </label>
      {cart.length > 0 && (
        <div className="quote-items">
          <b>Your selected products</b>
          {cart.map((i) => (
            <span key={i.id}>
              {products.find((p) => p.id === i.id)?.name || 'Unavailable product'} × {i.quantity}
            </span>
          ))}
        </div>
      )}
      <p className="form-consent">
        By sending this request, you agree that Powerplanet may contact you about your inquiry. No
        payment is collected here.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={state === 'sending'} className="primary">
        {state === 'sending' ? 'Sending…' : 'Send quotation request'}
        <Send size={16} />
      </button>
    </form>
  );
}
// Send questions to the store assistant and retain this session’s replies in the panel.
function Chatbot({ whatsapp }) {
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState([
      {
        from: 'bot',
        text: 'Assalam-o-Alaikum! ☀️ Welcome to Powerplanet. I’m your automated solar assistant. How can I help you today?',
      },
    ]),
    [input, setInput] = useState(''),
    [busy, setBusy] = useState(false);
  async function send(text) {
    if (!text.trim() || busy) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text }]);
    setBusy(true);
    try {
      const r = await request('/api/chat', { message: text });
      setMessages((m) => [...m, { from: 'bot', text: r.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: 'Sorry, I could not connect. Please try again or use our quotation form.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" aria-label="Solar support chat">
          <div className="chat-header">
            <Sun size={26} />
            <div>
              <b>Powerplanet Assistant</b>
              <small>Automated replies · Solar support</small>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={19} />
            </button>
          </div>
          <div
            className="chat-messages"
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.from}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="chat-message bot">Finding an answer…</div>}
          </div>
          <div className="chat-suggestions">
            {['Solar packages', 'Prices', 'Delivery'].map((t) => (
              <button key={t} onClick={() => send(t)} disabled={busy}>
                {t}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              aria-label="Your message"
              placeholder="Type your message…"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
            />
            <button aria-label="Send message" disabled={busy || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
          <div className="chat-footer">
            <Link href="/quote" onClick={() => setOpen(false)}>
              Request help from our team →
            </Link>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            )}
          </div>
        </section>
      )}
      <button
        className="chat-launcher"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Close solar assistant' : 'Open solar assistant'}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        <span>{open ? 'Close' : 'Need help? Chat with us'}</span>
        <i />
      </button>
    </div>
  );
}
