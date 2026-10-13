import { backendOrigin } from './lib/backend-config.mjs';

export default {
  output: 'standalone',
  // Resolve metadata/route validity before committing a 200 streaming response.
  htmlLimitedBots: /.*/,

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.powerplanet.pk' }],
        destination: 'https://powerplanet.pk/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      '/api/store',
      '/api/health',
      '/api/quotes',
      '/api/chat',
      '/api/admin/:path*',
      '/api/auth/:path*',
      '/api/orders/:path*',
      '/api/payments/:path*',
    ].map((source) => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
    }));
  },

  async rewrites() {
    const backendUrl = backendOrigin();

    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};
