#!/usr/bin/env node
/**
 * Live ad audit — the deployment-side twin of `scripts/check-ads.mjs`.
 *
 * `check-ads.mjs` reads the local `out/` folder, so it can only prove what the
 * *build* contained. This script crawls the deployed sitemap instead, which is
 * the only way to catch a Cloudflare Pages misconfiguration (wrong variable
 * name, missing trailing space, variable saved for Preview only, env saved
 * without a rebuild).
 *
 *   npm run check:ads:live                  # https://pdf.reeff.app, ads on
 *   npm run check:ads:live -- https://my-pdf-app.pages.dev
 *   npm run check:ads:live -- --off         # assert zero ad markup (staging)
 *
 * Asserted when ads are on:
 * - home   `/{locale}`            → exactly 1 placement (P3, in-article fluid);
 * - tool   `/{locale}/<tool>`     → exactly 2 placements (P1 + P2);
 * - legal  `/{locale}/privacy|terms` → 0;
 * - no page ships the AdSense script in its prerendered HTML (on-demand load);
 * - `/ads.txt` answers 200 `text/plain` and authorises the publisher id.
 */
const args = process.argv.slice(2);
const off = args.includes("--off");
const base = (args.find((a) => !a.startsWith("--")) || "https://pdf.reeff.app").replace(/\/$/, "");

const EXPECT = off ? { home: 0, tool: 0, legal: 0 } : { home: 1, tool: 2, legal: 0 };
const PUBLISHER_ID = "pub-4891040014815847";

const problems = [];
const counts = { home: 0, tool: 0, legal: 0 };
const slotIds = new Map();

async function get(url) {
  const response = await fetch(url, { headers: { "user-agent": "reeff-ads-audit/1.0" } });
  return { status: response.status, type: response.headers.get("content-type") || "", body: await response.text() };
}

const sitemap = await get(`${base}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`✗ ${base}/sitemap.xml → ${sitemap.status}`);
  process.exit(1);
}

const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1])
  .filter((url) => url.startsWith(base));

if (urls.length === 0) {
  console.error(`✗ sitemap has no ${base} urls`);
  process.exit(1);
}

for (const url of urls) {
  const path = new URL(url).pathname;
  const page = await get(url);
  if (page.status !== 200) {
    problems.push(`${path} → HTTP ${page.status}`);
    continue;
  }

  const kind = /^\/[a-z]{2}\/?$/.test(path) ? "home" : /\/(privacy|terms)$/.test(path) ? "legal" : "tool";
  counts[kind]++;

  const slots = page.body.match(/data-ad-slot="(\d+)"/g) || [];
  if (slots.length !== EXPECT[kind]) {
    problems.push(`${path} → ${slots.length} slots (expected ${EXPECT[kind]})`);
  }
  for (const slot of slots) slotIds.set(slot, (slotIds.get(slot) || 0) + 1);

  if (page.body.includes("googlesyndication")) {
    problems.push(`${path} → AdSense script in prerendered HTML (must load on demand)`);
  }
  if (!page.body.includes(`data-ad-client="ca-${PUBLISHER_ID}"`) && slots.length > 0) {
    problems.push(`${path} → ad client id is not ca-${PUBLISHER_ID}`);
  }
}

const adsTxt = await get(`${base}/ads.txt`);
if (adsTxt.status !== 200) problems.push(`/ads.txt → HTTP ${adsTxt.status}`);
else if (!adsTxt.type.includes("text/plain")) problems.push(`/ads.txt → content-type ${adsTxt.type}`);
else if (!adsTxt.body.includes(PUBLISHER_ID)) problems.push(`/ads.txt → does not authorise ${PUBLISHER_ID}`);

const totalPages = counts.home + counts.tool + counts.legal;
console.log(`pages: ${totalPages} (home ${counts.home} / tool ${counts.tool} / legal ${counts.legal})`);
console.log(`slots: ${[...slotIds.entries()].map(([slot, n]) => `${slot}×${n}`).join(", ") || "none"}`);

if (problems.length > 0) {
  console.log(`✗ ${problems.length} problems on ${base}`);
  for (const problem of problems.slice(0, 20)) console.log(`  - ${problem}`);
  if (problems.length > 20) console.log(`  … and ${problems.length - 20} more`);
  process.exit(1);
}

console.log(`✓ check:ads:live — ${base}, ads ${off ? "off" : "on"}, ${totalPages} pages within budget`);
