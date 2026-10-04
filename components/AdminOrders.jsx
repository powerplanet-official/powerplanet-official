'use client';

import { useState } from 'react';
const money = (value) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(value / 100);
// Review fulfillment and payment states, with retries for failed order notifications.
export default function AdminOrders({ orders, save, busy, notificationConfig, refresh }) {
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState(null),
    [status, setStatus] = useState(''),
    [notice, setNotice] = useState('');
  const current = orders.find((o) => o.id === selected);
  const transitions = {
    new: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
  };
  async function retry() {
    try {
      const r = await fetch(`/api/admin/orders/${current.id}/notifications/retry`, {
        method: 'POST',
      });
      if (!r.ok) throw Error('Could not queue notifications');
      setNotice(
        'Unsent confirmations queued. Configured channels will be processed automatically.',
      );
      await refresh();
    } catch (e) {
      setNotice(e.message);
    }
  }
  return (
    <section className="admin-panel">
      <div className="admin-notice">
        <span>
          <b>Order confirmations</b> · Email:{' '}
          {notificationConfig?.email ? 'SMTP configured' : 'SMTP configuration needed'} · WhatsApp:{' '}
          {notificationConfig?.whatsapp ? 'API configured' : 'Business API configuration needed'}
        </span>
      </div>
      <div className="admin-toolbar">
        <input
          aria-label="Search orders"
          placeholder="Search reference, customer or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <small>{orders.length} orders</small>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Total</th>
              <th>Method</th>
              <th>Payment</th>
              <th>Order status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders
              .filter((o) =>
                `${o.id} ${o.name} ${o.phone}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.name}</b>
                    <p>{o.phone}</p>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>{o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card'}</td>
                  <td>{o.paymentStatus.replaceAll('_', ' ')}</td>
                  <td>{o.status.replaceAll('_', ' ')}</td>
                  <td>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSelected(o.id);
                        setStatus(o.status);
                      }}
                    >
                      View order
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!orders.length && <p className="admin-empty">New checkout orders will appear here.</p>}
      </div>
      {current && (
        <div className="quote-detail">
          <h2>Order details</h2>
          <p className="order-reference">Reference: {current.id}</p>
          <p>
            <b>{current.name}</b>
            <br />
            {current.phone}
            <br />
            {current.email}
            <br />
            {current.address}
            <br />
            {current.city}
          </p>
          <p>{current.message}</p>
          <ul>
            {current.items.map((i) => (
              <li key={i.id}>
                {i.name} × {i.quantity} — {money(i.unitAmount * i.quantity)}
              </li>
            ))}
          </ul>
          <p>
            Total: <b>{money(current.total)}</b>
          </p>
          <p>
            Payment: {current.paymentMethod.toUpperCase()} ·{' '}
            {current.paymentStatus.replaceAll('_', ' ')}
          </p>
          {current.paymentMethod === 'card' && current.paymentStatus !== 'paid' ? (
            <p>
              Await verified payment before dispatch. Unpaid card reservations are released when the
              payment session expires and its webhook is received.
            </p>
          ) : (
            <>
              <label>
                Order status
                <select
                  aria-label="Order status"
                  value={status}
                  disabled={busy}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value={current.status}>{current.status}</option>
                  {(transitions[current.status] || [])
                    .filter((s) => !(s === 'cancelled' && current.paymentStatus === 'paid'))
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
              {current.paymentMethod === 'cod' && status === 'delivered' && (
                <p>
                  Mark delivered only after cash has been collected. This marks the order as paid.
                </p>
              )}
              <button
                className="primary"
                disabled={busy || status === current.status}
                onClick={() => save('orders', { id: current.id, status })}
              >
                Save order status
              </button>
            </>
          )}
          <h3>Order confirmations</h3>
          {current.notifications?.length ? (
            <ul>
              {current.notifications.map((n) => (
                <li key={n.id}>
                  {n.channel === 'email' ? 'Email' : 'WhatsApp'} ({n.audience}) — <b>{n.status}</b>
                  {n.lastError && <small> · {n.lastError}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No confirmations queued. A customer email or WhatsApp opt-in is needed; card orders
              also require verified payment.
            </p>
          )}
          <p className="muted">
            Accepted means the provider accepted the message; it does not confirm inbox delivery or
            a read receipt.
          </p>
          <button className="secondary" onClick={retry}>
            Retry unsent confirmations
          </button>
          {notice && <p role="status">{notice}</p>}
          <button className="secondary" onClick={() => setSelected(null)}>
            Close details
          </button>
        </div>
      )}
    </section>
  );
}
