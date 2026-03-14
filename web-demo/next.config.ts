import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* In Next.js 16, the compiler is auto-detected. 
     Manual flags in 'experimental' are often removed once the feature stabilizes.
  */
  transpilePackages: ['mapbox-gl'],
};

export default nextConfig;