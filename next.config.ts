import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve resources when accessed via 127.0.0.1
  // (the workspace's dev preview uses 127.0.0.1, not localhost).
  // This is dev-only and has no effect on production deployments.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
