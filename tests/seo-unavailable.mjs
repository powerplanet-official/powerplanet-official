import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';

// A catalog outage must not masquerade as an empty, indexable 200 page or sitemap.
const api = createServer((request, response) => {
  response.writeHead(503, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Fixture unavailable' }));
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:3023';
const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3023'], {
  env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${api.address().port}` }, stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
web.stdout.on('data', (chunk) => logs += chunk);
web.stderr.on('data', (chunk) => logs += chunk);
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + '/robots.txt')).ok) break; } catch {}
    if (attempt === 59) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const results = [];
  for (const path of ['/shop', '/product/w11-35462', '/sitemap.xml']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 500, path);
    results.push({ path, status: response.status });
  }
  mkdirSync('docs/seo/verification', { recursive: true });
  writeFileSync('docs/seo/verification/outage.json', JSON.stringify(results, null, 2));
  console.log('PASS: backend outage returns server errors for public pages and sitemap, not empty 200 pages.');
} finally {
  web.kill('SIGTERM');
  await new Promise((resolve) => api.close(resolve));
}
