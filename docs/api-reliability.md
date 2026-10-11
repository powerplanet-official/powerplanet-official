# Production API investigation — 11 October 2026

## Confirmed root cause

Imunify360 bot protection in front of the TezHost Node application blocks legitimate API traffic. The Vercel rewrite propagates the origin's challenge/block response to the browser. A browser JavaScript challenge cannot be completed by Vercel's server-to-server proxy or by parsing a fetch response as JSON.

User-provided evidence: 10/10 direct `/api/health` requests returned HTTP 200, `text/html; charset=utf-8`, a DOCTYPE and title `One moment, please...`.

Independent probes at approximately 15:28 Pakistan time (10:28 UTC):

| Request | Observed response |
| --- | --- |
| Direct backend `/api/health` and `/api/store` | HTTP 403, application/json, Server: Apache, explicit Imunify360 denial |
| Frontend `/api/health` | An initial HTTP 200 with `{"ok":true}` and `X-Powered-By: Phusion Passenger(R) 6.1.8`; subsequently HTTP 403 |
| Frontend `/api/store` | HTTP 403 with the same Imunify360 denial, Server: Vercel |
| Three subsequent samples of all four URLs | 12/12 HTTP 403 with the same denial; Vercel responses were cache MISS |

Exact error payload from these probes:

```json
{"message":"Access denied by Imunify360 bot-protection. IPs used for automation should be whitelisted"}
```

A further 12-request run of the committed diagnostic script at 15:29 Pakistan time had 10 failures and two successful Vercel `/api/store` responses. Both successes had valid catalog JSON. This independently reproduces intermittent availability; it does not establish which IP/rule caused each decision. The metadata-only capture is [api-diagnosis-2026-10-11.jsonl](api-diagnosis-2026-10-11.jsonl).

This confirms a hosting security block independently of the supplied HTML report. These probes did not reproduce the HTML form of the challenge; they reproduced its explicit JSON denial. Accept headers/client classification can affect the response format. The exact security rule and reason for variation require TezHost's event logs.

DNS resolution from the probe location:

- `powerplanet.pk`: `216.198.79.1`
- `api.powerplanet.pk`: `5.9.109.105`

The hosts resolved separately and HTTPS requests completed. There is no observed DNS failure explaining these blocks. This is not a global DNS propagation audit. The returned successful health JSON and subsequent upstream denial show that the deployed frontend API route reaches a backend/security layer; they do not reveal the exact saved Vercel environment value.

## Code findings and changes

- The Express health route explicitly returns JSON; the code has no security-challenge HTML template. `/api/store` reads local SQLite. A health request does not query the catalog, so its security denial is not caused by a catalog SQL error.
- The existing frontend parser already rejects HTML safely. The screenshot matches that parser's friendly message after a successful HTTP status with non-JSON content. Changing the error text or adding reload/retry loops would leave the blocker in place.
- Previously, missing `BACKEND_URL` on Vercel silently rewrote to localhost. Added build validation for this and malformed/known frontend-loop destinations. A trailing origin slash is normalized. API rewrites now run before page routing.
- Express rate limiters previously returned non-JSON errors. All limiters now return JSON with HTTP 429 and Retry-After. This is a separate contract bug, not the source of the observed `200` challenge page.
- Added request IDs, an origin marker and no-store defaults for API responses so application responses and failures are easier to correlate. These headers will not appear on a security challenge that never reaches Node.
- Direct `server/index.mjs` startup previously skipped `.env` loading. It now loads configuration before SQLite/worker imports. Added an API-only start command. Hosting-supplied environment variables retain precedence.
- Added explicit trusted proxy address configuration. The production proxy chain has not been verified, so no broad trust rule has been enabled.
- Added automated transport/config regression tests and a read-only DNS/API diagnostic command.

## Required TezHost change

Ask the server administrator to exempt the exact API hostname `api.powerplanet.pk` from Imunify360's browser CAPTCHA/JavaScript challenge. CloudLinux documents this domain-scoped command:

```bash
imunify360-agent whitelist domain add api.powerplanet.pk
```

