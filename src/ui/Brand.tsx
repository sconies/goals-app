/* Faro's mark and logo, drawn from the wordmark Lane supplied (6 Nov). "Faro" is a lighthouse: the F is a dark stem, an
   amber beam across the top that rises to the right, and a short teal bar. "aro" is drawn as shapes (Inter Display
   ExtraBold, tightened to match the wordmark), so the logo never waits for a font.
   The ink parts are currentColor, set by .faro-brand from --brand-ink, so they turn light in dark mode; the amber and teal
   never change. Amber is the logo's alone: in the app it would read as At risk (docs/design-rules.md).
   public/favicon.svg draws the same mark; keep the two in step. */

export const BRAND = { ink: '#183638', amber: '#F7AE2E', teal: '#21968E', paper: '#F6F5F1' } as const;

/** The F, in a 246 × 209 box: stem, beam, bar. */
const STEM = 'M50 38V201Q50 209 42 209H8Q0 209 0 201V70C0 50 14 36.5 34 34.6L46 33.6Q50 33.3 50 38Z';
const BEAM = 'M66 64H202C226 64 246 45 246 20V8Q246 0 238 1.3L66 28.7Q58 30 58 38V56Q58 64 66 64Z';
const BAR = 'M63 95H123.5A14.5 14.5 0 0 1 123.5 124H63Q58 124 58 119V100Q58 95 63 95Z';
/** "aro", baseline 205, set beside the F. */
const ARO = 'M188.5 207C205.1 207 215.7 201.2 222.8 188.5H223.2V205H260.7V125.6C260.7 99.5 241.9 84.4 207.6 84.4C173.4 84.4 154 99.6 152.4 125.2H188.1C188.9 117.2 195.5 112 206.2 112C216.4 112 222.6 116.8 222.6 123.9V124.4C222.6 131.5 214.9 133.1 193.8 134.9C168.7 136.9 148 145.6 148 172C148 195.5 164.9 207 188.5 207ZM200.2 181.9C190.8 181.9 184.4 177.5 184.4 170.2C184.4 162.5 191.8 158.3 202.1 156.7C211.6 155.2 218.8 153.7 223 151.8V162.5C223 174.2 213 181.9 200.2 181.9Z'
  + 'M272.2 205H310.6V144.5C310.6 127.8 320.1 118.2 333.9 118.2C339.5 118.2 346.3 118.4 349.1 118.5V86.8C346 86.7 342.7 86.6 338.6 86.6C322.8 86.6 314 92.8 309.7 107.8H309.4V87H272.2Z'
  + 'M409.5 207.7C446.5 207.7 471.5 183.4 471.5 146C471.5 108.8 446.5 84.3 409.5 84.3C372.5 84.3 347.4 108.8 347.4 146C347.4 183.4 372.5 207.7 409.5 207.7ZM409.5 177.1C396 177.1 386.3 166 386.3 146C386.3 126.1 396.1 114.9 409.5 114.9C422.9 114.9 432.6 126.1 432.6 146C432.6 166 422.9 177.1 409.5 177.1Z';

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
