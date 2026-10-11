import { resolve4, resolve6, resolveCname } from 'node:dns/promises';

const [frontend, backend, countValue = '5'] = process.argv.slice(2);
const count = Number(countValue);
if (!frontend || !backend || !Number.isInteger(count) || count < 1 || count > 30) {
  console.error(
    'Usage: npm run diagnose:api -- https://powerplanet.pk https://api.powerplanet.pk [1-30 samples]',
  );
  process.exit(1);
}

// No cookies, redirects or retries: expose first-request failures instead of
// accidentally hiding challenges behind a warm browser session.
for (const origin of [frontend, backend]) {
  const url = new URL(origin);
  const results = await Promise.allSettled([
    resolve4(url.hostname),
    resolve6(url.hostname),
    resolveCname(url.hostname),
  ]);
  console.log(
    JSON.stringify({
      hostname: url.hostname,
      dns: Object.fromEntries(
        results.map((result, index) => [
          ['A', 'AAAA', 'CNAME'][index],
          result.status === 'fulfilled' ? result.value : result.reason.code,
        ]),
      ),
    }),
  );
}

let failures = 0;
for (let sample = 1; sample <= count; sample++) {
  for (const origin of [backend, frontend]) {
    for (const path of ['/api/health', '/api/store']) {
      const url = new URL(path, origin);
      const started = Date.now();
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
          cache: 'no-store',
          redirect: 'manual',
          signal: AbortSignal.timeout(20000),
        });
        const body = await response.text();
        const contentType = response.headers.get('content-type') || '';
        let data;
        try {
          data = JSON.parse(body);
        } catch {}
        const valid =
          response.status === 200 &&
          contentType.includes('application/json') &&
          (path === '/api/health'
            ? data?.ok === true
            : Array.isArray(data?.products) && Array.isArray(data?.categories) && !!data?.settings);
        if (!valid) failures++;
        console.log(
          JSON.stringify({
            time: new Date().toISOString(),
            sample,
            url: url.href,
            valid,
            status: response.status,
            contentType,
            elapsedMs: Date.now() - started,
            server: response.headers.get('server'),
            location: response.headers.get('location'),
            cache: response.headers.get('x-vercel-cache'),
            api: response.headers.get('x-powerplanet-api'),
            requestId: response.headers.get('x-request-id'),
            title: body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0, 200),
          }),
        );
      } catch (error) {
        failures++;
        console.log(
          JSON.stringify({
            sample,
            url: url.href,
            valid: false,
            elapsedMs: Date.now() - started,
            error: error.cause?.code || error.name,
          }),
        );
      }
    }
  }
}
console.log(JSON.stringify({ requests: count * 4, failures }));
process.exitCode = failures ? 1 : 0;
