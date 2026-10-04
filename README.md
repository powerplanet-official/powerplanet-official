# Powerplanet solar store

Next.js storefront and administration with a separate Express/Node.js API and persistent SQLite database. Requires Node.js 22.13+ (SQLite uses Node's built-in `node:sqlite`).

## Start locally

```bash
npm install
npm run setup
npm run catalog:import
# Read the generated private .env file for your administrator login.
npm run dev
```

Store: use the localhost URL printed at startup (the current workspace uses port 32853). Administration is `/admin` on the same URL. The port can be changed with PORT in `.env`.

The setup command creates a private `.env` with a random administrator password if it does not exist. To choose credentials yourself, copy `.env.example` to `.env`, edit ADMIN_EMAIL/ADMIN_PASSWORD, then run `npm run admin:create`.

Both processes start with `npm run dev`. Next.js proxies `/api/*` to the Node API at `127.0.0.1:4000`. The API is intentionally bound to localhost. API_PORT must match when building and running Next.js.

## Included

- Responsive solar storefront with category navigation, child categories, product details, search, sorting and brand filter.
- Persistent browser wishlist, comparison (up to four items), quotation basket and quantity controls.
- Validated quotation submissions stored in SQLite; prices and names come from the server catalog.
- Password-protected admin dashboard; product and category CRUD, draft/preview/published status, stock and pricing, bulk JSON import/export.
- Quotation review and status workflow, store contact/content settings, configurable chatbot replies and conversation history.
- Automatic English/Roman Urdu keyword replies and published-product lookup. This is a rules-based chatbot, not a generative AI integration. No AI subscription/key is required. Optional WhatsApp handoff appears after adding a business number in settings.
- Scrypt password hashing, expiring opaque sessions, HttpOnly/SameSite cookies, rate limiting, input validation and cross-site request rejection.

## Solar catalog and source

The current catalog is a **29 September 2026 snapshot of W11stop's public solar catalog**, as requested: **1,099 products, 94 brands, 47 categories and 107 sale prices**. All 40 source category collections were paginated and all 1,099 product detail pages were read. Actual source product photographs are stored locally as WebP files under `public/images/catalog/`; no AI-generated product images are used. Some source products share photographs. Prices include the reference's zero-price entries unchanged; these are not a promise of free products. Availability reflects the reference snapshot, not verified Power Planet warehouse inventory.

The source snapshot is `data/catalog-source/solar-catalog.json`. Each product retains its original URL, checked timestamp, exact current/sale price, minimum quantity, model, specifications, photographs and overlapping categories. The listing includes combined category/brand/availability/price filters, grid/list views, pagination and quantity controls. The existing header, footer and overall homepage layout are retained. The initial 12 example products are now drafts and are excluded from the public store.

To install the included catalog into a fresh database, run `npm run catalog:import` after setup. The importer validates coverage, product data and local photos, backs up SQLite to `data/backups/`, and updates imported products without deleting user-created products, quotations or settings. Re-importing replaces edits to source products; keep administrator changes in mind before refreshing.

To collect an updated public snapshot (requires Chromium, network access and dev dependencies):

```bash
# Set CHROMIUM_PATH to your Chromium executable if different.
# Remove /tmp/powerplanet-w11-catalog and /tmp/powerplanet-w11-details
# before a fresh network collection; otherwise successful responses are reused.
npm run catalog:collect
npm run catalog:enrich
npm run catalog:import
```

Collection is manual, not a live price synchronization service. A failed detail/image collection can be resumed with `npm run catalog:enrich -- --retry`. Review the resulting snapshot before importing.

Power Planet's logo comes from the public metadata of the supplied Facebook page (see `docs/source-notes.json`). The user-supplied number **0301 4101700** remains configured for calls and WhatsApp. The imported product information comes from **W11stop**, not an extracted or verified Power Planet Facebook inventory. Store Settings supports the remaining business contact details and chatbot terms.

The homepage hero displays four slides using local catalog product images. The basket supports checkout with Cash on Delivery or configured Stripe card payments, alongside quotation requests. Orders and quotations appear in admin. Order confirmations support Nodemailer SMTP and the Meta WhatsApp Business Cloud API after credentials are configured.

## JSON catalog import

Use Products → Export for a full-format example, or `docs/catalog-import.example.json`. Import accepts an array of 1–500 records, maximum 2 MB. Import adds new records with fresh IDs; it does not overwrite products. Category IDs must already exist. All rows are validated before any are saved. Price may be null (request quote); stock is a nonnegative integer; status is draft, preview or published. Store data is at `data/store.sqlite` (ignored by Git).

## Production

```bash
npm run build
npm start
```

Run behind an HTTPS reverse proxy and set `SECURE_COOKIES=true` in `.env`. Use a persistent disk for `data/`; back up the SQLite database using SQLite's backup tooling or while the app is stopped. Do not deploy SQLite to an ephemeral serverless filesystem. Run one Node API instance per database. Configure process supervision, a real domain and HTTPS before public launch. `.env` must remain private. Remove ADMIN_PASSWORD from `.env` after provisioning; reset by setting it and rerunning `npm run admin:create`, which invalidates existing admin sessions.

## Validation

```bash
npm test
npm run format:check
npm run build
npm run test:browser
npm run test:homepage-browser
npm run test:payments-browser
npm run test:catalog-browser # with the real catalog and local server running
```

API integration tests use an isolated temporary database. Browser verification is provided in `tests/browser.mjs`; run `npx playwright install chromium`, then `node tests/browser.mjs` after a production build. It checks desktop/mobile rendering, cart, quote submission, chatbot and admin login visibility; screenshots are written to `/tmp/powerplanet-*.png`. It starts its own server on port 3006 with a temporary SQLite database; API port 4000 must be free. Test records are removed after testing.

The real-catalog browser test checks exact Astronergy pricing/photos/minimum quantity, filters, sorting, pagination, mega navigation, product details and mobile overflow. It writes preview screenshots to `docs/previews/` and does not submit quotations or change server records. Set TEST_BASE_URL to test another running URL.

## Checkout: COD and credit/debit cards

The basket links to `/checkout`. Cash on Delivery works without gateway credentials. Checkout collects customer details and a delivery address in Pakistan. Admin → Orders shows the products, address, total, payment method and payment status. Move COD orders through new → processing → shipped → delivered; mark delivered only after collecting cash. Cancelling a new/processing COD order restores reserved stock.

Only published products with a positive price and enough **confirmed stock quantity** can be purchased. Preview products, zero/unknown prices and unavailable/on-request products retain the quotation flow. The imported source catalog has zero confirmed warehouse stock by default: update stock and availability in Admin → Products before accepting orders. Totals are calculated from server catalog prices in PKR, using integer paisa; the client cannot set prices or mark orders paid. Delivery/installation charges are not collected online and must be agreed separately before dispatch, as disclosed at checkout. Orders above PKR 999,999.99 use the quotation flow.

### Configure Stripe

Stripe is the currently implemented card adapter. It requires an eligible Stripe merchant account; check [Stripe's supported merchant countries](https://stripe.com/global). Do not assume a Pakistan business can onboard directly. A Pakistan-local gateway such as Safepay or PayFast needs its own adapter and merchant credentials; those gateways are not implemented here.

Set these private server variables in `.env`, then restart the app:

```dotenv
PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

Use the actual local port in `PUBLIC_SITE_URL`. For production, use your HTTPS domain and matching live credentials. Card payments remain visibly unavailable until all three variables are configured. No publishable key is required for hosted checkout. Card numbers/CVC are entered on Stripe, never collected or stored by this app.

For local testing, forward Stripe events to the API:

```bash
stripe listen --forward-to localhost:4000/api/payments/stripe/webhook
```

Copy the listener's webhook signing secret into `.env` and restart. For production, register `https://YOUR-DOMAIN/api/payments/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed`. Follow [Stripe's webhook signature guide](https://docs.stripe.com/webhooks/signature). Test with Stripe test credentials and test cards before switching to live mode.

Payment confirmation comes only from a signature-verified webhook with a matching order/session, currency and total. The return page polls stored order status; a success URL alone never marks payment paid. The browser retains an order access key in session storage; public order responses exclude delivery/contact details. Repeated submission uses the same checkout key and Stripe idempotency key, preventing duplicate orders/charges. Pending card orders reserve stock; cancellation expires the session at Stripe before releasing inventory, and expiration/failure webhooks also release inventory once. Card returns offer Resume or Cancel payment.

A network timeout retains the order and reservation because Stripe may already have created a payable session. Retry using the same browser and details. If a buyer abandons checkout during a timeout before a session ID is saved, reconciliation may require an operator to find/expire that order's session in Stripe; do not blindly release its stock. Paid card cancellations/refunds must be handled in the provider dashboard and reconciled operationally; automated refunds are not implemented. Unpaid card orders cannot be fulfilled in admin.

`npm run test:payments-browser` (after `npm run build`) checks desktop/mobile checkout, COD confirmation, safe retries after a lost response, and admin delivery/payment status with an isolated database. Set `CHROMIUM_PATH` if Chrome is not at `/usr/bin/google-chrome`. Screenshots are written to `/tmp/powerplanet-checkout-*.png`.

`npm test` includes payment integration tests covering server totals, stock, duplicate submissions, order privacy, COD status transitions, gateway errors, signed/tampered webhooks, unpaid/expired payments and cancellation. These use an isolated database and a stub gateway; a real Stripe end-to-end charge still requires merchant test credentials.

## Branding, homepage and order notifications

The website uses the supplied logo's green/yellow palette. Admin → Store settings → Website logo accepts the original PNG/JPEG/WebP (up to 2 MB), preserves its bytes and stores it in SQLite. Header and footer use the uploaded logo. Alternatively put the original PNG at `public/images/powerplanet-logo.png`; the installed fallback is a scalable SVG recreation of the supplied Power Planet reference at `public/images/powerplanet-logo.svg`, with all lettering outlined as paths. It has no embedded bitmap or runtime font dependency. Uploaded artwork can override it. Square uploaded artwork is framed with CSS, without changing the uploaded file. The default SVG fits the header, footer and admin branding without cropping. The service strip follows Our Catalog; its marketing copy was supplied by the user, including the final 30,000+ products text (not a computed catalog count).

The hero has four slides for panels, inverters, batteries and portable power. Images/prices come from published catalog products; discounts only appear when a catalog original price exceeds its current price. The slides link to actual products, cycle every six seconds, support arrows/dots/swipe and pause on hover/focus or reduced-motion preferences. The first headline remains editable in Store settings. Featured Brand uses locally downloaded brand logos and links to matching catalog filters. Our Catalog links to store categories/subcategories. It uses the store's solar catalog; unrelated W11stop appliance/computing products have not been imported. Logo source URLs are recorded in `lib/featured-brands.json`.

At widths up to 760px, the homepage uses a separate mobile layout: a full-width three-slide banner, followed by Solar Panels, Hybrid Solar Inverters, and Lithium Batteries & ESS Energy collections. Each collection includes linked artwork, horizontally scrollable product cards and relevant brand links. Mobile search sits below the sticky logo header; the category menu opens from that header. Each hero slide has a visible Shop collection link to its category. Above 760px, the original desktop sidebar, four-slide product hero, category tiles, product grids, promotions, brands and category directory remain. Homepage product rows on both layouts scroll horizontally with swipe, arrow and keyboard controls, a visible product counter, and a preview of the next card on mobile. Rows advance one product every five seconds while visible, and pause on hover, focus, touch or manual navigation. A play/pause button controls playback; reduced-motion preferences disable automatic scrolling. Only the active homepage is mounted. Mobile artwork lives in `public/images/solar-home/`; its banners are independent of the desktop hero title setting.

### SMTP order confirmations

`nodemailer` is installed. Fill the placeholders in `.env` and restart `npm run dev` / `npm start`:

```dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=orders@your-domain.com
SMTP_PASS=your-provider-password
SMTP_FROM=orders@your-domain.com
ORDER_NOTIFICATION_EMAIL=your-shop-inbox@your-domain.com
```

Use port 465 with `SMTP_SECURE=true` for implicit TLS. Port 587 requires STARTTLS. `SMTP_FROM` is a verified email address, not a display-name string. `ORDER_NOTIFICATION_EMAIL` is optional and sends a separate store notification. Gmail requires an app password where supported by the account; use the provider's SMTP instructions. No real email is sent until credentials are configured. Customer confirmation requires an email address at checkout.

### WhatsApp order confirmations

WhatsApp uses Meta's Business Cloud API, not SMTP and not a personal WhatsApp login. Configure:

```dotenv
WHATSAPP_ACCESS_TOKEN=your-private-system-user-token
WHATSAPP_PHONE_NUMBER_ID=your-sender-phone-number-id
WHATSAPP_API_VERSION=v25.0
WHATSAPP_ORDER_TEMPLATE=powerplanet_order_confirmation
WHATSAPP_TEMPLATE_LANGUAGE=en
```

Use an API version supported by your Meta app. Create and obtain approval for a utility template in the configured language, with **four positional body parameters in this order**: customer name, order reference, formatted PKR total, payment method/status. Example body:

> Hello {{1}}, your Power Planet order {{2}} is confirmed. Product total: {{3}}. Payment: {{4}}. Our team will contact you to arrange delivery.

The customer opts in with the checkout checkbox. Pakistan mobile numbers beginning `03` are normalized to `923`; international numbers retain their country code. The business WhatsApp contact in Store settings is only the contact link; it does not authorize automated API sending. See [Meta's template message structure](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/) and [Nodemailer SMTP configuration](https://nodemailer.com/smtp).

### Delivery queue and operations

COD confirmations are queued atomically when the order is saved; card confirmations are queued only after verified payment. The API process drains the persistent SQLite queue every five seconds. Notification failure does not fail checkout. Missing configuration appears as `blocked`; failed provider calls retry up to five attempts with backoff. Admin → Orders shows channel/audience status and can retry unsent messages. `accepted` means accepted by SMTP/Meta, not proof of inbox delivery, WhatsApp delivery or reading. No delivery-status webhook is implemented.

Repeated checkouts/webhooks do not create duplicate notification jobs. SMTP uses a stable Message-ID. A timeout can have an ambiguous provider outcome, so delivery is not guaranteed exactly once; a server restart while sending marks the job `review` for manual provider reconciliation. Existing historical orders are not automatically emailed on startup. Cancelled orders skip queued confirmations. Do not configure real credentials for automated tests.

Validation: `npm test`, `npm run build`, `npm run test:payments-browser`, and `npm run test:homepage-browser`. Notification tests deliver an email to an isolated local SMTP test server and stub WhatsApp; they never send real customer messages. Homepage browser tests exercise slide navigation/autoplay/pause, brand pagination and links, catalog links, desktop/mobile overflow, and local brand-image loading.
