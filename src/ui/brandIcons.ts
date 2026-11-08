/* Faro's icons, drawn from the mark's paths (brandPaths.ts): the browser tab's favicon and the home-screen icons.
   Lane, 8 Nov: the phone icon was the favicon's small dark F on the launcher's white circle and nearly disappeared.
   Every icon is now a solid deep-teal tile with the F in white, a brighter amber beam and a brighter teal bar (Lane's
   option C, "dark, bright"): on a launcher the logo's own amber and teal looked dull. The in-app logo keeps its colours.

   npm run icons (scripts/icons.mjs) writes public/favicon.svg and renders the PNGs in public/icons from these;
   src/ui/brandIcons.test.ts fails when what's committed no longer matches. */
import { BAR, BEAM, BRAND, STEM } from './brandPaths';

/** The icon's colours: the tile, and the F's stem, beam and bar. Brighter than the in-app logo, for a launcher. */
export const ICON_COLOURS = { tile: BRAND.ink, stem: '#FFFFFF', beam: '#FFC24A', bar: '#3FD0C4' } as const;

/** The F's box is 246 × 209; the point of it that sits a little below the tile's centre (it reads as centred). */
const F_W = 246, CX = 123, CY = 112, LOW = 6 / 512;

export type IconKind = 'favicon' | 'any' | 'maskable' | 'apple';

/** How wide the F is, as a share of the tile, and the tile's corner radius (a share of its side). */
const FIT: Record<IconKind, { width: number; radius: number }> = {
  // A tab icon is 16–32 px: the F as big as it can be, on a tile with soft corners.
  favicon: { width: 0.74, radius: 0.2 },
  // Drawn as is by launchers that don't mask: a rounded tile.
  any: { width: 0.66, radius: 0.22 },
  // Masked by the launcher into a circle or squircle: full bleed, the F filling the safe zone (Lane's choice: the 246-wide
  // F at 1.35× in a 512 tile, centred slightly low). Only the beam's very tip passes the 80% safe circle; it stays well
  // inside any launcher's mask.
  maskable: { width: (246 * 1.35) / 512, radius: 0 },
  // iOS rounds the corners itself.
  apple: { width: (246 * 1.35) / 512, radius: 0 },
};

/** The SVG for an icon: a deep-teal tile and the F in white, bright amber and bright teal, centred slightly low. */
export function iconSvg(kind: IconKind): string {
  const { width, radius } = FIT[kind];
  const side = F_W / width;
  const x = CX - side / 2, y = CY - side / 2 - side * LOW;
  const r = (side * radius).toFixed(1);
  const n = (v: number) => +v.toFixed(2);
  const C = ICON_COLOURS;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x)} ${n(y)} ${n(side)} ${n(side)}">`,
    '  <title>Faro</title>',
    `  <rect x="${n(x)}" y="${n(y)}" width="${n(side)}" height="${n(side)}" rx="${r}" fill="${C.tile}"/>`,
    `  <path fill="${C.stem}" d="${STEM}"/>`,
    `  <path fill="${C.beam}" d="${BEAM}"/>`,
    `  <path fill="${C.bar}" d="${BAR}"/>`,
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
