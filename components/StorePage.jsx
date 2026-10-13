import { headers } from 'next/headers';
import Storefront from './Storefront';
import { serializeJsonLd, structuredDataForRoute } from '../lib/seo.mjs';

// Reuse the interactive storefront while sending its real content in the HTML.
export default async function StorePage({ data, route }) {
  const requestHeaders = await headers();
  const mobile = /Mobile|Android|iPhone|iPod/i.test(requestHeaders.get('user-agent') || '');
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredDataForRoute(route, data)) }}
      />
      <Storefront initialData={data} initialMobileView={mobile} breadcrumbs={route.breadcrumbs} />
    </>
  );
}
