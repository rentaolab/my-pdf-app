import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The plugin defaults to `./src/i18n/request.ts`, which is where the
// request-scoped i18n configuration lives in this project.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /**
   * Static export for Cloudflare Pages.
   *
   * The app has no runtime server needs: no route handlers, no server actions,
   * no `cookies()` / `headers()` reads, and every page is prerendered (10 locales
   * × 12 pages). The only server-side logic was locale negotiation, which now
   * lives in `functions/_middleware.ts` (Pages Functions).
   *
   * Consequence: `next start` no longer works — use `npm run preview`
   * (`wrangler pages dev out`) to check the real Pages behaviour locally.
   */
  output: "export",
  experimental: {
    /**
     * Rewrites barrel-file imports into per-module ones. `lucide-react` alone
     * ships ~1,500 icons and its index re-exports all of them; without this the
     * tool pages pull far more icon modules into the client graph than the
     * dozen they render.
     */
    optimizePackageImports: ["lucide-react"],
  },
};

export default withNextIntl(nextConfig);
