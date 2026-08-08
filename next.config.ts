import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Zerops Node.js SSR (standalone bundle, no full node_modules at runtime)
  output: "standalone",
};

export default nextConfig;
