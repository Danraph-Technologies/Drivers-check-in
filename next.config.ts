import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer must load as a real Node module, not be bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
  // A production build must never share .next with a running dev server;
  // each corrupts the other's manifests. Build separately with e.g.
  // NEXT_DIST_DIR=.next-prod npm run build when the dev server is running.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
