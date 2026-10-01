import {Suspense} from 'react';
import Storefront from '../components/Storefront';
export default function Page(){return <Suspense fallback={<div className="loading">Loading Powerplanet…</div>}><Storefront/></Suspense>}
