import { notFound } from 'next/navigation';
import StorePage from '../../components/StorePage';
import { getStore } from '../../lib/store-server.mjs';
import { metadataForRoute, resolveSeoRoute } from '../../lib/seo.mjs';

async function resolvePage({ params, searchParams }) {
  const [{ slug }, query, data] = await Promise.all([params, searchParams, getStore()]);
  const route = resolveSeoRoute(data, `/${slug.map(encodeURIComponent).join('/')}`, query);
  if (!route) notFound();
  return { data, route };
}

export async function generateMetadata(props) {
  const { data, route } = await resolvePage(props);
  return metadataForRoute(route, data.settings);
}

export default async function Page(props) {
  const { data, route } = await resolvePage(props);
  return <StorePage data={data} route={route} />;
}
