import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The plugin defaults to `./src/i18n/request.ts`, which is where the
// request-scoped i18n configuration lives in this project.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /**
   * Baseline hardening. `frame-ancestors 'self'` stops third-party sites from
   * embedding the tools in an iframe — the cheapest way for a clone to consume
   * our Vercel bandwidth and edge-request quota while serving its own ads.
   * Same header set as reeff.app (the brand site).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
