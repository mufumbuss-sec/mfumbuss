import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@supabase/phoenix": path.resolve(__dirname, "vendor/supabase-phoenix-shim.mjs"),
    };
    return config;
  },
};

export default nextConfig;
