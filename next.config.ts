import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve resources when accessed via 127.0.0.1
  // (the workspace's dev preview uses 127.0.0.1, not localhost).
  // This is dev-only and has no effect on production deployments.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Cross-origin isolation is REQUIRED for WebContainer (SharedArrayBuffer).
  // This affects the entire app — every response gets COOP/COEP headers.
  // Side effect: any third-party resource (analytics, fonts, iframes) loaded
  // by the app must either send Cross-Origin-Resource-Policy: cross-origin
  // or be loaded with crossorigin="anonymous". The LUCIAN app does not load
  // any third-party resources that would break under COEP.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
