import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root also contains the legacy static site's package-lock.json;
  // pin the workspace root to this app.
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    // Legacy static-site URLs
    return [
      { source: '/products.html', destination: '/products', permanent: true },
      { source: '/projects.html', destination: '/projects', permanent: true },
      { source: '/index.html', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
