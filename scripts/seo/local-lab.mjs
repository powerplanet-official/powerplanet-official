import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { publicStorefrontData } from '../../lib/public-store.mjs';

const snapshot = JSON.parse(readFileSync('data/catalog-source/solar-catalog.json', 'utf8'));
const catalog = publicStorefrontData({
  ...snapshot,
  settings: {
    name: 'Powerplanet',
    phone: '+92 301 4101700',
    whatsapp: '923014101700',
    facebook: 'https://www.facebook.com/Powerplanet.1/',
  },
});
const api = createServer((request, response) => {
  if (request.url.startsWith('/api/branding/logo')) {
    response.writeHead(200, { 'Content-Type': 'image/jpeg' });
    response.end(readFileSync('public/images/powerplanet-logo-original.jpeg'));
  } else {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(catalog));
  }
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const apiOrigin = `http://127.0.0.1:${api.address().port}`;
const base = 'http://127.0.0.1:3022';
const web = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3022'],
  { env: { ...process.env, BACKEND_URL: apiOrigin }, stdio: ['ignore', 'pipe', 'pipe'] },
);
let logs = '';
web.stdout.on('data', (chunk) => (logs += chunk));
web.stderr.on('data', (chunk) => (logs += chunk));
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base + '/robots.txt')).ok) break;
    } catch {}
    if (attempt === 59) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  mkdirSync('docs/seo/verification', { recursive: true });
  const audit = spawn(
    process.execPath,
    ['scripts/seo/browser-audit.mjs', base, 'docs/seo/verification/browser-lab.json'],
    { env: { ...process.env, BROWSER_API_ORIGIN: apiOrigin }, stdio: 'inherit' },
  );
  const code = await new Promise((resolve) => audit.once('exit', resolve));
  if (code) throw new Error(`Browser audit exited ${code}.`);
} finally {
  web.kill('SIGTERM');
  await new Promise((resolve) => api.close(resolve));
}
