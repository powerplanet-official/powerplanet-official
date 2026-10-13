'use client';

export default function StoreError({ reset }) {
  return (
    <main className="loading">
      <h1>Powerplanet</h1>
      <p role="alert">The store could not be loaded. Please try again.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
