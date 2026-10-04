import { priceLabel } from '../lib/catalog.mjs';

// Share the same price order and sale rules across the home, catalog, and detail pages.
export default function ProductPrice({ product, className = '' }) {
  const price = product.status === 'preview' ? null : product.price;
  // Unknown or unverified prices must never appear as discounted products.
  const hasDiscount = price != null && product.originalPrice > price;

  return (
    <div className={`reference-prices ${className}`.trim()}>
      <strong>{priceLabel(price)}</strong>
      {hasDiscount && (
        <del>
          <span className="sr-only">Original price: </span>
          {priceLabel(product.originalPrice)}
        </del>
      )}
    </div>
  );
}
