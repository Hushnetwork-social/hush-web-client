import type { NextConfig } from "next";

// Check if we're doing a static export (Tauri desktop app)
const isStaticExport = process.env.STATIC_EXPORT === 'true';

// Determine output mode based on environment:
// - STANDALONE_BUILD=true: Docker deployment (standalone mode)
// - STATIC_EXPORT=true: Tauri desktop app (static HTML export)
// - Neither: Default Next.js behavior (for development)
const getOutputMode = (): NextConfig['output'] | undefined => {
  if (isStaticExport) return 'export';
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
  // In static export mode, exclude API routes by changing page extensions
  // API routes use route.ts, so we use route.server.ts pattern to exclude them
  // In static export, we exclude route.ts files (API routes don't work without a server)
  ...(isStaticExport ? {
    // Use webpack to exclude API routes from static export
    // API routes fundamentally don't work in static exports (no server)
    webpack: (config, { isServer }) => {
      if (isServer) {
        // Replace API route imports with empty modules during static export
        config.resolve.alias = {
          ...config.resolve.alias,
        };
        // Ignore API route files during static export build
        config.module.rules.push({
          test: /src[\\/]app[\\/]api[\\/].*[\\/]route\.ts$/,
          use: 'null-loader',
        });
      }
      return config;
    },
  } : {}),
  // CORS headers for web deployment
  // Note: headers() doesn't work in static export mode (no server)
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
