#!/usr/bin/env node
/**
 * Deployment parity — is pdf.reeff.app actually serving the build in `out/`?
 *
 * `check:ads:live` proves the deployed ads are configured; this script proves the
 * deployed **content** matches the commit you just pushed. Those are different
 * failures. On 2026-10-31 the Cloudflare Pages GitHub check reported *success*
 * for three consecutive commits while the live site still answered with a
 * 140-URL `sitemap.xml` (no about/how-it-works, `lastmod` stamped by the old
 * `new Date()` code) and tool pages without FAQ markup: the edge served a mix of
 * an old deployment and a new one. Nothing in the build output or the Pages
 * check revealed that — only comparing live files against `out/` does.
 *
 *   npm run build && npm run check:deploy
 *   npm run check:deploy -- https://my-pdf-app.pages.dev
 *
 * Asserts:
 * 1. live sitemap URL set == local sitemap URL set (site shape: pages + tools);
 * 2. live `lastmod` values == local ones (a stale sitemap is the symptom above;
 *    `LAST_MODIFIED` is bumped by hand in `src/app/sitemap.ts`);
 * 3. every advertised URL answers 200;
 * 4. for two locales, per page: same `<h1>` text, same FAQ `<dt>` count, same ad
 *    slot count — the three things that silently change between deploys;
 * 5. the home page links to exactly the tools the local build links to.
 *
 * Cloudflare injects scripts into HTML (email obfuscation), so the fingerprints
 * are counts and the `<h1>` text rather than a byte hash.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "out");
const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) || "https://pdf.reeff.app").replace(/\/$/, "");

/** Locales whose page content is fingerprinted; the rest only get a 200 check. */
const DEEP_LOCALES = ["en", "zh"];
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

const problems = [];
const warnings = [];
/** Pages where the local build has no ad slots but production renders some. */
const skipAdSlots = new Set();

const locs = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname).sort();
const lastmods = (xml) =>
  [...new Set([...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(([, date]) => date))].sort();
const h1Text = (html) =>
  (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
const count = (html, pattern) => (html.match(pattern) || []).length;
const toolLinks = (html) =>
  [...new Set([...html.matchAll(/href="(\/[a-z]{2}\/[a-z-]+)"/g)].map(([, href]) => href))]
    .filter((href) => !/\/(privacy|terms|about|how-it-works)$/.test(href))
    .sort();

async function get(path, method = "GET") {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "user-agent": "reeff-deploy-audit/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: response.status, body: method === "GET" ? await response.text() : "" };
}

/** Runs `task` over `items` with a small pool so 170 URLs do not open 170 sockets. */
async function pool(items, task) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) await task(queue.shift());
    }),
  );
}

let localSitemap;
try {
  localSitemap = readFileSync(join(OUT_DIR, "sitemap.xml"), "utf8");
} catch {
  console.error(`✗ out/sitemap.xml is missing — run \`npm run build\` first`);
  process.exit(1);
}

const live = await get("/sitemap.xml").catch((error) => ({ status: 0, body: "", error }));
if (live.status !== 200) {
  console.error(`✗ ${base}/sitemap.xml → ${live.status || live.error}`);
  process.exit(1);
}


// 1 + 2. Site shape and cache watermark.
const localPaths = locs(localSitemap);
const livePaths = locs(live.body);
const missing = localPaths.filter((path) => !livePaths.includes(path));
const extra = livePaths.filter((path) => !localPaths.includes(path));

if (missing.length > 0) {
  problems.push(`live sitemap is missing ${missing.length} URL(s), e.g. ${missing.slice(0, 5).join(", ")}`);
}
if (extra.length > 0) {
  warnings.push(`live sitemap has ${extra.length} URL(s) not in out/, e.g. ${extra.slice(0, 5).join(", ")}`);
}

const localLastmod = lastmods(localSitemap);
const liveLastmod = lastmods(live.body);
if (localLastmod.join() !== liveLastmod.join()) {
  problems.push(
    `live sitemap lastmod [${liveLastmod.join(", ") || "none"}] != out/ [${localLastmod.join(", ") || "none"}]` +
      " — the deployment is serving an older sitemap than the build",
  );
}

// 3. Every advertised URL resolves.
const notServed = [];
await pool(localPaths, async (path) => {
  const page = await get(path, "HEAD").catch(() => ({ status: 0 }));
  if (page.status !== 200) notServed.push(`${path} → ${page.status || "network error"}`);
});
if (notServed.length > 0) {
  problems.push(`${notServed.length} advertised URL(s) not served: ${notServed.slice(0, 5).join(", ")}`);
}

// 4 + 5. Content fingerprints for the deep locales, plus the home tool links.
const deepPaths = localPaths.filter((path) => DEEP_LOCALES.some((locale) => path.startsWith(`/${locale}`)));
let fingerprinted = 0;

await pool(deepPaths, async (path) => {
  let local;
  try {
    local = readFileSync(join(OUT_DIR, `${path}.html`), "utf8");
  } catch {
    problems.push(`out${path}.html is missing`);
    return;
  }

  const page = await get(path).catch((error) => ({ status: 0, body: "", error }));
  if (page.status !== 200) {
    problems.push(`${path} → HTTP ${page.status || page.error}`);
    return;
  }
  fingerprinted++;

  const h1Expected = h1Text(local);
  const h1Actual = h1Text(page.body);
  if (h1Expected !== h1Actual) problems.push(`${path} → <h1> "${h1Actual}" (out/ has "${h1Expected}")`);

  const dtExpected = count(local, /<dt[\s>]/g);
  const dtActual = count(page.body, /<dt[\s>]/g);
  if (dtExpected !== dtActual) problems.push(`${path} → ${dtActual} FAQ <dt> (out/ has ${dtExpected})`);

  // Ads are build-time configuration, not content: the local `out/` is built with
  // ads off while production sets NEXT_PUBLIC_ADS_ENABLED=true. Only compare when
  // the local build actually rendered slots; `check:ads:live` owns the live budget.
  const slotsExpected = count(local, /data-ad-slot="\d+"/g);
  const slotsActual = count(page.body, /data-ad-slot="\d+"/g);
  if (slotsExpected > 0 && slotsExpected !== slotsActual) {
    problems.push(`${path} → ${slotsActual} ad slots (out/ has ${slotsExpected})`);
  }
  if (slotsExpected === 0 && slotsActual > 0) skipAdSlots.add(path);

  // Home pages carry the tool grid; a tool that exists but is not linked is only
  // reachable through the sitemap.
  if (/^\/[a-z]{2}$/.test(path)) {
    const expected = toolLinks(local);
    const actual = toolLinks(page.body);
    if (expected.join() !== actual.join()) {
      problems.push(`${path} → tool links [${actual.join(", ")}] (out/ has [${expected.join(", ")}])`);
    }
  }
});

for (const warning of warnings) console.warn(`  ! ${warning}`);
if (skipAdSlots.size > 0) {
  console.log(`  · ad slots not compared on ${skipAdSlots.size} pages (local build has ads off)`);
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} deployment mismatch(es) on ${base}:`);
  for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  console.error(
    "\n  If the Pages check is green but this fails, the deployment did not replace the live files.\n" +
      "  Check the Deployments list (commit + Production flag), then purge the cache and retry.",
  );
  process.exit(1);
}

console.log(
  `✓ check:deploy — ${localPaths.length} URLs live on ${base}, ${fingerprinted} pages fingerprinted against out/`,
);
