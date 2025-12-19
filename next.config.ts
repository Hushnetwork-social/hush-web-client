import type { NextConfig } from "next";

// Determine output mode based on environment:
// - STANDALONE_BUILD=true: Docker deployment (standalone mode)
// - STATIC_EXPORT=true: Tauri desktop app (static HTML export)
// - Neither: Default Next.js behavior (for development)
const getOutputMode = (): NextConfig['output'] | undefined => {
  if (process.env.STATIC_EXPORT === 'true') return 'export';
  if (process.env.STANDALONE_BUILD === 'true') return 'standalone';
  return undefined;
};

const nextConfig: NextConfig = {
  output: getOutputMode(),
  images: {
    unoptimized: true,
  },
  // CORS headers for Tauri desktop app (calls API from different origin)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
