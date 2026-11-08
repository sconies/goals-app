/* Faro's icons, drawn from the mark's paths (brandPaths.ts): the browser tab's favicon and the home-screen icons.
   Lane, 8 Nov: the phone icon was the favicon's small dark F on the launcher's white circle and nearly disappeared.
   Every icon is now a solid deep-teal tile with the F in paper white, the amber beam and the teal bar.

   npm run icons (scripts/icons.mjs) writes public/favicon.svg and renders the PNGs in public/icons from these;
   src/ui/brandIcons.test.ts fails when what's committed no longer matches. */
import { BAR, BEAM, BRAND, STEM } from './brandPaths';

/** The F's box (246 × 209) and its centre. */
const F_W = 246, F_H = 209, CX = F_W / 2, CY = F_H / 2;

export type IconKind = 'favicon' | 'any' | 'maskable' | 'apple';

/** How wide the F is, as a share of the tile, and the tile's corner radius (a share of its side). */
const FIT: Record<IconKind, { width: number; radius: number }> = {
  // A tab icon is 16–32 px: the F as big as it can be, on a tile with soft corners.
  favicon: { width: 0.74, radius: 0.2 },
  // Drawn as is by launchers that don't mask: a rounded tile.
  any: { width: 0.66, radius: 0.22 },
  // Masked by the launcher into a circle or squircle: full bleed, the F's corners inside the safe circle (80% of the side).
  maskable: { width: 0.615, radius: 0 },
  // iOS rounds the corners itself.
  apple: { width: 0.64, radius: 0 },
};

/** The SVG for an icon: a deep-teal tile and the F in paper, amber and teal, centred. */
export function iconSvg(kind: IconKind): string {
  const { width, radius } = FIT[kind];
  const side = F_W / width;
  const x = CX - side / 2, y = CY - side / 2;
  const r = (side * radius).toFixed(1);
  const n = (v: number) => +v.toFixed(2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(side)} ${n(side)}">`,
    '  <title>Faro</title>',
    `  <rect x="${n(x)}" y="${n(y)}" width="${n(side)}" height="${n(side)}" rx="${r}" fill="${BRAND.ink}"/>`,
    `  <path fill="${BRAND.paper}" d="${STEM}"/>`,
    `  <path fill="${BRAND.amber}" d="${BEAM}"/>`,
    `  <path fill="${BRAND.teal}" d="${BAR}"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/** The PNGs the manifest and index.html link to: file (under public/), size in px, and which drawing. */
export const ICON_FILES: { file: string; size: number; kind: IconKind }[] = [
  { file: 'icons/icon-192.png', size: 192, kind: 'any' },
  { file: 'icons/icon-512.png', size: 512, kind: 'any' },
  { file: 'icons/maskable-192.png', size: 192, kind: 'maskable' },
  { file: 'icons/maskable-512.png', size: 512, kind: 'maskable' },
  { file: 'icons/apple-touch-icon.png', size: 180, kind: 'apple' },
];

/** public/manifest.webmanifest: what a phone needs to put Faro on its home screen. */
export function manifest() {
  return {
    name: 'Faro',
    short_name: 'Faro',
    description: 'A goal, who owns it and how it’s doing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND.paper,
    theme_color: BRAND.paper,
    icons: ICON_FILES.filter((f) => f.kind === 'any' || f.kind === 'maskable').map((f) => ({ src: '/' + f.file, sizes: `${f.size}x${f.size}`, type: 'image/png', purpose: f.kind })),
  };
}
