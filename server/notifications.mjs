import nodemailer from 'nodemailer';
import { z } from 'zod';
import { all, get, put } from './db.mjs';

const validEmail = (value) => z.email().safeParse(value).success;
export function notificationConfig() {
  return {
    email: Boolean(
      process.env.SMTP_HOST &&
      validEmail(process.env.SMTP_FROM) &&
      (!process.env.SMTP_USER || process.env.SMTP_PASS),
    ),
    whatsapp: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN &&
      /^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID || '') &&
      /^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION || '') &&
      process.env.WHATSAPP_ORDER_TEMPLATE,
    ),
  };
}
export function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = '92' + digits.slice(1);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
// Enqueue inside the order transaction so an accepted order cannot lose its notification.
export function enqueueOrderConfirmation(order) {
  if (
    order.status === 'cancelled' ||
    (order.paymentMethod === 'card' && order.paymentStatus !== 'paid')
  )
    return;
  const targets = [
    ['email', order.email, 'customer'],
    ['email', process.env.ORDER_NOTIFICATION_EMAIL, 'store'],
  ];
  if (order.whatsappConsent)
    targets.push(['whatsapp', normalizeWhatsAppPhone(order.phone), 'customer']);
  for (const [channel, to, audience] of targets) {
    if (!to || (channel === 'email' && !validEmail(to))) continue;
    const id = `${order.id}:${channel}:${audience}`;
    if (!get('notifications', id))
      put('notifications', {
        id,
        orderId: order.id,
        channel,
        audience,
        to,
        status: 'queued',
        attempts: 0,
        nextAttemptAt: 0,
        createdAt: new Date().toISOString(),
      });
  }
}
const money = (amount) =>
  amount == null
    ? 'To be confirmed'
    : `PKR ${(amount / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export function confirmationEmail(order, audience = 'customer') {
  const store = get('settings', 'store');
  const brand = store?.name || 'Power Planet';
  const payment =
    order.paymentMethod === 'cod'
      ? 'Cash on Delivery — payment due on delivery'
      : 'Card — payment verified';
  const orderLabel = order.paymentMethod === 'cod' ? 'Order received' : 'Order confirmed';
  const subject = `${brand}: ${audience === 'store' ? 'New order' : orderLabel} ${order.id}`;
  const text = [
    `${brand} — ${orderLabel}`,
    `Hello ${order.name},`,
    `Order reference: ${order.id}`,
    ...order.items.map(
      (i) =>
        `${i.name} x ${i.quantity}: ${money(i.unitAmount == null ? null : i.unitAmount * i.quantity)}`,
    ),
    `Product total: ${money(order.total)}`,
    `Payment: ${payment}`,
    `Delivery: ${order.address}, ${order.city}`,
    `Phone: ${order.phone}`,
    order.message ? `Order notes: ${order.message}` : '',
    'Delivery or installation charges, if applicable, will be agreed separately before dispatch.',
    `Our team will contact you to confirm availability, the final amount and delivery.${store?.phone ? ' Contact: ' + store.phone : ''}`,
  ]
    .filter(Boolean)
    .join('\n');
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:12px;border-bottom:1px solid #eee">${escapeHtml(i.name)} × ${i.quantity}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #eee">${money(i.unitAmount == null ? null : i.unitAmount * i.quantity)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f0;font:15px Arial,sans-serif;color:#26301e"><main style="max-width:640px;margin:24px auto;background:white;padding:32px;border-top:6px solid #95bf3b"><h1 style="color:#54751e">${escapeHtml(brand)}</h1><h2>${order.paymentMethod === 'cod' ? 'Your order has been placed successfully' : 'Your order is confirmed'}</h2><p>Hello ${escapeHtml(order.name)},</p><p>Thank you for your order. Our team will contact you to confirm availability, the final amount and delivery.</p><p><b>Reference:</b> ${escapeHtml(order.id)}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="font-size:20px"><b>Product total: ${money(order.total)}</b></p><p>${payment}</p><h3>Delivery details</h3><p>${escapeHtml(order.address)}<br>${escapeHtml(order.city)}<br>${escapeHtml(order.phone)}</p>${order.message ? `<p>Notes: ${escapeHtml(order.message)}</p>` : ''}<p style="font-size:12px;color:#666">Delivery or installation charges, if applicable, will be agreed separately before dispatch.</p><p>${escapeHtml(store?.phone || '')}</p></main></body></html>`;
  return { subject, text, html };
}
export function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT || 587),
    secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
