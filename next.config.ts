import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The README demo binds to loopback; allow either local browser hostname.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Avoid a framework "Cache disabled" badge over the labelled fixture demo.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
