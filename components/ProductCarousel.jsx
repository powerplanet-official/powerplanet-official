'use client';

import { Children, useEffect, useRef, useState } from 'react';

// Product rows advance automatically; pause during browsing so links and
// touch gestures remain easy to use without adding visible controls.
export default function ProductCarousel({ children, label, railClassName = '' }) {
  const products = Children.toArray(children);
  const rail = useRef(null);
  const [interacting, setInteracting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.5,
    });
    intersection.observe(node);
    return () => {
      intersection.disconnect();
    };
  }, [products.length]);

  useEffect(() => {
    if (interacting || hovered || focused || reducedMotion || !visible || products.length < 2)
      return;
    const timer = setInterval(() => {
      const node = rail.current;
      if (!node || document.hidden || node.scrollWidth <= node.clientWidth + 3) return;
      const cardWidth = node.children[0].getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 3;
      node.scrollTo({ left: atEnd ? 0 : node.scrollLeft + cardWidth + gap, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(timer);
  }, [interacting, hovered, focused, reducedMotion, visible, products.length]);

  const moveProducts = (direction) => {
    rail.current?.scrollBy({
      left: direction * rail.current.clientWidth,
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  };

  return (
    <div
      className="product-carousel"
      role="region"
      aria-label={`${label} carousel`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className={`product-carousel-rail ${railClassName}`.trim()}
        ref={rail}
        tabIndex={0}
        aria-label={`${label} products, scroll horizontally`}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        onPointerCancel={() => setInteracting(false)}
        onPointerLeave={() => setInteracting(false)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            moveProducts(event.key === 'ArrowRight' ? 1 : -1);
          }
        }}
      >
        {products}
      </div>
    </div>
  );
}