async function sendEmail(job, order) {
  const transport = createSmtpTransport();
  try {
    const info = await transport.sendMail({
      ...confirmationEmail(order, job.audience),
      from: {
        name: get('settings', 'store')?.name || 'Power Planet',
        address: process.env.SMTP_FROM,
      },
      to: job.to,
      messageId: `<${order.id}.${job.audience}@${process.env.SMTP_FROM.split('@')[1]}>`,
    });
    if (!info.accepted?.length) throw Error('SMTP recipient rejected');
    return { providerId: info.messageId };
  } finally {
    transport.close();
  }
}
export async function sendWhatsApp(job, order, fetcher = fetch) {
  const response = await fetcher(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: job.to,
        type: 'template',
        template: {
          name: process.env.WHATSAPP_ORDER_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                order.name,
                order.id,
                money(order.total),
                order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card payment received',
              ].map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    },
  );
  const body = await response.json();
  if (!response.ok || !body.messages?.[0]?.id) throw Error('WhatsApp provider rejected message');
  return { providerId: body.messages[0].id };
}
let running = false;
export async function processNotifications({ email = sendEmail, whatsapp = sendWhatsApp } = {}) {
  if (running) return;
  running = true;
  try {
    const now = Date.now(),
      config = notificationConfig();
    const jobs = all('notifications')
      .filter(
        (job) => ['queued', 'blocked', 'retry'].includes(job.status) && job.nextAttemptAt <= now,
      )
      .reverse()
      .slice(0, 20);
    for (const job of jobs) {
      const order = get('orders', job.orderId);
      if (
        !order ||
        order.status === 'cancelled' ||
        (order.paymentMethod === 'card' && order.paymentStatus !== 'paid')
      ) {
        put('notifications', { ...job, status: 'skipped', lastError: 'Order is not confirmed' });
        continue;
      }
      if (!config[job.channel]) {
        put('notifications', {
          ...job,
          status: 'blocked',
          lastError: `${job.channel === 'email' ? 'SMTP' : 'WhatsApp'} is not configured`,
          nextAttemptAt: now + 60000,
        });
        continue;
      }
      const attempt = {
        ...job,
        status: 'sending',
        attempts: job.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
      };
      put('notifications', attempt);
      try {
        const result = await (job.channel === 'email' ? email : whatsapp)(job, order);
        put('notifications', {
          ...attempt,
          status: 'accepted',
          providerId: result.providerId,
          acceptedAt: new Date().toISOString(),
          lastError: null,
        });
      } catch {
        // Keep credentials, provider response bodies and customer data out of logs.
        put('notifications', {
          ...attempt,
          status: attempt.attempts >= 5 ? 'failed' : 'retry',
          lastError:
            'Provider request failed. Check credentials, recipient and provider configuration.',
          nextAttemptAt: Date.now() + Math.min(3600000, 60000 * 2 ** (attempt.attempts - 1)),
        });
      }
    }
  } finally {
    running = false;
  }
}
export function retryOrderNotifications(orderId) {
  const order = get('orders', orderId);
  if (!order) return false;
  enqueueOrderConfirmation(order);
  for (const job of all('notifications').filter(
    (n) => n.orderId === orderId && ['failed', 'blocked', 'retry'].includes(n.status),
  ))
    put('notifications', { ...job, status: 'queued', nextAttemptAt: 0, attempts: 0 });
  return true;
}
export function startNotificationWorker() {
  // Sending at process termination has an uncertain outcome: surface it for manual review instead of duplicating a message.
  for (const job of all('notifications').filter((n) => n.status === 'sending'))
    put('notifications', {
      ...job,
      status: 'review',
      lastError: 'Server restarted during sending. Check the provider before resending.',
    });
  const run = () =>
    processNotifications().catch(() => console.error('Notification queue could not be processed'));
  void run();
  const timer = setInterval(run, 5000);
  timer.unref();
  return () => clearInterval(timer);
}
