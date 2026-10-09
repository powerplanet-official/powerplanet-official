'use client';
// Use the shared branding endpoint so an admin logo change reaches every placement.
export default function BrandLogo() {
  return (
    <img
      className="official-logo"
      src="/api/branding/logo"
      alt="Power Planet (Pvt) Ltd. — The Power you Own"
      onError={(event) => {
        const image = event.currentTarget;
        if (!image.src.endsWith('/images/powerplanet-logo-original.jpeg')) {
          image.src = '/images/powerplanet-logo-original.jpeg';
        }
      }}
      onLoad={(e) => {
        const image = e.currentTarget;
        image.classList.toggle('square-logo', image.naturalWidth / image.naturalHeight < 1.5);
      }}
    />
  );
}
