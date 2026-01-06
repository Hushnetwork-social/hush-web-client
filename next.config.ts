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

// Use separate build directories for browser and Tauri to avoid conflicts
// when both dev servers run simultaneously
const getDistDir = (): string => {
  if (process.env.TAURI_DEV === 'true') return '.next-tauri';
  return '.next';
};

const nextConfig: NextConfig = {
  output: getOutputMode(),
  distDir: getDistDir(),
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
