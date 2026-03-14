import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Remove the 'eslint' block entirely. 
  // Next.js 16 no longer runs linting during 'next build'.

  // 2. Keep the TypeScript ignore if you still have type snags
  typescript: {
    ignoreBuildErrors: true, 
  },

  // 3. Recommended for your Mapbox implementation
  transpilePackages: ['mapbox-gl'],
};

export default nextConfig;