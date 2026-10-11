// A Vercel deployment has no local Express process. Fail the build instead of
// publishing a storefront whose API silently points back to the frontend.
export function backendOrigin(env = process.env) {
  const configured = env.BACKEND_URL?.trim();
  if (!configured && env.VERCEL === '1') {
    throw new Error('Set BACKEND_URL to the HTTPS TezHost API origin before deploying to Vercel.');
  }

  const value = configured || `http://127.0.0.1:${env.API_PORT || 4000}`;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('BACKEND_URL must be an absolute HTTP(S) origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'BACKEND_URL must contain only the API origin, without /api, credentials, query or fragment.',
    );
  }
  if (
    env.VERCEL === '1' &&
    (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new Error('Vercel BACKEND_URL must use a remote HTTPS API origin.');
  }
  const frontendHosts = [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
  if (env.PUBLIC_SITE_URL) frontendHosts.push(new URL(env.PUBLIC_SITE_URL).host);
  if (frontendHosts.includes(url.host)) {
    throw new Error('BACKEND_URL points to the frontend. Use the separate TezHost API hostname.');
  }
  return url.origin;
}
