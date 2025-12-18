import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment (enabled via STANDALONE_BUILD=true)
  // This creates a minimal production build with all dependencies bundled
  ...(process.env.STANDALONE_BUILD === 'true' && { output: 'standalone' }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
