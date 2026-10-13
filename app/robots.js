import { absoluteUrl } from '../lib/site-config.mjs';

export default function robots() {
  // Keep noindex pages crawlable so robots can actually read their directives.
  return { rules: { userAgent: '*', allow: '/' }, sitemap: absoluteUrl('/sitemap.xml') };
}
