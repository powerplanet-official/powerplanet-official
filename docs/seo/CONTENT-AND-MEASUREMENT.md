# Content, search intent and measurement

## Research boundaries

Research date: 13 October 2026. Keyword candidates come from the actual 1,099-product catalog, its category names/brand/model fields, the owner's Lahore address, qualitative public search results and manufacturer documentation. No Keyword Planner/Search Console account is connected; no search volumes, difficulty numbers or sales forecasts are asserted. Pakistan in titles describes catalog context; it does not promise delivery to every city.

The exhaustive mapping is `route-metadata.csv`. Only existing routes are mapped. Query-based brand pages remain query-based. No new articles, neighborhood landing pages, translations or location doorway pages were published.

| Existing target | Primary intent | Related questions / terms | Evidence needed before expansion |
| --- | --- | --- | --- |
| `/` | Powerplanet solar products Pakistan | panels, inverters, batteries, Lahore quotation | Confirm service and delivery area |
| `/category/solar-panels` | solar panels Pakistan | panel wattage, bifacial, model comparison | Resolve name/wattage inconsistencies first |
| `/category/solar-inverters` | solar inverters Pakistan | hybrid, on-grid, off-grid, model specifications | Verify current product models and power ratings |
| `/category/hybrid-inverters` | hybrid solar inverters Pakistan | inverter capacity, battery compatibility, MPPT inputs | Manufacturer model datasheets and compatibility lists |
| `/category/solar-batteries` | solar batteries Pakistan | lithium, voltage, capacity, compatible inverter | Model-specific usable capacity and manufacturer documents |
| `/category/portable-systems` | portable power systems Pakistan | portable solar, backup power, product comparison | Rated output, usable energy and charging inputs |
| `/shop?brand=Solis` and other real brands | brand product range | exact brand + model + specifications | No implied authorized dealer status |
| `/product/{existing-id}` | exact product model / quotation | model number, listed specifications | Merchant-confirmed price/stock/warranty before commercial promises |
| `/contact` | Powerplanet Lahore address/contact | Bhatta Chowk, New Airport Road, WhatsApp | Owner supplied location; verify map pin and business eligibility |
| `/quote` | solar product quotation | quantity, model, requirements | Confirm fulfillment area and lead response process |

