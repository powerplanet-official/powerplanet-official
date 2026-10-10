
export default {
  output: 'standalone',

  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      `http://127.0.0.1:${process.env.API_PORT || 4000}`;

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
