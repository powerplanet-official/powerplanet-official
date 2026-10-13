import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="loading">
      <h1>Page not found</h1>
      <p>This product or page may have been moved.</p>
      <Link className="primary" href="/shop">
        Browse solar products
      </Link>
    </main>
  );
}
