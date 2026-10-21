#!/usr/bin/env node
/**
 * Copies the pdf.js worker out of `node_modules` into `public/`.
 *
 * Why self-host it: the worker used to be fetched from
 * `//unpkg.com/pdfjs-dist@<version>/build/pdf.worker.min.mjs`. That makes a
 * third-party CDN a hard dependency for the four tools that rasterise or edit
 * pages (crop, organize, pdf-to-image, edit): if unpkg is blocked (corporate
 * proxy, ad blocker, mainland China) or slow, those tools hang forever behind a
 * request that never settles. Serving it from our own origin removes the
 * dependency and the extra DNS/TLS handshake.
 *
 * The file name carries the exact `pdfjs-dist` version, because pdf.js refuses
 * to run when the API and the worker disagree ("The API version does not match
 * the Worker version") — a versioned URL also lets `_headers` cache it
 * immutably without pinning users to a stale worker after an upgrade.
 *
 * Runs from `predev` and `prebuild`, so the copy in `public/` always matches the
 * installed version. The copy in `public/` is committed on purpose: it is part of
 * the static export, and a build that skips lifecycle scripts (Cloudflare Pages
 * did) would otherwise ship without it, leaving every pdf.js tool broken with a
 * 404 worker. Upgrade pdfjs-dist, run any npm script, and commit the new file.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "pdfjs-dist");
const publicDir = join(root, "public");
const WORKER_RE = /^pdf\.worker\..+\.min\.mjs$/;

function fail(message) {
  console.error(`[sync-pdf-worker] ${message}`);
  process.exit(1);
}

let version;
try {
  version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
} catch {
  fail("cannot read node_modules/pdfjs-dist — run `npm install` first.");
}

const source = join(pkgDir, "build", "pdf.worker.min.mjs");
const file = `pdf.worker.${version}.min.mjs`;
const target = join(publicDir, file);

let sourceSize;
try {
  sourceSize = statSync(source).size;
} catch {
  fail(`missing ${source} — the installed pdfjs-dist build layout changed.`);
}

mkdirSync(publicDir, { recursive: true });

// Drop workers left over from previous versions so the export does not carry
// dead ~1.2 MB files into every deployment.
const stale = readdirSync(publicDir).filter((name) => WORKER_RE.test(name) && name !== file);
for (const name of stale) {
  rmSync(join(publicDir, name));
  console.log(`[sync-pdf-worker] removed stale ${name}`);
}

copyFileSync(source, target);
const kb = Math.round(sourceSize / 1024);
console.log(`[sync-pdf-worker] public/${file} (${kb} KB, pdfjs-dist@${version})`);
