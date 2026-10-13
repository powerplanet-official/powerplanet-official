import { getStore } from '../lib/store-server.mjs';
import { sitemapPaths } from '../lib/seo.mjs';
import { absoluteUrl } from '../lib/site-config.mjs';

export default async function sitemap() {
  // Import timestamps do not describe edits to these pages; omit lastModified.
  return sitemapPaths(await getStore()).map((path) => ({ url: absoluteUrl(path) }));
}
