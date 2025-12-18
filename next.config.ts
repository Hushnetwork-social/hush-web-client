import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: Removed 'output: export' to enable API routes for gRPC proxy
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
