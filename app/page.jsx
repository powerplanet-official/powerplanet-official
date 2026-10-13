import StorePage from '../components/StorePage';
import { getStore } from '../lib/store-server.mjs';
import { metadataForRoute, resolveSeoRoute } from '../lib/seo.mjs';

export async function generateMetadata() {
  const data = await getStore();
  return metadataForRoute(resolveSeoRoute(data), data.settings);
}

export default async function Page() {
  const data = await getStore();
  return <StorePage data={data} route={resolveSeoRoute(data)} />;
}
