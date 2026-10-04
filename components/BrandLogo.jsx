'use client';
// Use the shared branding endpoint so an admin logo change reaches every placement.
export default function BrandLogo() {
  return (
    <img
      className="official-logo"
      src="/api/branding/logo"
      alt="Power Planet (Pvt) Ltd. — The Power you Own"
      onLoad={(e) => {
        const image = e.currentTarget;
        image.classList.toggle('square-logo', image.naturalWidth / image.naturalHeight < 1.5);
      }}
    />
  );
}
