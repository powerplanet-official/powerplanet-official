# Powerplanet SEO baseline — 13 October 2026

Captured before the SEO implementation. Earlier address, WhatsApp, mobile border and favicon changes are preserved.

## Stack and deployment

- Installed Next.js **16.3.6**, React 19, App Router. Package range is `^16.2.1`; use the lockfile and installed docs.
- One client storefront inside the home and catch-all pages. `/admin` is separate.
- Express API and SQLite on the backend; Next rewrites `/api/*` to `BACKEND_URL`.
- Live response header identifies Vercel. Repository instructions identify a separate TezHost API. No hosting account configuration or DNS credentials are available here.
- Production API: 1,099 public products, 47 categories. Local SQLite also has 12 draft sample products. Prices/availability originate in an imported W11stop snapshot, not confirmed Powerplanet warehouse inventory.
- Business name and phone are published in store settings. Lahore address was supplied directly by the owner in this conversation. No confirmed nationwide delivery coverage, opening hours, registration name, warranty terms or authorized-dealer status.

## Recorded failures

| Priority | Affected URLs | Evidence / cause | Safe implementation |
| --- | --- | --- | --- |
| P0 | All public pages | Initial local HTML has 0 H1, 0 product links and only “Loading Powerplanet…”; live home is a 6.4 KB loading shell | Server fetch the same public catalog and render the existing interactive components |
| P0 | `/robots.txt`, `/sitemap.xml`, unknown paths | Live `200 text/html`; catch-all treats files and missing pages as storefront routes | Real metadata routes, server route validation and 404 |
| P1 | Categories, products, brand/filter pages | Shared title/description; no canonical or social metadata | One data-driven route policy for metadata, schema and sitemap |
| P1 | Pagination | Buttons only, products after first page lack pagination anchors | Preserve controls and styles but use real page links |
| P1 | `https://www.powerplanet.pk/` | TLS hostname mismatch prevents a redirect being reached | Add application 308 redirect; owner must attach www domain and issue valid certificate in Vercel |
| P1 | Imported catalog | Titles/specifications can conflict: Astronergy name 585W vs spec 580W; Canadian name 570W vs spec 655W | Flag exact products for owner review; no inferred corrections or Offer markup |
| P1 | Home promises | “30,000+ PRODUCTS”, “100% GENUINE”, “GRADE A… wholesale prices” not substantiated by this dataset | Record owner-verification blockers; do not extend these claims into SEO text or schema |
| P2 | Product images | Product cards/detail images omit intrinsic dimensions; hero first image is already high priority | Reserve dimensions and keep responsive CSS; avoid duplicate client catalog fetch |
| P2 | Structured data | No Organization, WebSite, BreadcrumbList or Product JSON-LD | Safely serialize factual values from the same data used in the page |

HTTP origin already reaches HTTPS on Vercel. Exact first-hop redirect codes are separately recorded where tested. The www TLS error must be resolved at hosting before the application redirect can execute.

## Scope decisions

Keep existing URLs and UI. Existing product identifiers (`/product/w11-…`) remain stable. Brand pages already exist as `/shop?brand=…`; no invented brand slugs, articles, city pages or hreflang translations. Single-brand listings can be indexed; search, combined facets, sort/display variants, private pages and empty categories receive noindex. Paginated unfiltered and single-brand results retain their own canonical URLs. Tracking parameters canonicalize to the clean page.

No lastmod from source import dates; no invented Offers, reviews, ratings, availability, service territory or warranties. A valid basic Product entity is not a promise of Google product rich-result eligibility.

Raw small HTML captures and response summaries are under `baseline/`. Public catalog data are summarized to avoid duplicating the full imported catalog in documentation.