Manufacturer guidance supports the proposed compatibility questions. Solis explicitly maintains a model-specific [battery compatibility list](https://solis-service.solisinverters.com/en/support/solutions/articles/44002547213-solis-battery-compatibility-list); do not infer that every lithium battery works with every inverter. LONGi's [Hi-MO product brochure](https://static.longi.com/Hi_MO_5_Product_brochure_EN_2022_05_46df564984.pdf) is an example of an original model reference, not a warranty promise from this store.

## Safe category introduction drafts

These are review-ready copy suggestions, not newly published pages:

- **Solar panels:** “Browse the solar panel models listed in our catalog. Compare the model, power rating, cell type and dimensions, then request confirmation of the current specification and quotation from Powerplanet.” Resolve conflicting source ratings before replacing terse product descriptions.
- **Solar inverters:** “Explore hybrid, on-grid and off-grid inverter categories. Review the listed model and specifications, and share your panel, battery and backup requirements with our team before choosing equipment.”
- **Solar batteries:** “Browse the listed solar battery models and compare their voltage and capacity details. Ask our team to confirm the exact model and inverter compatibility before ordering.”
- **Portable power systems:** “Explore the portable power products in the catalog. Compare the model specifications and tell us which devices you want to power so the required output and backup duration can be checked.”

Do not publish fabricated warranties, “best/cheapest” claims, installation coverage, stock or savings percentages. `catalog-review.json` identifies terse descriptions, repeated source descriptions and possible power conflicts for owner review. Meta descriptions now use product identity and the real quotation workflow; they avoid amplifying conflicting source wattage fields.

## Content backlog: one useful guide at a time

1. **How to compare a hybrid inverter and battery:** checklist for exact model, nominal battery voltage, approved battery list, required backup loads and manufacturer limits. Link to relevant existing categories and models. Technical review required.
2. **Understanding a panel specification sheet:** distinguish model number, rated power, dimensions and cell technology using owner-confirmed datasheets. Use the mismatched catalog records as an internal correction queue, not published misinformation.
3. **What to include in a solar product quotation request:** quantities, exact model, location and backup needs. Explain what Powerplanet confirms before dispatch; first obtain actual fulfillment terms.
4. **Model comparison pages:** only compare two actual stocked/listed models after their technical specifications are checked. Use factual tables; no invented reviews, performance results or compatibility assertions.
5. **FAQ candidates:** current price confirmation, minimum quantity, how to share equipment details, and how to contact the shop. Owner must provide delivery, returns, opening hours and warranty answers. No FAQ rich-result markup is added.

## Google integrations and remaining account work

### Search Console

1. Sign into the owner's Google Search Console account. Add the Domain property `powerplanet.pk` and publish the exact TXT record Google supplies at the authoritative DNS provider. Do not use an invented token. Wait for DNS propagation and click Verify.
2. Alternatively add URL-prefix property `https://powerplanet.pk/`; set the exact supplied HTML token as `GOOGLE_SITE_VERIFICATION` in the frontend production environment, redeploy, check the initial HTML and Verify. The code omits the tag when no token is provided.
3. After deployment and public checks, submit `https://powerplanet.pk/sitemap.xml` in Sitemaps. Submission has **not** been performed in this task.
4. Inspect `/`, a populated category, a page-2 URL, one brand page and one product. Run “Test live URL”, verify rendered content, indexing permission and selected canonical; request indexing for representative pages.
5. Inspect an empty category and a checkout/search URL to confirm noindex. Inspect a removed/nonexistent product to confirm 404. Track unexpected “Crawled/Discovered – currently not indexed”, soft 404s, duplicate canonicals and server errors.

### Structured data validation

The code is locally checked for JSON parsing, safe serialization, visible-field agreement and breadcrumb consistency. Run deployed representative URLs through [Google Rich Results Test](https://search.google.com/test/rich-results) and [Schema.org Validator](https://validator.schema.org/). No successful remote validation is claimed.

Product entities intentionally omit Offers, reviews and ratings. Google's [product snippet requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) require an offer, review or aggregate rating for that enhancement; basic Product markup alone does not qualify. Do not fix the eligibility warning by inventing data. Obtain verified merchant data first.

### GA4 measurement specification

No GA4 account, measurement ID, consent policy or consent manager was supplied. No analytics script or cookies were added. Prepare the following only after the owner approves the site's applicable privacy/consent behavior:

| Event | Real trigger | Non-PII parameters |
| --- | --- | --- |
| `view_item_list` | Catalog actually displayed | list/category ID, product IDs |
| `select_item` | Product link selected | product ID, list ID |
| `view_item` | Product detail displayed | product ID, brand/category |
| `add_to_cart` | Basket successfully updated | item ID, quantity; PKR value only if valid |
| `begin_checkout` | Checkout form ready with restored basket | item IDs, quantities |
| `generate_lead` | Quote API confirms success | anonymous quote reference; never name/phone/address/message |
| `purchase` | Confirmed paid transaction, once | order reference, currency PKR, verified total/items |
| `order_placed` | COD order accepted, if desired | anonymous order reference; keep separate from paid revenue |
| `contact_whatsapp` | Header WhatsApp click | placement only |

Validate in GA4 DebugView, prevent duplicate purchase events after reload and respect consent before loading analytics. Do not send customer names, emails, phones, addresses, payment tokens or order recovery keys.

### Merchant Center and Business Profile

Merchant Center is not ready to submit based on a third-party stock/price snapshot. Confirm actual purchasability, positive prices, stock, currencies, return/refund policy, delivery terms, checkout reliability and required merchant identity. The application supports COD and optional Stripe, but that does not confirm the merchant account, delivery coverage or source inventory. No feed/account submission was made.

An eligible Google Business Profile may be appropriate for the owner's real Lahore location. The owner must confirm customer-facing eligibility, map pin, signage, hours and business verification. Do not create virtual offices, duplicate listings or guessed hours.

## 30 / 60 / 90 day monitoring

| Window | Actions | Evidence / decision |
| --- | --- | --- |
| First 7 days | Deploy frontend and API, validate www TLS, submit sitemap, inspect examples, watch 5xx/404 and backend request rates | Initial HTML, sitemap success, canonicals, noindex/private controls, baseline conversion checks |
| Day 30 | Compare Search Console indexed URLs to eligible sitemap entries; review actual queries per template and field CWV mobile/desktop | Track impressions/clicks/CTR and useful leads; prioritize soft 404s, errors and content conflicts before expanding pages |
| Day 60 | Correct owner-verified descriptions and duplicate records; publish one reviewed guide; evaluate internal links and GA4 lead events if enabled | Query-to-page alignment, lead quality, conversion funnel, error and CWV trends; no ranking guarantees |
| Day 90 | Recheck catalog image/link health, sitemap exclusions, duplicate parameter crawling and new product eligibility | Compare consistent 28-day periods; account for inventory/seasonality; update content based on real queries and customer questions |

Field Core Web Vitals should be assessed from CrUX/Search Console over its reporting window. Local and live lab samples here use different infrastructure and are not a controlled before/after performance claim.
