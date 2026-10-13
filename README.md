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

Both processes start with `npm run dev`. Next.js proxies `/api/*` to the Node API at `127.0.0.1:4000`. The API listens on `0.0.0.0` for hosting compatibility; restrict direct port access with the host firewall. API_PORT must match when building and running Next.js.

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

The homepage hero displays the same three solar campaigns on desktop and mobile, using landscape and portrait artwork respectively. The basket supports checkout with Cash on Delivery or configured Stripe card payments, alongside quotation requests. Orders and quotations appear in admin. Order confirmations support Nodemailer SMTP and the Meta WhatsApp Business Cloud API after credentials are configured.

## Catalog browsing and mobile navigation

Product listings now open with a responsive brand-logo grid followed by illustrated solar categories, then the existing filters and product grid. Brand choices remain in the URL and carry through category navigation; only categories containing products for the selected brands are offered. Search results stay focused on results rather than repeating the discovery sections. No product records or category taxonomy are changed.

On mobile, the category menu uses one expandable group at a time, larger touch targets, a searchable brand directory and a single scrolling drawer. Existing desktop mega-navigation is retained. This structure was checked against W11stop's solar/inverter listing and the supplied screenshots, while retaining Powerplanet styling and branding.

Run `node --test tests/catalog-navigation.test.mjs` for discovery/link tests and `node tests/catalog-navigation-browser.mjs` after `npm run build` for fixture-based desktop/mobile checks. Browser previews are saved under `/tmp/powerplanet-catalog-*.png` and `/tmp/powerplanet-category-menu-mobile.png`; the test does not contact the live backend.

## JSON catalog import

Product forms support uploading a JPG, PNG or WebP from the administrator's computer (maximum 4 MB), with a preview before saving. Authenticated uploads are decoded, resized and stored as WebP in the backend SQLite database, so database backups include the photos. The frontend serves them through `/api/product-images/*`; no writable Vercel filesystem is required. Deploy both frontend and backend and run `npm ci --omit=dev` on the backend to install the production image-processing dependency. Existing product images remain until replaced. Uploaded files are retained even if the form is cancelled, so existing image URLs are never deleted implicitly.

Use Products → Export for a full-format example, or `docs/catalog-import.example.json`. Import accepts an array of 1–500 records, maximum 2 MB. Import adds new records with fresh IDs; it does not overwrite products. Category IDs must already exist. All rows are validated before any are saved. Price may be null (request quote); stock is a nonnegative integer; status is draft, preview or published. Store data is at `data/store.sqlite` (ignored by Git).

## Production

```bash
npm run build
npm start
```

Run behind an HTTPS reverse proxy and set `SECURE_COOKIES=true` in `.env`. Use a persistent disk for `data/`; back up the SQLite database using SQLite's backup tooling or while the app is stopped. Do not deploy SQLite to an ephemeral serverless filesystem. Run one Node API instance per database. Configure process supervision, a real domain and HTTPS before public launch. `.env` must remain private. Remove ADMIN_PASSWORD from `.env` after provisioning; reset by setting it and rerunning `npm run admin:create`, which invalidates existing admin sessions.

### Split Vercel/API deployment

When the Next.js frontend is deployed on Vercel and this API is hosted elsewhere, set Vercel's production `BACKEND_URL=https://api.powerplanet.pk` (do not append `/api`). Redeploy after changing it: the rewrite destination is included in the build. Builds on Vercel reject missing, insecure, path-based and known frontend-loop destinations. The reserved `/api/*` rewrite runs before page routing.

On TezHost, use `server/index.mjs` as the Node entry point (`npm run start:api` for a process supervisor), with the application root set to this repository. It loads `.env` before initializing SQLite and workers. Do not run the combined `npm start` frontend/API launcher on the backend-only host. Use Node 22.13+ and an absolute persistent `DB_PATH`. Match `API_PORT` to the host's actual port assignment; if the platform supplies `PORT`, remove any conflicting `API_PORT` override.

The API hostname must accept server-to-server requests without JavaScript challenges or clearance cookies. The confirmed production blocker on 11 October 2026 was Imunify360 bot protection. See [the investigation, hosting fix and acceptance checks](docs/api-reliability.md). Code changes alone cannot remove a challenge that runs before Node.

API responses now include request IDs and default to `Cache-Control: no-store`; logo responses retain their existing revalidation policy. Rate-limit responses use JSON with HTTP 429 and Retry-After. Only set `TRUSTED_PROXY_ADDRESSES` after the host confirms the proxy IPs/CIDRs and forwarded-IP sanitization. Without the correct proxy configuration, Express can group visitors behind the proxy into one rate-limit bucket; blindly trusting all forwarded addresses allows spoofing.

To inspect DNS and repeated cookie-free requests through both layers:

