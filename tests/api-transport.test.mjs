import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { backendOrigin } from '../lib/backend-config.mjs';
import { apiHeaders, apiRateLimit } from '../server/http.mjs';
import { readApiResponse } from '../lib/api-response.mjs';

test('Vercel rejects missing, insecure, path-based and frontend-loop destinations', () => {
  for (const BACKEND_URL of [
    undefined,
    'http://api.example.com',
    'https://api.example.com/api',
    'https://api.example.com?x=1',
    'https://user:secret@api.example.com',
    'https://localhost',
    'https://shop.example.com',
    'invalid',
  ]) {
    assert.throws(() =>
      backendOrigin({
        VERCEL: '1',
        BACKEND_URL,
        VERCEL_PROJECT_PRODUCTION_URL: 'shop.example.com',
      }),
    );
  }
  assert.equal(
    backendOrigin({ VERCEL: '1', BACKEND_URL: ' https://api.example.com/ ' }),
    'https://api.example.com',
  );
  assert.equal(backendOrigin({ API_PORT: '4100' }), 'http://127.0.0.1:4100');
});

test('API rate limits retain JSON, Retry-After, request identity and no-store', async () => {
  const app = express();
  app.use(apiHeaders, apiRateLimit({ windowMs: 60000, limit: 1 }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (error) => {
      if (error) reject(error);
      else resolve(instance);
    });
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/health`;
    assert.equal((await fetch(url)).status, 200);
    const response = await fetch(url);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(Number(response.headers.get('retry-after')) > 0);
    const body = await readApiResponse(response);
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('HTML security challenges and malformed JSON are rejected safely', async () => {
  await assert.rejects(
    readApiResponse(
      new Response('<!DOCTYPE html><title>One moment, please...</title>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    ),
    /temporarily unavailable/,
  );
  await assert.rejects(
    readApiResponse(
      new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'application/json' } }),
    ),
    /invalid response/,
  );
});
