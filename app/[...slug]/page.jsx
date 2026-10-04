import { Suspense } from 'react';
import Storefront from '../../components/Storefront';
// Shop subroutes share the storefront and its URL-driven catalog state.
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Loading Powerplanet…</div>}>
      <Storefront />
    </Suspense>
  );
}