Source: [CloudLinux: disable WebShield challenge for a domain](https://cloudlinux.zendesk.com/hc/en-us/articles/360017069879-How-to-disable-WebShield-for-a-domain).

The administrator must verify the installed version, resulting policy and security event logs. Keep application authentication, request validation, rate limits and appropriate non-interactive security protections. Do not disable all security for the server. Do not whitelist only a developer's current IP and assume Vercel is fixed.

If Under Attack Mode is available and enabled, check any rule covering this API domain separately: it is distinct from IP-based GreyList/Anti-bot Challenge. API traffic must not require a browser clearance cookie. Source: [Imunify360 Under Attack Mode](https://docs.imunify360.com/features/under_attack_mode/).

TezHost should also confirm:

1. `api.powerplanet.pk` is attached to the Node application, with `/api/*` passed through unchanged and no login/HTML fallback redirects.
2. Node 22.13+ is selected, SQLite is on persistent writable storage, and Passenger uses the correct application root/entry point/port.
3. Passenger startup/crash/resource logs show no additional fault after the challenge exemption. Passenger was observed in a successful response; cold-start failure is not established by the current evidence.
4. The exact reverse-proxy IP chain and sanitized forwarded-client-IP header, before configuring `TRUSTED_PROXY_ADDRESSES`.

If shared hosting cannot support an API without browser challenges, the backend needs an API-compatible hosting policy or environment. Repeated retries cannot make an incompatible security policy reliable.

## Vercel settings to verify

No authenticated Vercel settings access was available during this investigation; the actual environment value has not been inspected.

- Production `BACKEND_URL=https://api.powerplanet.pk`, without `/api` or the frontend domain.
- Confirm branch/environment overrides and configure Preview separately if needed.
- Redeploy the frontend after any environment change; external rewrite destinations are part of the build.
- Keep browser requests same-origin (`/api/...`); CORS changes are not needed for this architecture. Vercel supports external rewrites as reverse proxies: [official documentation](https://vercel.com/docs/routing/rewrites).

## Deployment and acceptance

Local verification completed: 47 automated tests passed; production build and formatting checks passed. A focused Chromium check using a temporary SQLite database passed ten desktop/mobile page loads with first-response JSON, no error screens/JavaScript errors, correct proxy response headers and successful admin login/session cookies.

The pre-existing full browser suite did not complete: after isolating its occupied API port and using installed Chromium, it timed out on the carousel heading `The heart of your solar system.`, which no longer exists in the current UI. That unrelated assertion was not changed. Focused API/browser checks were run separately; this is not a claim that the entire browser suite passes.

Deploy the reviewed backend and frontend changes through the existing deployment process, apply the hosting exception, and then run:

```bash
npm test
npm run format:check
npm run build
npm run diagnose:api -- https://powerplanet.pk https://api.powerplanet.pk 10
```

The final command performs 40 requests, without cookies, redirects or retries. Every health response must be HTTP 200 JSON with `ok:true`; every store response must contain products, categories and settings. Require zero failures. Repeat after an idle period and from another network; inspect both direct origin and Vercel paths. Fresh browser sessions must load desktop/mobile storefronts on the first attempt. Verify admin login/logout and a test checkout in the appropriate test environment after deployment.

Local tests cannot prove live availability until the hosting configuration is changed. This report does not claim the production incident is resolved or that any settings were changed on TezHost/Vercel.

## Ready-to-send support request

Our Next.js frontend on Vercel proxies `/api/*` to `https://api.powerplanet.pk/api/*`. Legitimate API requests are being intercepted by Imunify360 before Node. The browser has received HTTP 200 HTML titled `One moment, please...`. Independent probes on 11 October 2026 around 10:28 UTC returned HTTP 403 with `Access denied by Imunify360 bot-protection. IPs used for automation should be whitelisted`, both directly and through Vercel. Please apply a persistent, domain-scoped CAPTCHA/JavaScript challenge exemption for `api.powerplanet.pk`, check any separate Under Attack Mode rule, and retain appropriate non-interactive protections. Please confirm the effective policy and test `/api/health` and `/api/store` without cookies from external clients and through Vercel. Also confirm the trusted reverse-proxy chain for Express IP-based rate limiting. Expected result is first-request JSON every time, with no challenge, redirect or clearance-cookie dependency.
