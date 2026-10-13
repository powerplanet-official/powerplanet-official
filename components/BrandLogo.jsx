'use client';
import { useEffect, useRef } from 'react';

function frameLogo(image) {
  if (image?.naturalWidth) {
    image.classList.toggle('square-logo', image.naturalWidth / image.naturalHeight < 1.5);
  }
}
// Use the shared branding endpoint so an admin logo change reaches every placement.
export default function BrandLogo() {
  const logo = useRef(null);
  // An SSR image can finish loading before React attaches the load listener.
  useEffect(() => frameLogo(logo.current), []);
  return (
    <img
      ref={logo}
      className="official-logo"
      src="/api/branding/logo"
      alt="Power Planet (Pvt) Ltd. — The Power you Own"
      onError={(event) => {
        const image = event.currentTarget;
        if (!image.src.endsWith('/images/powerplanet-logo-original.jpeg')) {
          image.src = '/images/powerplanet-logo-original.jpeg';
        }
      }}
      onLoad={(event) => frameLogo(event.currentTarget)}
    />
  );
}
