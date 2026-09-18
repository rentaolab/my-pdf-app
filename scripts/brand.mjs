#!/usr/bin/env node
/**
 * Regenerates every brand asset from the two source SVGs, so a new subdomain
 * (image / audio / receipt) is a one-flag change:
 *
 *   npm run brand                                   # pdf red (default)
 *   npm run brand -- --accent=#7C3AED --name=image  # violet variant
 *
 * Sources: public/brand/mark.svg (32x32 app mark), public/brand/og.svg (1200x630).
 * Outputs: src/app/icon.svg|icon.png|icon1.png|icon2.png|apple-icon.png|opengraph-image.png
 *          public/brand/icon-192.png|icon-512.png|icon-512-maskable.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_ACCENT = '#DC2626';
const DARK = '#0F172A';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const accent = flag('accent', DEFAULT_ACCENT);
const name = flag('name', 'pdf');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, data) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p), data);
};
const recolour = (svg) => (accent === DEFAULT_ACCENT ? svg : svg.split(DEFAULT_ACCENT).join(accent));
const raster = (svg, size, out, opts = {}) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size, opts).png({ compressionLevel: 9 }).toFile(path.join(ROOT, out));

const mark = recolour(read('public/brand/mark.svg'));
const og = recolour(read('public/brand/og.svg'));
const markInner = mark.slice(mark.indexOf('-->') + 3, mark.lastIndexOf('</svg>'));

// 1. vector favicon + raster sizes for Safari / iOS / Android
write('src/app/icon.svg', mark);
await raster(mark, 32, 'src/app/icon.png');
await raster(mark, 48, 'src/app/icon1.png');
await raster(mark, 96, 'src/app/icon2.png');
await raster(mark, 180, 'src/app/apple-icon.png');
await raster(mark, 192, 'public/brand/icon-192.png');
await raster(mark, 512, 'public/brand/icon-512.png');

// 2. maskable icon: keep the mark inside the centre 80% safe area
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${DARK}"/>
  <g transform="translate(71.68 71.68) scale(${(512 * 0.72) / 32})">${markInner}</g>
</svg>`;
await raster(maskable, 512, 'public/brand/icon-512-maskable.png');

// 3. social card — density 72 keeps the 1200x630 pixels 1:1
const ogPng = await sharp(Buffer.from(og), { density: 72 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(path.join(ROOT, 'src/app/opengraph-image.png'));

// 4. a reusable palette variant for the other subdomains
if (name !== 'pdf') write(`public/brand/mark-${name}.svg`, mark);

// ---- report + sanity checks -------------------------------------------------
const size = (p) => sharp(path.join(ROOT, p)).metadata();
const meta = await size('src/app/opengraph-image.png');
const { data, info } = await sharp(path.join(ROOT, 'src/app/opengraph-image.png'))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// Only bright pixels matter here: the accent glow is allowed to bleed off-canvas,
// while the logo and the wordmark must keep a margin.
let brightMaxX = -1;
let brightMinX = info.width;
let brightMaxY = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    if (data[i] > 140 && data[i + 1] > 140 && data[i + 2] > 140) {
      if (x > brightMaxX) brightMaxX = x;
      if (x < brightMinX) brightMinX = x;
      if (y > brightMaxY) brightMaxY = y;
    }
  }
}
const margin = Math.min(brightMinX, info.width - 1 - brightMaxX);
const fits = margin >= 24 && brightMaxY < info.height - 24;

console.log(`brand assets regenerated (accent ${accent}, name ${name})`);
console.log(`  src/app/icon.svg            ${mark.length} bytes`);
console.log(`  icon.png 32 / icon1.png 48 / icon2.png 96 / apple-icon.png 180`);
console.log(
  `  opengraph-image.png         ${meta.width}x${meta.height} (${ogPng.size} bytes); ` +
    `white ink x ${brightMinX}..${brightMaxX}, bottom y ${brightMaxY} → margin ${margin}px ${fits ? 'OK' : 'TOO TIGHT (check layout)'}`,
);
console.log(`  public/brand/icon-192, icon-512, icon-512-maskable`);
