// Keep style order explicit: base layout, catalog components, then brand colors.
import './globals.css';
import './catalog.css';
import './brand.css';
import './mobile-storefront.css';
import './product-carousel.css';
export const metadata = {
  title: {
    default: 'Powerplanet | Solar Panels, Inverters & Batteries',
    template: '%s | Powerplanet',
  },
  description:
    'Explore solar panels, inverters, batteries and solar accessories. Request a personalized quotation from Powerplanet.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
