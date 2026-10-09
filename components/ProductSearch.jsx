'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchProducts } from '../lib/search.mjs';
import { priceLabel } from '../lib/catalog.mjs';

// Desktop and mobile use the same ranking as the full search results.
export default function ProductSearch({ products, mobile = false }) {
  const params = useSearchParams();
  return (
    <SearchField
      key={params.get('q') || ''}
      products={products}
      mobile={mobile}
      initialQuery={params.get('q') || ''}
    />
  );
}

function SearchField({ products, mobile, initialQuery }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = useMemo(
    () => (query.trim().length >= 2 ? searchProducts(products, query) : []),
    [products, query],
  );
  const suggestions = matches.slice(0, 5);
  const showSuggestions = open && query.trim().length >= 2;
  const searchHref = '/shop?' + new URLSearchParams({ q: query.trim() });
  function navigate(href) {
    setOpen(false);
    setActiveIndex(-1);
    router.push(href);
  }
  return (
    <form
      className={mobile ? 'mobile-store-search product-search' : 'search product-search'}
      action="/shop"
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(
          showSuggestions && activeIndex >= 0
            ? '/product/' + suggestions[activeIndex].id
            : searchHref,
        );
      }}
    >
      <input
        name="q"
        type="search"
        value={query}
        placeholder={
          mobile ? 'Search solar products…' : 'Search solar panels, inverters, batteries…'
        }
        aria-label={mobile ? 'Search solar products' : 'Search products'}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listId : undefined}
        aria-activedescendant={
          showSuggestions && activeIndex >= 0 ? listId + '-' + activeIndex : undefined
        }
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
          }
          if (['ArrowDown', 'ArrowUp'].includes(event.key) && suggestions.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) =>
              event.key === 'ArrowDown'
                ? (index + 1) % suggestions.length
                : index < 0
                  ? suggestions.length - 1
                  : (index - 1 + suggestions.length) % suggestions.length,
            );
          }
        }}
      />
      <button type="submit" aria-label={mobile ? 'Search solar products' : 'Search'}>
        <Search size={21} />
      </button>
      {showSuggestions && (
        <div className="search-suggestions">
          <div id={listId} role="listbox" aria-label="Suggested solar products">
            {suggestions.map((product, index) => (
              <div
                id={listId + '-' + index}
                key={product.id}
                role="option"
                aria-selected={index === activeIndex}
                className="search-suggestion"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => navigate('/product/' + product.id)}
              >
                <img src={product.image} alt="" width="44" height="44" />
                <span>
                  {product.name}
                  <strong>{priceLabel(product.price)}</strong>
                </span>
              </div>
            ))}
          </div>
          {!matches.length && (
            <p role="status">No matching solar products. Try a brand, model or capacity.</p>
          )}
          {!!matches.length && (
            <a
              href={searchHref}
              className="search-all"
              onClick={(event) => {
                event.preventDefault();
                navigate(searchHref);
              }}
            >
              View all {matches.length} results
            </a>
          )}
        </div>
      )}
    </form>
  );
}