```bash
npm run diagnose:api -- https://powerplanet.pk https://api.powerplanet.pk 10
```

The command reports status, content type, response shape, redirect location and DNS records, and exits nonzero if any request fails. It does not retry failed requests or print catalog/customer contents.

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

COD checkout accepts listed products even when price or stock is unconfirmed. The order and customer contact details are saved in Admin → Orders, and the customer sees “Your order has been placed successfully”; the team confirms price, availability and delivery directly. Unknown prices remain null and display “To be confirmed”, never a free/zero total. Only confirmed stock is reserved; cancellation restores only those reserved units. Unconfigured card payment is hidden. Card checkout still requires published products, a positive confirmed price, enough stock and a total within the provider limit; larger or unconfirmed orders can use COD. Totals come from the server in integer paisa, and payment is never marked received merely because an order was placed.

Minimum quantities now start at **1**. On first backend startup after this update, an idempotent migration resets existing product minimums to 1 and records the previous values in the database's meta table under `minimum-order-quantity-one-v1`. Later changes in Admin → Products → Minimum order quantity survive restarts. New imported catalog products default to 1 and reimports preserve the store's chosen minimum. Existing orders and the original source snapshot are unchanged. Customers can reduce old basket quantities to 1 using the minus button.

Deploy both frontend and backend for these checkout changes. Restart the backend to run the minimum-quantity migration; updating only Vercel leaves the old API validation in place.

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

The website uses the supplied logo's green/yellow palette. The default artwork is the client's original `public/images/powerplanet-logo-original.jpeg`, copied byte-for-byte from the supplied file (SHA-256: `6eeea2238c2ae95429ab04963ca9cfe8a35f22a70a83a9f43bb74bcd0429d602`). Header, footer and admin share the branding endpoint; no lettering, color, thickness or artwork is regenerated. Square artwork is framed with CSS to hide the surrounding white space without changing the file. Admin → Store settings → Website logo still accepts PNG/JPEG/WebP uploads and preserves their bytes in SQLite. An existing uploaded logo takes precedence; to replace an older upload on a deployed backend, upload this original file through Store settings. The frontend also uses the original as its fallback if the branding endpoint cannot load.

Desktop and mobile now share three solar hero campaigns, advancing every **4 seconds** (previously 6). Desktop uses the existing **1400 × 520** landscape sources; mobile retains the portrait versions. These are source-resolution assets, not claimed to be native 4K. The banners link to the three existing solar collections. Arrows, dots, swipe, pause, hover, keyboard focus and reduced-motion support remain. Since the hero wording is embedded in the supplied artwork, the legacy Store settings hero title does not control these banners.

At widths up to 760px, the homepage keeps its three mobile solar collections, compact sticky header and separate search bar. Above 760px, the sidebar, category tiles, product rows, promotions and category directory remain. Homepage product rows advance every **3.5 seconds** (previously 5); brand rows advance every **5 seconds** (previously 7). Product rows keep native swipe and keyboard scrolling, pause during interaction, and stop when offscreen or reduced motion is enabled. Touch taps do not permanently pause autoplay. No new categories or theme changes are introduced.

Search now shares one ranking implementation between desktop/mobile suggestions and submitted results. It handles reordered keywords, model numbers, unit spacing (6 kW / 6KW), plural forms, common bifacial spellings, and conservative typo fallback. Capacity numbers are not fuzzy-matched. Keyboard arrows select suggestions, Enter opens the selection or all results, and Escape dismisses the dropdown. Draft products never appear.

The existing catalog filter styling is retained. W11stop's solar listing reference (`https://w11stop.com/a-grade-solar-panel-price-in-pakistan`) informed the added subcategory multi-select, stock choices, visible price inputs and model sorting. Selections intersect across filter groups and combine within a group. Counts reflect the other active filters. Removable chips, query retention, URL sharing, pagination reset and back/forward navigation are supported; legacy `available=1` links remain valid. Imported product data, pricing and warehouse stock are unchanged.

Validation: `npm test`, `npm run format:check`, `npm run build`, and `npm run test:homepage-browser`. The homepage browser check uses an isolated catalog database and writes screenshots to `/tmp/`.

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

## SEO and indexing

Public pages now render the catalog on the server with route-specific metadata, canonicals, factual JSON-LD, robots and a database-backed sitemap. Deploy both the API and frontend; the server uses `/api/store?view=storefront` and a short revalidation cache. Prices and source inventory are not treated as verified Google Offers.

See [the SEO acceptance report](docs/seo/README.md) for audit evidence, route mapping, tests, hosting/Search Console actions and the 30/60/90-day monitoring plan. Run `npm run test:seo` after a production build. To regenerate the captured route map, run `npm run seo:inventory -- docs/seo/baseline/live-catalog.json.gz`.
