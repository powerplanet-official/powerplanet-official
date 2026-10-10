import Stripe from 'stripe';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, get, put } from './db.mjs';
import {
  enqueueOrderConfirmation,
  notificationConfig,
  normalizeWhatsAppPhone,
} from './notifications.mjs';

export class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
const required = z.string().trim().min(1).max(200);
const checkoutSchema = z.object({
  name: required,
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{7,25}$/),
  email: z.union([z.email(), z.literal('')]).default(''),
  city: required,
  address: z.string().trim().min(10).max(500),
  message: z.string().trim().max(3000).default(''),
  paymentMethod: z.enum(['cod', 'card']),
  checkoutKey: z.uuid(),
  whatsappConsent: z.boolean().default(false),
  expectedTotal: z.number().int().nonnegative().optional(),
  items: z
    .array(z.object({ id: required, quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(100),
});
function origin() {
  try {
    const url = new URL(process.env.PUBLIC_SITE_URL);
    if (
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function paymentConfig() {
  return {
    cod: true,
    card: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && origin()),
    testMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false,
    currency: 'PKR',
    notifications: notificationConfig(),
  };
}
export function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
}
export function publicOrder(order) {
  return {
    id: order.id,
    items: order.items,
    total: order.total,
    knownSubtotal: order.knownSubtotal,
    requiresConfirmation: order.requiresConfirmation,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt,
  };
}
export function authorizedOrder(id, key) {
  const order = get('orders', id);
  if (!order || typeof key !== 'string' || order.keyHash !== hash(key))
    throw new CheckoutError('Order not found', 404);
  return order;
}
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
function releaseStock(order) {
  if (order.stockReleased) return order;
  for (const item of order.items) {
    const product = get('products', item.id);
    // Older orders reserved every unit; new COD inquiries may reserve none.
    const reserved = item.reservedQuantity ?? item.quantity;
    if (product && reserved > 0) put('products', { ...product, stock: product.stock + reserved });
  }
  return { ...order, stockReleased: true };
}
export async function checkout(body, gatewayFactory = stripeClient) {
  const input = checkoutSchema.parse(body);
  if (input.whatsappConsent && !normalizeWhatsAppPhone(input.phone))
    throw new CheckoutError('Enter a valid WhatsApp number with country code.');
  const keyHash = hash(input.checkoutKey);
  const { checkoutKey, ...payload } = input;
  const fingerprint = hash(JSON.stringify(payload));
  const previous = get('checkoutKeys', keyHash);
  let order;
  if (previous) {
    order = get('orders', previous.orderId);
    if (order.fingerprint !== fingerprint)
      throw new CheckoutError(
        'This checkout has already been submitted. Start a new checkout for changed details.',
        409,
      );
  } else {
    if (input.paymentMethod === 'card' && !paymentConfig().card)
      throw new CheckoutError(
        'Card payments are currently unavailable. Please choose Cash on Delivery.',
        503,
      );
    order = transaction(() => {
      const ids = new Set();
      const items = input.items.map((item) => {
        if (ids.has(item.id)) throw new CheckoutError('Duplicate products are not allowed');
        ids.add(item.id);
        const p = get('products', item.id);
        if (!p || p.status === 'draft')
          throw new CheckoutError(
            'An item is no longer listed. Please remove it from your basket.',
          );
        const confirmedPrice = p.status === 'published' && Number.isFinite(p.price) && p.price > 0;
        const confirmedStock =
          Number.isFinite(p.stock) &&
          p.stock >= item.quantity &&
          !['out-of-stock', 'on-request'].includes(p.availability);
        if (input.paymentMethod === 'card' && !confirmedPrice)
          throw new CheckoutError(
            'Choose Cash on Delivery so our team can confirm the price with you.',
          );
        if (item.quantity < (p.minQuantity || 1))
          throw new CheckoutError(`Minimum quantity for ${p.name} is ${p.minQuantity}`);
        if (input.paymentMethod === 'card' && !confirmedStock)
          throw new CheckoutError(
            'Choose Cash on Delivery so our team can confirm availability with you.',
          );
        return {
          id: p.id,
          name: p.name,
          quantity: item.quantity,
          unitAmount: confirmedPrice ? Math.round(p.price * 100) : null,
          reservedQuantity: confirmedStock ? item.quantity : 0,
          requiresConfirmation: !confirmedPrice || !confirmedStock,
        };
      });
      const knownSubtotal = items.reduce(
        (sum, item) => sum + (item.unitAmount || 0) * item.quantity,
        0,
      );
      const total = items.every((item) => item.unitAmount !== null) ? knownSubtotal : null;
      if (!Number.isSafeInteger(knownSubtotal))
        throw new CheckoutError('Please contact our team to place this order.');
      if (input.paymentMethod === 'card') {
        if (input.expectedTotal !== undefined && input.expectedTotal !== total)
          throw new CheckoutError(
            'Product prices have changed. Reload checkout to review the updated total before ordering.',
            422,
          );
        if (total === null || total < 100 || total > 99999999)
          throw new CheckoutError('Please choose Cash on Delivery for this order.');
      }
      for (const item of items) {
        if (!item.reservedQuantity) continue;
        const p = get('products', item.id);
        put('products', { ...p, stock: p.stock - item.reservedQuantity });
      }
      const requiresConfirmation = items.some((item) => item.requiresConfirmation);
      const saved = put('orders', {
        ...payload,
        items,
        id: randomUUID(),
        keyHash,
        fingerprint,
        currency: 'pkr',
        total,
        knownSubtotal,
        requiresConfirmation,
        status: input.paymentMethod === 'cod' ? 'new' : 'payment_pending',
        paymentStatus: input.paymentMethod === 'cod' ? 'due_on_delivery' : 'pending',
        createdAt: new Date().toISOString(),
      });
      put('checkoutKeys', { id: keyHash, orderId: saved.id });
      enqueueOrderConfirmation(saved);
      return saved;
    });
  }
  if (order.paymentMethod === 'cod' || order.paymentStatus !== 'pending')
    return { order: publicOrder(order) };
  if (order.checkoutUrl) return { order: publicOrder(order), checkoutUrl: order.checkoutUrl };
  try {
    const session = await gatewayFactory().checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        ...(order.email ? { customer_email: order.email } : {}),
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: 'pkr',
            unit_amount: item.unitAmount,
            product_data: { name: item.name },
          },
        })),
        success_url: `${origin()}/checkout?order=${order.id}`,
        cancel_url: `${origin()}/checkout?order=${order.id}&cancelled=1`,
      },
      { idempotencyKey: order.id },
    );
    // A webhook may have arrived while the request was in flight.
    order = put('orders', {
      ...get('orders', order.id),
      stripeSessionId: session.id,
      checkoutUrl: session.url,
    });
    return { order: publicOrder(order), checkoutUrl: session.url };
  } catch (error) {
    if (
      ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(
        error.type,
      )
    ) {
      transaction(() => {
        const current = get('orders', order.id);
        if (current.paymentStatus === 'pending')
          put('orders', { ...releaseStock(current), status: 'cancelled', paymentStatus: 'failed' });
      });
      throw new CheckoutError(
        'The payment provider could not accept this order. Please choose COD or contact our team.',
      );
    }
    // Keep the reservation and idempotency key: a timeout may still have created a payable session.
    throw new CheckoutError(
      'The card gateway could not be reached. Retry with the same details to safely resume this order.',
      502,
    );
  }
}
export function applyStripeEvent(event) {
  if (
    ![
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.expired',
      'checkout.session.async_payment_failed',
    ].includes(event.type)
  )
    return;
  const session = event.data.object;
  if (typeof session.metadata?.orderId !== 'string') return;
  transaction(() => {
    const order = get('orders', session.metadata?.orderId);
    if (!order || order.paymentMethod !== 'card') return;
    if (
      session.client_reference_id !== order.id ||
      (order.stripeSessionId && order.stripeSessionId !== session.id) ||
      session.currency !== order.currency ||
      session.amount_total !== order.total
    )
      throw new CheckoutError('Payment does not match the order');
    if (order.paymentStatus === 'paid') return;
    if (
      ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type,
      )
    ) {
      if (session.payment_status !== 'paid') return;
      if (order.stockReleased) throw new CheckoutError('Payment requires manual review', 409);
      const paid = put('orders', {
        ...order,
        stripeSessionId: session.id,
        paymentStatus: 'paid',
        status: 'new',
        paidAt: new Date().toISOString(),
      });
      enqueueOrderConfirmation(paid);
    } else {
      put('orders', {
        ...releaseStock(order),
        stripeSessionId: session.id,
        paymentStatus: event.type.endsWith('expired') ? 'expired' : 'failed',
        status: 'cancelled',
      });
    }
  });
}
export async function stripeWebhook(req, res) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET)
    return res.status(503).json({ error: 'Card payments are not configured' });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      req.body,
      req.get('stripe-signature'),
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }
  try {
    applyStripeEvent(event);
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: 'Payment reconciliation requires review' });
  }
}
export function updateOrder(id, body) {
  const status = z
    .enum(['new', 'processing', 'shipped', 'delivered', 'cancelled'])
    .parse(body.status);
  return transaction(() => {
    let order = get('orders', id);
    if (!order) throw new CheckoutError('Order not found', 404);
    if (order.status === status) return publicOrder(order);
    const transitions = {
      new: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (order.paymentMethod === 'card' && order.paymentStatus !== 'paid')
      throw new CheckoutError('Await verified card payment before fulfilling this order.', 409);
    if (!(transitions[order.status] || []).includes(status))
      throw new CheckoutError('Invalid order status transition', 409);
    if (status === 'cancelled') {
      if (order.paymentStatus === 'paid')
        throw new CheckoutError(
          'Paid card orders require a refund through the payment provider. Contact support before cancelling.',
          409,
        );
      order = { ...releaseStock(order), paymentStatus: 'cancelled' };
    }
    if (status === 'delivered' && order.paymentMethod === 'cod')
      order = { ...order, paymentStatus: 'paid', paidAt: new Date().toISOString() };
    return publicOrder(put('orders', { ...order, status }));
  });
}

export async function cancelCardOrder(id, key, gatewayFactory = stripeClient) {
  let order = authorizedOrder(id, key);
  if (order.paymentMethod !== 'card')
    throw new CheckoutError('Contact our team to cancel a COD order.', 409);
  if (order.paymentStatus === 'paid')
    throw new CheckoutError('Payment has already completed. Contact our team for a refund.', 409);
  if (order.status === 'cancelled') return publicOrder(order);
  if (!order.stripeSessionId) {
    await checkout(
      {
        ...order,
        checkoutKey: key,
        items: order.items.map(({ id, quantity }) => ({ id, quantity })),
      },
      gatewayFactory,
    );
    order = get('orders', id);
  }
  const gateway = gatewayFactory();
  let session = await gateway.checkout.sessions.retrieve(order.stripeSessionId);
  if (session.status === 'open')
    session = await gateway.checkout.sessions.expire(order.stripeSessionId);
  if (session.status === 'expired')
    applyStripeEvent({ type: 'checkout.session.expired', data: { object: session } });
  else {
    if (session.payment_status === 'paid')
      applyStripeEvent({ type: 'checkout.session.completed', data: { object: session } });
    throw new CheckoutError(
      'Payment is already being processed. Please wait for confirmation.',
      409,
    );
  }
  return publicOrder(get('orders', id));
}
