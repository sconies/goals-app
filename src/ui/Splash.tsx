/* Faro's splash (backlog I, Lane, 8 Nov): "the two horizontal bars appear to be lights from a lighthouse that swing
   around in a 3D manner, resting in their final spot in the logo. After they rest there, the 'aro' is drawn in."

   Once per app launch: the first load in a browser session, which is also every launch from the home screen. Never on
   navigation. It lies over the app, which loads and draws behind it, so nothing waits for it and nothing shifts when it
   goes; a tap, a click or any key ends it at once.
   The stem stands first. The amber beam is its light: it starts behind the stem, pointing the other way, and swings half a
   turn about it in 3D (rotateY in perspective, glowing); halfway round it points straight at you and the screen flashes
   once with its light; then it settles into the F (Lane's refinement, 8 Nov). Then the teal bar is drawn out of the
   stem and "aro" is drawn in, outline first, then filled. About 1.5 s in all.
   With reduced motion the whole logo simply fades in (200 ms), holds a moment and fades out: nothing turns or draws.
   Animated with the Web Animations API, so the app-wide reduced-motion rule (styles.css) doesn't cut it short and it
   can be finished from code. Automated browsers (the evals) never see it unless they ask (window.__faroSplash). */
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ARO_LETTERS, BAR, BEAM, BRAND, STEM } from './brandPaths';
import '../styles/splash.css';

export const SPLASH_SEEN = 'faro-splash-seen';

/** Timings in ms. The beam and bar sweep, then "aro" draws, then the splash fades away. */
export const SPLASH_TIMING = { sweep: 760, flashAt: 0.4, flash: 300, barAt: 700, bar: 260, drawAt: 760, draw: 400, letterGap: 70, fillAt: 1040, fill: 220, outAt: 1320, out: 220, skip: 140, reduced: { in: 200, hold: 350, out: 200 } } as const;

interface Env { webdriver: boolean; forced: boolean; storage: Pick<Storage, 'getItem' | 'setItem'> | null }

/** Whether this load shows the splash: not seen yet in this browser session, and not an automated browser unless it asks. */
export function shouldShowSplash(env: Env): boolean {
  if (env.webdriver && !env.forced) return false;
  try { return !env.storage?.getItem(SPLASH_SEEN); } catch { return true; }
}

function env(): Env {
  let storage: Storage | null = null;
  try { storage = window.sessionStorage; } catch { /* blocked: show it, once per load */ }
  return { webdriver: !!navigator.webdriver, forced: !!(window as unknown as { __faroSplash?: boolean }).__faroSplash, storage };
}

/** Called once by main.tsx as the app starts: shows the splash if this is a launch, beside (not inside) the app's root. */
export function startSplash() {
  const e = env();
  if (!shouldShowSplash(e)) return;
  try { e.storage?.setItem(SPLASH_SEEN, '1'); } catch { /* fine */ }
  const host = document.createElement('div');
  host.className = 'faro-splash-host';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<Splash onDone={() => { root.unmount(); host.remove(); }} />);
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Splash({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const T = SPLASH_TIMING;
    const q = (s: string) => [...el.querySelectorAll<SVGElement | HTMLElement>(s)];
    const parts: Animation[] = [];
    const play = (target: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => { if (typeof target.animate === 'function') parts.push(target.animate(frames, { fill: 'both', ...o })); };
    let out: Animation | null = null;
    let skipped = false;
    /** Fade the splash away after `delay`, then remove it. Called again (by a skip), it fades now instead. */
    const leave = (duration: number, delay = 0) => {
      out?.cancel();
      if (typeof el.animate !== 'function') { onDone(); return; }
      if (!delay) el.classList.add('is-leaving');
      out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration, delay, fill: 'forwards', easing: 'ease-in' });
      out.onfinish = onDone;
      if (delay) setTimeout(() => el.classList.add('is-leaving'), delay);
    };

    if (reducedMotion()) {
      el.classList.add('is-still');
      play(el.querySelector('.faro-splash-logo')!, [{ opacity: 0 }, { opacity: 1 }], { duration: T.reduced.in, easing: 'ease-out' });
      leave(T.reduced.out, T.reduced.in + T.reduced.hold);
    } else {
      play(el.querySelector('.sp-stem')!, [{ opacity: 0, transform: 'translateY(6%)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      // The beam: a lighthouse's light. It starts behind the stem, pointing the other way, and swings half a turn about
      // it; halfway round it points straight at you and the screen flashes once; then it settles into the F.
      const glow = (px: number, b: number) => `drop-shadow(0 0 ${px}px ${BRAND.amber}) brightness(${b})`;
      const turn = (deg: number) => `perspective(520px) rotateY(${deg}deg)`;
      play(el.querySelector('.sp-beam')!, [
        { opacity: 0, transform: turn(-180), filter: glow(0, 1.3), easing: 'ease-out' },
        { opacity: 1, offset: 0.12, transform: turn(-165), filter: glow(16, 1.3), easing: 'ease-in' },
        { opacity: 1, offset: T.flashAt, transform: turn(-90), filter: glow(22, 1.4), easing: 'cubic-bezier(.15,.7,.3,1)' },
        { opacity: 1, offset: 0.86, transform: turn(7), filter: glow(5, 1.05), easing: 'ease-in-out' },
        { opacity: 1, transform: turn(0), filter: glow(0, 1) },
      ], { duration: T.sweep, delay: 80 });
      play(el.querySelector('.sp-flash')!, [{ opacity: 0 }, { opacity: 0.9, offset: 0.35 }, { opacity: 0 }], { duration: T.flash, delay: 80 + T.sweep * T.flashAt - T.flash * 0.35, easing: 'ease-out' });
      // Then the teal bar is drawn out of the stem.
      play(el.querySelector('.sp-bar')!, [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: T.bar, delay: T.barAt, easing: 'cubic-bezier(.3,.7,.2,1)' });
      // "aro": each letter's outline drawn, a little apart, then the letters filled.
      q('.sp-letter').forEach((letter, i) => {
        play(letter, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: T.draw, delay: T.drawAt + i * T.letterGap, easing: 'cubic-bezier(.4,0,.2,1)' });
        play(letter, [{ fillOpacity: 0 }, { fillOpacity: 1 }], { duration: T.fill, delay: T.fillAt + i * (T.letterGap / 2), easing: 'ease-out' });
      });
      leave(T.out, T.outAt);
    }

    // A tap, a click or any key ends it now.
    const skip = () => {
      if (skipped) return;
      skipped = true;
      for (const a of parts) a.finish();
      leave(T.skip);
    };
    el.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip, true);
    return () => {
      el.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip, true);
      for (const a of parts) a.cancel();
      out?.cancel();
    };
  }, [onDone]);

  const box = { viewBox: '0 0 472 210', 'aria-hidden': true as const, focusable: 'false' as const };
  return (
    <div className="faro-splash" ref={ref} data-testid="faro-splash">
      <div className="faro-splash-logo">
        <div className="sp-flash" />
        <svg className="sp-stem" {...box}><path d={STEM} fill="currentColor" /></svg>
        <svg className="sp-light sp-beam" {...box}><path d={BEAM} fill={BRAND.amber} /></svg>
        <svg className="sp-bar" {...box}><path d={BAR} fill={BRAND.teal} /></svg>
        <svg className="sp-aro" {...box}>{ARO_LETTERS.map((d, i) => <path key={i} className="sp-letter" d={d} pathLength={1} />)}</svg>
      </div>
    </div>
  );
}
