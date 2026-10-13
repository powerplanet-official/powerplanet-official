import { cache } from 'react';
import { connection } from 'next/server';
import { backendOrigin } from './backend-config.mjs';
import { publicStorefrontData } from './public-store.mjs';

// Metadata, HTML and sitemap share one public catalog. Short caching avoids
// sending every crawler/prefetch request through the backend's shared IP limit.
export const getStore = cache(async () => {
  // Defer the API call until a request without disabling the fetch data cache.
  await connection();
  const response = await fetch(`${backendOrigin()}/api/store?view=storefront`, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Public catalog unavailable (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.products) || !Array.isArray(data.categories) || !data.settings) {
    throw new Error('Public catalog returned an invalid response.');
  }
  return publicStorefrontData(data);
});
