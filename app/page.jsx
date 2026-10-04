import { Suspense } from 'react';
import Storefront from '../components/Storefront';
// The storefront reads search parameters, so provide a Suspense boundary for prerendering.
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Loading Powerplanet…</div>}>
      <Storefront />
    </Suspense>
  );
}
