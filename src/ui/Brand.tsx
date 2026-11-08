/* Faro's mark and logo, drawn from the wordmark Lane supplied (6 Nov). "Faro" is a lighthouse: the F is a dark stem, an
   amber beam across the top that rises to the right, and a short teal bar. "aro" is drawn as shapes (Inter Display
   ExtraBold, tightened to match the wordmark), so the logo never waits for a font.
   The ink parts are currentColor, set by .faro-brand from --brand-ink, so they turn light in dark mode; the amber and teal
   never change. Amber is the logo's alone: in the app it would read as At risk (docs/design-rules.md).
   The paths live in brandPaths.ts, shared with the splash (Splash.tsx) and the icons (brandIcons.ts, which writes
   public/favicon.svg and the home-screen icons: npm run icons). */

import { ARO, BAR, BEAM, BRAND, STEM } from './brandPaths';

export { BRAND };

function F() {
  return (
    <>
      <path d={STEM} fill="currentColor" />
      <path d={BEAM} fill={BRAND.amber} />
      <path d={BAR} fill={BRAND.teal} />
    </>
  );
}

interface BrandProps {
  /** Height in px (the mark is square, so also its width). */
  size?: number;
  /** The accessible name; null when the words beside it already say "Faro". */
  label?: string | null;
  className?: string;
}

const a11y = (label: string | null) => (label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const });

/** The F on its own, centred in a square: the favicon, the icon rail, anywhere small. */
export function FaroMark({ size = 24, label = 'Faro', className }: BrandProps) {
  return (
    <svg className={'faro-brand faro-mark' + (className ? ' ' + className : '')} viewBox="-8 -24 262 262" width={size} height={size} focusable="false" {...a11y(label)}>
      <F />
    </svg>
  );
}

/** The whole wordmark, "Faro". `size` is its height; the width follows (about 2.25 times the height). */
export function FaroLogo({ size = 32, label = 'Faro', className }: BrandProps) {
  return (
    <svg className={'faro-brand faro-logo' + (className ? ' ' + className : '')} viewBox="0 0 472 210" height={size} width={Math.round((size * 472) / 210)} focusable="false" {...a11y(label)}>
      <F />
      <path d={ARO} fill="currentColor" />
    </svg>
  );
}
