#!/usr/bin/env node
/**
 * Static-export ad audit for `docs/monetization.md` §7.
 *
 * Run against the output of a build made with the *same* environment variables
 * you are about to deploy:
 *
 *   npm run build && npm run check:ads
 *   NEXT_PUBLIC_ADS_ENABLED=true NEXT_PUBLIC_ADS_SLOT_P1=… npm run build && npm run check:ads
 *
 * It asserts the placement budget instead of trusting code review:
 * - ads off  → zero ad markup anywhere (no `<ins>`, no `data-ad-slot`, no script);
 * - ads on   → tool pages 1× P1 + 1× P2, home 1× P3, legal/info pages 0;
 * - no ad script in prerendered HTML (it is injected client-side on demand);
 * - P2 keeps a ≥96px gap (`mt-24`) and a divider from the tool card.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "out";
const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const slots = {
  p1: process.env.NEXT_PUBLIC_ADS_SLOT_P1 || "",
  p2: process.env.NEXT_PUBLIC_ADS_SLOT_P2 || "",
  p3: process.env.NEXT_PUBLIC_ADS_SLOT_P3 || "",
};

if (!fs.existsSync(root)) {
  console.error(`✗ ${root}/ not found — run \`npm run build\` first`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".html")) files.push(file);
  }
})(root);

const count = (haystack, needle) => haystack.split(needle).length - 1;
const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
};

/** `/about`, `/how-it-works` use `InfoPageShell`, which carries no ad slot. */
const INFO_PAGES = /\/(about|how-it-works)$/;

let checked = 0;
for (const file of files.sort()) {
  const rel = "/" + path.relative(root, file).replace(/\.html$/, "");
  if (!/^\/[a-z]{2}(\/|$)/.test(rel)) continue; // 404 pages are outside the locale layout
  checked++;

  const html = fs.readFileSync(file, "utf8");
  const isLegal = /\/(privacy|terms)$/.test(rel);
  const isHome = /^\/[a-z]{2}$/.test(rel);
  const isInfo = INFO_PAGES.test(rel);
  const ins = count(html, 'class="adsbygoogle');
  const script = count(html, "adsbygoogle.js");

  // No ad script may be prerendered: AdSlot injects it on demand, after consent.
  check(script === 0, `${rel}: ad script found in static HTML`);

  if (!enabled) {
    check(ins === 0, `${rel}: ${ins} ad slot(s) with ADS_ENABLED off`);
    check(!html.includes("data-ad-slot"), `${rel}: data-ad-slot present with ADS_ENABLED off`);
    continue;
  }

  const found = Object.fromEntries(
    Object.entries(slots)
      .filter(([, id]) => id.length > 0)
      .map(([placement, id]) => [placement, count(html, `data-ad-slot="${id}"`)]),
  );

  const expected = isLegal || isInfo ? 0 : isHome ? (found.p3 !== undefined ? 1 : 0) : 2;
  check(ins === expected, `${rel}: ${ins} ad slot(s), expected ${expected}`);

  if (isLegal || isInfo) {
    check(!html.includes("data-ad-slot"), `${rel}: placement on a page without ad slots`);
  } else if (isHome) {
    check((found.p1 ?? 0) === 0 && (found.p2 ?? 0) === 0, `${rel}: only P3 belongs on the home page`);
  } else {
    check((found.p1 ?? 0) === 1, `${rel}: P1 count ${found.p1 ?? 0}, expected 1`);
    check((found.p2 ?? 0) === 1, `${rel}: P2 count ${found.p2 ?? 0}, expected 1`);
    check((found.p3 ?? 0) === 0, `${rel}: P3 must not appear on tool pages`);
  }
}

// Spacing: P2 must sit outside the tool card, 96px + divider below it.
if (enabled && slots.p2) {
  const sample = path.join(root, "en", "merge-pdf.html");
  if (fs.existsSync(sample)) {
    const html = fs.readFileSync(sample, "utf8");
    const at = html.lastIndexOf("data-ad-slot=", html.indexOf(`data-ad-slot="${slots.p2}"`));
    const wrapperStart = html.lastIndexOf("<aside", at);
    const wrapper = html.slice(wrapperStart, html.indexOf(">", wrapperStart));
    check(wrapper.includes("mt-24!"), "P2: missing 96px gap class (mt-24!)");
    check(wrapper.includes("border-t"), "P2: missing divider above the unit");
  }
}

if (problems.length) {
  console.error(`✗ check:ads — ${problems.length} problem(s) across ${checked} pages`);
  for (const problem of problems.slice(0, 40)) console.error("  - " + problem);
  if (problems.length > 40) console.error(`  … ${problems.length - 40} more`);
  process.exit(1);
}

console.log(
  `✓ check:ads — ${checked} localized pages, ads ${enabled ? "on" : "off"}, placement budget respected`,
);
