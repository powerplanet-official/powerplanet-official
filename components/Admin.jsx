'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import AdminOrders from './AdminOrders';
import BrandingSettings from './BrandingSettings';
import BrandLogo from './BrandLogo';
import {
  Sun,
  LayoutDashboard,
  Package,
  Layers,
  ClipboardList,
  MessageCircle,
  Settings,
  LogOut,
  ExternalLink,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  UserRound,
  Menu,
  Search,
  Save,
  Eye,
  MessagesSquare,
} from 'lucide-react';
// Tab IDs also select the matching panel and heading below.
const navigation = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['products', 'Products', Package],
  ['categories', 'Categories', Layers],
  ['quotes', 'Quotations', ClipboardList],
  ['orders', 'Orders', Package],
  ['faqs', 'Chatbot replies', MessageCircle],
  ['chats', 'Conversations', MessagesSquare],
  ['settings', 'Store settings', Settings],
];
// New products stay hidden until an administrator explicitly publishes them.
const emptyProduct = {
  name: '',
  categoryId: 'solar-panels',
  brand: '',
  price: null,
  stock: 0,
  status: 'draft',
  featured: false,
  image: '/images/panel.svg',
  description: '',
  specs: '',
  source: '',
};
// Preserve HTTP status so expired sessions can return the user to the login screen.
async function api(path, method = 'GET', body) {
  const response = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error || 'The request could not be completed');
    e.status = response.status;
    throw e;
  }
  return data;
}
const formatDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
// Export through a temporary browser URL and release it once the download starts.
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = name;
  downloadLink.click();
  URL.revokeObjectURL(url);
}
// Owns the signed-in session, active panel, shared notices, and record-editing dialog.
export default function Admin() {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const importRef = useRef(null);
  useEffect(() => {
    api('auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  // Reload the overview after a mutation so counts and tables reflect saved records.
  async function refresh() {
    try {
      setData(await api('admin/overview'));
    } catch (e) {
      setError(e.message);
      if (e.status === 401) setUser(null);
    }
  }
  useEffect(() => {
    if (user) refresh();
  }, [user]);
  useEffect(() => {
    setSearch('');
    setFilter('');
    setError('');
    setNotice('');
    setMobile(false);
  }, [tab]);

  // All record forms use this path; only successful saves close the dialog.
  async function save(collection, item) {
    setBusy(true);
    setError('');
    try {
      await api(
        `admin/${collection}/${encodeURIComponent(item.id || crypto.randomUUID())}`,
        'PUT',
        item,
      );
      setModal(null);
      setNotice('Changes saved successfully.');
      await refresh();
    } catch (e) {
      setError(e.message);
      if (e.status === 401) setUser(null);
    } finally {
      setBusy(false);
    }
  }

  // Opening the confirmation dialog does not delete the record.
  function remove(collection, item) {
    setModal({ kind: 'delete', collection, item });
  }
  async function confirmDelete() {
    setBusy(true);
    setError('');
    try {
      await api(`admin/${modal.collection}/${encodeURIComponent(modal.item.id)}`, 'DELETE');
      setModal(null);
      setNotice('Record deleted.');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // The server validates imported rows; the browser rejects oversized files early.
  async function importProducts(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('Choose a JSON file smaller than 2 MB');
      const rows = JSON.parse(await file.text());
      const result = await api('admin/products/import', 'POST', rows);
      setNotice(`${result.count} products imported successfully.`);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  // Distinguish a session still loading from a visitor who needs to sign in.
  if (user === undefined)
    return (
      <div className="loading">
        <Sun size={38} />
        <p>Loading administration…</p>
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  if (!data)
    return (
      <div className="loading">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={refresh} className="primary">
              Retry
            </button>
          </>
        ) : (
          <p>Loading store data…</p>
        )}
      </div>
    );
  const preview = data.products.filter((p) => p.status === 'preview').length;
  const newQuotes = data.quotes.filter((q) => q.status === 'new').length;
  const titles = {
    orders: [
      'Orders',
      'Review card and Cash on Delivery orders, payment status and delivery details.',
    ],
    dashboard: ['Store Overview', 'Welcome back. Here’s what’s happening with your store.'],
    products: ['Products', 'Manage your solar catalog, availability and prices.'],
    categories: ['Categories', 'Organize products into clear solar categories and subcategories.'],
    quotes: ['Quotations', 'Review customer requests and track your follow-ups.'],
    faqs: ['Chatbot Replies', 'Manage the answers your automated solar assistant gives customers.'],
    chats: ['Conversations', 'Review recent questions asked through your website assistant.'],
    settings: [
      'Store Settings',
      'Update the contact details and content shown on your storefront.',
    ],
  };
  const products = data.products.filter(
    (p) =>
      (!search || `${p.name} ${p.brand}`.toLowerCase().includes(search.toLowerCase())) &&
      (!filter || p.status === filter),
  );
  const quotes = data.quotes.filter(
    (q) =>
      (!search || `${q.name} ${q.phone} ${q.city}`.toLowerCase().includes(search.toLowerCase())) &&
      (!filter || q.status === filter),
  );

  // Reuse the quotation table in both the overview and the full requests panel.
  function quoteTable(rows) {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>City</th>
              <th>Products</th>
              <th>Received</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td>
                  <b>{q.name}</b>
                  <div style={{ fontSize: 10, marginTop: 6 }}>{q.phone}</div>
                </td>
                <td>{q.city}</td>
                <td>{q.items.reduce((n, i) => n + i.quantity, 0)} items</td>
                <td>{formatDate(q.createdAt)}</td>
                <td>
                  <span className={`status ${q.status}`}>{q.status}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      onClick={() => {
                        setError('');
                        setModal({ kind: 'quote', item: q });
                      }}
                    >
                      <Eye size={13} /> View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="admin-empty">
            No quotation requests yet. New requests will appear here.
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="admin-shell">
      {/* Navigation and sign-out stay available across all management panels. */}
      <aside className={`admin-sidebar ${mobile ? 'open' : ''}`}>
        <Link className="admin-logo" href="/">
          <BrandLogo />
        </Link>
        <small>STORE MANAGEMENT</small>
        {navigation.map(([id, label, Icon]) => (
          <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>
            <Icon size={18} />
            {label}
            {id === 'quotes' && newQuotes > 0 && (
              <span style={{ marginLeft: 'auto' }}>{newQuotes}</span>
            )}
          </button>
        ))}
        <div className="sidebar-bottom">
          <Link href="/" target="_blank">
            <ExternalLink size={16} /> View storefront
          </Link>
          <button
            onClick={async () => {
              try {
                await api('auth/logout', 'POST');
                setUser(null);
                setData(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-header">
          <button
            className="admin-mobile-menu"
            aria-label="Toggle admin navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={22} />
          </button>
          <p>
            Administration <span style={{ color: '#c5cbd0', margin: '0 10px' }}>/</span>{' '}
            {titles[tab][0]}
          </p>
          <div>
            <span className="admin-avatar">
              <UserRound size={16} />
            </span>
            {user.email}
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-title">
            <div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <div>
              {tab === 'products' ? (
                <>
                  <input
                    ref={importRef}
                    hidden
                    type="file"
                    accept="application/json,.json"
                    onChange={importProducts}
                  />
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => importRef.current.click()}
                  >
                    <Upload size={15} /> Import JSON
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download('powerplanet-catalog.json', JSON.stringify(data.products, null, 2))
                    }
                  >
                    <Download size={15} /> Export
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setError('');
                      setModal({ kind: 'products', item: { ...emptyProduct } });
                    }}
                  >
                    <Plus size={15} /> Add product
                  </button>
                </>
              ) : tab === 'categories' || tab === 'faqs' ? (
                <button
                  className="primary"
                  onClick={() => {
                    setError('');
                    setModal({
                      kind: tab,
                      item:
                        tab === 'categories'
                          ? { name: '', parentId: null }
                          : { question: '', keywords: '', answer: '' },
                    });
                  }}
                >
                  <Plus size={15} /> Add {tab === 'categories' ? 'category' : 'reply'}
                </button>
              ) : tab === 'dashboard' ? (
                <Link className="secondary" href="/" target="_blank">
                  View storefront <ExternalLink size={14} />
                </Link>
              ) : null}
            </div>
          </div>
          {error && !modal && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="admin-message" role="status">
              {notice}
            </p>
          )}
          {tab === 'dashboard' ? (
            <>
              {preview > 0 && (
                <div className="admin-notice">
                  <AlertCircle size={19} />
                  <span>
                    <b>Your catalog is in preview.</b> {preview} illustrative products need review.
                    Facebook did not provide accessible product data. Add verified product details,
                    images and prices, then publish each product. Update the catalog notice in Store
                    Settings when ready.
                  </span>
                </div>
              )}
              <div className="stats-grid">
                {[
                  [
                    Package,
                    'Total products',
                    data.products.length,
                    `${data.products.filter((p) => p.status === 'published').length} published`,
                  ],
                  [
                    ClipboardList,
                    'New quotations',
                    newQuotes,
                    `${data.quotes.length} total requests`,
                  ],
                  [
                    Layers,
                    'Solar categories',
                    data.categories.length,
                    `${data.categories.filter((c) => !c.parentId).length} main categories`,
                  ],
                  [MessageCircle, 'Chat conversations', data.chats.length, 'Latest 100 messages'],
                ].map(([Icon, label, value, note]) => (
                  <div className="stat-card" key={label}>
                    <div>
                      <p>{label}</p>
                      <b>{value}</b>
                      <small>{note}</small>
                    </div>
                    <span>
                      <Icon size={22} />
                    </span>
                  </div>
                ))}
              </div>
              <section className="admin-panel">
                <div className="panel-heading">
                  <h2>Recent quotation requests</h2>
                  <button onClick={() => setTab('quotes')}>View all requests →</button>
                </div>
                {quoteTable(data.quotes.slice(0, 5))}
              </section>
              <div className="dashboard-bottom">
                <section className="admin-panel">
                  <div className="panel-heading">
                    <h2>Store readiness</h2>
                    <button onClick={() => setTab('settings')}>Manage →</button>
                  </div>
                  <div className="setup-checklist">
                    {[
                      [
                        !!data.settings.phone,
                        'Business contact',
                        'Add your verified phone number and address.',
                      ],
                      [
                        data.products.some((p) => p.status === 'published'),
                        'Verified products',
                        'Review product details and publish your catalog.',
                      ],
                      [
                        data.faqs.length > 0,
                        'Automated replies',
                        'Your assistant answers from your saved FAQ content.',
                      ],
                      [
                        !!data.settings.whatsapp,
                        'WhatsApp contact',
                        'Add your business number to enable chat handoff.',
                      ],
                    ].map(([done, title, desc]) => (
                      <div className={done ? 'complete' : ''} key={title}>
                        {done ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span>
                          {title}
                          <small>{desc}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="admin-panel">
                  <div className="panel-heading">
                    <h2>Catalog at a glance</h2>
                    <button onClick={() => setTab('products')}>Manage →</button>
                  </div>
                  <div className="setup-checklist">
                    {data.categories
                      .filter((c) => !c.parentId)
                      .map((c) => (
                        <div key={c.id}>
                          <Package size={17} />
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <b>
                            {
                              data.products.filter((p) => {
                                const cat = data.categories.find((x) => x.id === p.categoryId);
                                return p.categoryId === c.id || cat?.parentId === c.id;
                              }).length
                            }
                          </b>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </>
          ) : tab === 'products' ? (
            <section className="admin-panel">
              <div className="admin-toolbar">
                <Search size={17} color="#95a0aa" />
                <input
                  placeholder="Search products or brands…"
                  aria-label="Search catalog"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter product status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option>draft</option>
                  <option>preview</option>
                  <option>published</option>
                </select>
                <small>{products.length} products</small>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price (PKR)</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="table-product">
                            <img src={p.image} alt="" />
                            <div>
                              <b>{p.name}</b>
                              <small>{p.brand || 'No brand'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {data.categories.find((c) => c.id === p.categoryId)?.name ||
                            'Uncategorized'}
                        </td>
                        <td>{p.price === null ? 'On request' : p.price.toLocaleString()}</td>
                        <td>{p.stock}</td>
                        <td>
                          <span className={`status ${p.status}`}>{p.status}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              aria-label={`Edit ${p.name}`}
                              onClick={() => {
                                setError('');
                                setModal({ kind: 'products', item: p });
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              aria-label={`Delete ${p.name}`}
                              onClick={() => remove('products', p)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!products.length && (
                  <div className="admin-empty">No products match your filters.</div>
                )}
              </div>
            </section>
          ) : tab === 'categories' ? (
            <section className="admin-panel">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Category name</th>
                      <th>Parent category</th>
                      <th>Direct products</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <b>{c.name}</b>
                        </td>
                        <td>
                          {data.categories.find((p) => p.id === c.parentId)?.name ||
                            'Main category'}
                        </td>
                        <td>{data.products.filter((p) => p.categoryId === c.id).length}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              aria-label={`Edit ${c.name}`}
                              onClick={() => {
                                setError('');
                                setModal({ kind: 'categories', item: c });
                              }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              aria-label={`Delete ${c.name}`}
                              onClick={() => remove('categories', c)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : tab === 'quotes' ? (
            <section className="admin-panel">
              <div className="admin-toolbar">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, city or phone…"
                  aria-label="Search quotations"
                />
                <select
                  aria-label="Filter quotation status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {['new', 'contacted', 'quoted', 'completed', 'cancelled'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <small>{quotes.length} requests</small>
              </div>
              {quoteTable(quotes)}
            </section>
          ) : tab === 'orders' ? (
            <AdminOrders
              orders={data.orders || []}
              save={save}
              busy={busy}
              notificationConfig={data.notificationConfig}
              refresh={refresh}
            />
          ) : tab === 'faqs' ? (
            <>
              <div className="admin-notice">
                <MessageCircle size={19} />
                <span>
                  The assistant matches customer messages to the keywords below and returns your
                  saved answers. English and Roman Urdu keywords are supported. It also looks up
                  published product prices. No external AI key is required.
                </span>
              </div>
              <section className="admin-panel">
                {data.faqs.map((f) => (
                  <div className="faq-row" key={f.id}>
                    <div>
                      <h3>{f.question}</h3>
                      <p>{f.answer}</p>
                      <small>Keywords: {f.keywords}</small>
                    </div>
                    <div className="table-actions">
                      <button
                        aria-label={`Edit ${f.question}`}
                        onClick={() => {
                          setError('');
                          setModal({ kind: 'faqs', item: f });
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button aria-label={`Delete ${f.question}`} onClick={() => remove('faqs', f)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {!data.faqs.length && (
                  <div className="admin-empty">Add a reply to get started.</div>
                )}
              </section>
            </>
          ) : tab === 'chats' ? (
            <section className="admin-panel">
              {data.chats.length ? (
                data.chats.map((c) => (
                  <div className="chat-log" key={c.id}>
                    <small>{new Date(c.createdAt).toLocaleString('en-PK')}</small>
                    <p>
                      <b>Customer:</b> {c.message}
                    </p>
                    <p className="reply">
                      <b>Assistant:</b> {c.reply}
                    </p>
                  </div>
                ))
              ) : (
                <div className="admin-empty">
                  No conversations yet. Website chat messages will appear here.
                </div>
              )}
            </section>
          ) : tab === 'settings' ? (
            <section className="admin-panel">
              <BrandingSettings />
              <SettingsForm
                item={data.settings}
                save={(item) => save('settings', item)}
                busy={busy}
              />
            </section>
          ) : null}
        </main>
      </div>
      {/* Shared dialog hosts the selected record form or deletion confirmation. */}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.kind === 'delete' ? 'Confirm deletion' : 'Edit store record'}
          >
            <div className="modal-heading">
              <h2>
                {modal.kind === 'delete'
                  ? 'Delete this record?'
                  : modal.kind === 'quote'
                    ? 'Quotation request'
                    : `${modal.item.id ? 'Edit' : 'Add'} ${modal.kind === 'products' ? 'product' : modal.kind === 'categories' ? 'category' : 'chatbot reply'}`}
              </h2>
              <button aria-label="Close dialog" disabled={busy} onClick={() => setModal(null)}>
                <X size={20} />
              </button>
            </div>
            {error && (
              <p className="error" role="alert" style={{ margin: 20 }}>
                {error}
              </p>
            )}
            {modal.kind === 'products' ? (
              <ProductForm
                item={modal.item}
                categories={data.categories}
                save={(i) => save('products', i)}
                busy={busy}
              />
            ) : modal.kind === 'categories' ? (
              <CategoryForm
                item={modal.item}
                categories={data.categories}
                save={(i) => save('categories', i)}
                busy={busy}
              />
            ) : modal.kind === 'faqs' ? (
              <FaqForm item={modal.item} save={(i) => save('faqs', i)} busy={busy} />
            ) : modal.kind === 'delete' ? (
              <div className="admin-form">
                <p>
                  Delete <b>{modal.item.name || modal.item.question}</b>? This cannot be undone.
                </p>
                <div className="form-actions">
                  <button className="primary" disabled={busy} onClick={confirmDelete}>
                    Delete record
                  </button>
                  <button className="secondary" onClick={() => setModal(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="quote-detail">
                <p>
                  <b>{modal.item.name}</b>
                  <br />
                  {modal.item.phone}
                  <br />
                  {modal.item.email}
                  <br />
                  {modal.item.city}
                </p>
                <p>
                  <b>Received:</b> {new Date(modal.item.createdAt).toLocaleString('en-PK')}
                </p>
                <p>
                  <b>Message:</b>
                  <br />
                  {modal.item.message || 'No additional message'}
                </p>
                <h3>Requested products</h3>
                {modal.item.items.length ? (
                  <ul>
                    {modal.item.items.map((i, n) => (
                      <li key={n}>
                        {i.name} × {i.quantity}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>General solar inquiry</p>
                )}
                <label>
                  Status{' '}
                  <select
                    aria-label="Quotation status"
                    value={modal.item.status}
                    disabled={busy}
                    onChange={(e) =>
                      setModal({ ...modal, item: { ...modal.item, status: e.target.value } })
                    }
                  >
                    {['new', 'contacted', 'quoted', 'completed', 'cancelled'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => save('quotes', modal.item)}
                  >
                    <Save size={15} /> Save status
                  </button>
                </div>
                <p className="muted">Reference: {modal.item.id}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// Authenticate before loading any private store-management data.
function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('auth/login', 'POST', Object.fromEntries(new FormData(e.currentTarget))));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <form className="login-card" onSubmit={submit}>
        <div className="admin-logo">
          <BrandLogo />
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to manage your solar store.</p>
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="Your administrator email"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in to administration'}
          <ArrowUpRight size={16} />
        </button>
        <Link href="/">← Back to Powerplanet</Link>
      </form>
    </main>
  );
}

// Keep editable prices as strings; convert blanks to null only when saving.
function ProductForm({ item, categories, save, busy }) {
  const [formValues, setFormValues] = useState({
    ...item,
    price: item.price ?? '',
    originalPrice: item.originalPrice ?? '',
  });
  const updateField = (key, value) => setFormValues({ ...formValues, [key]: value });
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          ...formValues,
          price: formValues.price === '' ? null : Number(formValues.price),
          originalPrice: formValues.originalPrice === '' ? null : Number(formValues.originalPrice),
          stock: Number(formValues.stock),
        });
      }}
    >
      <label>
        Product name *
        <input
          value={formValues.name}
          required
          maxLength={200}
          onChange={(e) => updateField('name', e.target.value)}
        />
      </label>
      <div className="form-row">
        <label>
          Category *
          <select
            required
            value={formValues.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '↳ ' : ''}
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Brand
          <input
            value={formValues.brand}
            maxLength={100}
            onChange={(e) => updateField('brand', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Price (PKR)
          <input
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            value={formValues.price}
            placeholder="Leave blank for quotation"
            onChange={(e) => updateField('price', e.target.value)}
          />
        </label>
        <label>
          Stock quantity *
          <input
            type="number"
            min="0"
            max="1000000"
            required
            value={formValues.stock}
            onChange={(e) => updateField('stock', e.target.value)}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Original price (before sale)
          <input
            type="number"
            min="0"
            step="0.01"
            value={formValues.originalPrice}
            onChange={(e) => updateField('originalPrice', e.target.value)}
          />
        </label>
        <label>
          Availability
          <select
            value={formValues.availability || 'on-request'}
            onChange={(e) => updateField('availability', e.target.value)}
          >
            <option value="in-stock">In Stock</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="on-request">On request</option>
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Publication status
          <select value={formValues.status} onChange={(e) => updateField('status', e.target.value)}>
            <option value="draft">Draft — hidden from store</option>
            <option value="preview">Preview — unverified entry</option>
            <option value="published">Published — verified product</option>
          </select>
        </label>
        <label>
          Product image URL
          <input
            value={formValues.image}
            required
            onChange={(e) => updateField('image', e.target.value)}
            placeholder="https://…"
          />
        </label>
      </div>
      <small>
        Imported real photos use /images/catalog/. You can also use an HTTPS image URL or a local
        illustration: /images/panel.svg, /images/inverter.svg, /images/battery.svg,
        /images/portable.svg, /images/accessory.svg.
      </small>
      <label>
        Description
        <textarea
          value={formValues.description}
          maxLength={5000}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </label>
      <label>
        Specifications
        <textarea
          value={formValues.specs}
          maxLength={5000}
          onChange={(e) => updateField('specs', e.target.value)}
        />
      </label>
      <label>
        Source / verification notes
        <input
          value={formValues.source || ''}
          maxLength={2000}
          onChange={(e) => updateField('source', e.target.value)}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={formValues.featured}
          onChange={(e) => updateField('featured', e.target.checked)}
        />{' '}
        Featured on homepage
      </label>
      <button className="primary" disabled={busy}>
        <Save size={15} />
        {busy ? 'Saving…' : 'Save product'}
      </button>
    </form>
  );
}

// A null parent creates a top-level category; exclude the category itself as a parent.
function CategoryForm({ item, categories, save, busy }) {
  const [formValues, setFormValues] = useState(item);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(formValues);
      }}
    >
      <label>
        Category name *
        <input
          required
          maxLength={200}
          value={formValues.name}
          onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
        />
      </label>
      <label>
        Parent category
        <select
          value={formValues.parentId || ''}
          onChange={(e) => setFormValues({ ...formValues, parentId: e.target.value || null })}
        >
          <option value="">Main category</option>
          {categories
            .filter((c) => c.id !== formValues.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <button className="primary" disabled={busy}>
        <Save size={15} /> Save category
      </button>
    </form>
  );
}

// Store the keyword matches and the exact reply used by the website assistant.
function FaqForm({ item, save, busy }) {
  const [formValues, setFormValues] = useState(item);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(formValues);
      }}
    >
      <label>
        Question / title *
        <input
          required
          maxLength={200}
          value={formValues.question}
          onChange={(e) => setFormValues({ ...formValues, question: e.target.value })}
        />
      </label>
      <label>
        Keywords (comma-separated) *
        <input
          required
          maxLength={200}
          value={formValues.keywords}
          placeholder="price,rate,cost,qeemat"
          onChange={(e) => setFormValues({ ...formValues, keywords: e.target.value })}
        />
      </label>
      <label>
        Automatic reply *
        <textarea
          required
          maxLength={3000}
          rows={6}
          value={formValues.answer}
          onChange={(e) => setFormValues({ ...formValues, answer: e.target.value })}
        />
      </label>
      <button className="primary" disabled={busy}>
        <Save size={15} /> Save reply
      </button>
    </form>
  );
}

// Contact details and homepage copy are saved together as the store settings record.
function SettingsForm({ item, save, busy }) {
  const [formValues, setFormValues] = useState(item);
  const renderContactField = (key, label, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={formValues[key]}
        onChange={(e) => setFormValues({ ...formValues, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        save(formValues);
      }}
    >
      {/* Empty contact details are intentionally hidden from the storefront. */}
      <h3>Business details</h3>
      <div className="form-row">
        {renderContactField('name', 'Store name')}
        {renderContactField('tagline', 'Tagline')}
      </div>
      <div className="form-row">
        {renderContactField('phone', 'Business phone')}
        {renderContactField('email', 'Business email', 'email')}
      </div>
      {renderContactField('address', 'Business address')}
      <div className="form-row">
        {renderContactField('facebook', 'Facebook page URL', 'url')}
        {renderContactField('whatsapp', 'WhatsApp number (country code + digits, without +)')}
      </div>
      <small>
        Only enter confirmed business contact details. Empty contact fields are hidden from the
        storefront.
      </small>
      {/* These fields control customer-facing copy on the homepage. */}
      <h3 style={{ marginTop: 30 }}>Homepage content</h3>
      <label>
        Hero title
        <textarea
          value={formValues.heroTitle}
          maxLength={200}
          onChange={(e) => setFormValues({ ...formValues, heroTitle: e.target.value })}
        />
      </label>
      <label>
        Hero subtitle
        <textarea
          value={formValues.heroSubtitle}
          maxLength={500}
          onChange={(e) => setFormValues({ ...formValues, heroSubtitle: e.target.value })}
        />
      </label>
      <label>
        Catalog notice
        <textarea
          value={formValues.catalogNotice}
          maxLength={500}
          onChange={(e) => setFormValues({ ...formValues, catalogNotice: e.target.value })}
        />
      </label>
      <small>Remove the preview notice only after verifying your catalog.</small>
      <button className="primary" disabled={busy}>
        <Save size={15} />
        {busy ? 'Saving…' : 'Save store settings'}
      </button>
    </form>
  );
}
