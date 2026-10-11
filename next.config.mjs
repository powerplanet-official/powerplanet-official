import { backendOrigin } from './lib/backend-config.mjs';

export default {
  output: 'standalone',

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
