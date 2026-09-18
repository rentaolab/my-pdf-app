import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Icons are emitted by `npm run brand`, which derives every size
 * from `public/brand/mark.svg` (see scripts/brand.mjs).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Reeff.PDF — Free Online PDF Tools',
    short_name: 'Reeff.PDF',
    description:
      'Free, privacy-first PDF toolkit that runs entirely in your browser. Merge, split, rotate, crop and edit PDF files without uploading them.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#0F172A',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
