import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Required by `output: "export"` (see src/app/sitemap.ts).
export const dynamic = "force-static";

/**
 * Crawlers that exist only to feed model training or scraped datasets. Blocking
 * them costs this site nothing — none of them sends referral traffic.
 */
const AI_CRAWLERS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "Diffbot",
  "Google-Extended",
  "GPTBot",
  "omgili",
  "anthropic-ai",
  "Claude-Web",
  "cohere-ai",
  "MistralAI-Training",
  "meta-externalagent",
  "GoogleOther",
  "AwarioSmartBot",
  "AwarioRssBot",
  "Google-CloudVertexBot",
  "QualifiedBot",
  "Cotoyogi",
  "ICC-Crawler",
  "atlassian-bot",
  "FishBot",
  "BorderxBot",
  "NavuBot",
  "SemrushBot-SWA",
  "WARDBot",
  "magpie-crawler",
  "KimiBot",
  "CitibotSiteCrawler",
];

/**
 * Search engines are welcome, including the Chinese ones the `zh` locale is
 * written for — blocking them costs a site that ships a full Chinese
 * translation real traffic and protects nothing.
 *
 * ⚠️ This file alone does **not** make `pdf.reeff.app` crawlable by Baiduspider.
 * The domain sits in a Cloudflare zone where **AI Crawl Control** prepends a
 * managed block to `robots.txt` with a blanket `Disallow: /` for Baiduspider and
 * PetalBot. A `Disallow` beats an `Allow` when groups merge, so the managed
 * block must be turned off in the Cloudflare dashboard; a Pages Function cannot
 * override it either, because `out/_routes.json` excludes `/*.txt` and
 * `/robots.txt` therefore never reaches `functions/_middleware.ts`.
 *
 * What is declared here is the policy to keep once that switch is off, and what
 * `next dev` serves in the meantime.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: ["Baiduspider", "PetalBot"], allow: "/" },
      { userAgent: AI_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
