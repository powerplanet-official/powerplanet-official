// Keep style order explicit: base layout, catalog components, then brand colors.
import './globals.css';
import './catalog.css';
import './brand.css';
import './mobile-storefront.css';
import './product-carousel.css';
import './storefront-updates.css';
import { siteOrigin } from '../lib/site-config.mjs';
export const metadata = {
  metadataBase: new URL(siteOrigin),
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  title: {
    default: 'Powerplanet | Solar Panels, Inverters & Batteries',
    template: '%s | Powerplanet',
  },
  description:
    'Explore solar panels, inverters, batteries and solar accessories. Request a personalized quotation from Powerplanet.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en-PK">
      <body>{children}</body>
    </html>
  );
}
