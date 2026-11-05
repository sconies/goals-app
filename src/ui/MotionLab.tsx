/* The Motion lab: how a goal's page moves, with a few fun options (Lane, 5 Nov). Opened from the bottom of Settings; as a
   bonus, also by five quick taps on a goal's status shape or the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) anywhere in the app.
   Everything here is kept in this browser with the other appearance choices (src/app/appearance.ts). */
import { useEffect, useState } from 'react';
import { EFFECTS, IMPACT, LANDINGS, PACE, impactWords, paceWords, setAppearance, useAppearance } from '../app/appearance';
import { Sheet } from './bits';
import { MotionPreview } from './MotionPreview';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function MotionLab() {
  const [open, setOpen] = useState(false);
  const look = useAppearance();
  useEffect(() => {
    const show = () => setOpen(true);
    let at = 0;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      at = k === KONAMI[at] ? at + 1 : k === KONAMI[0] ? 1 : 0;
      if (at === KONAMI.length) { at = 0; setOpen(true); }
    };
    window.addEventListener('goals-motion-lab', show);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('goals-motion-lab', show); window.removeEventListener('keydown', key); };
  }, []);
  const changed = look.pace !== PACE.default || look.impact !== IMPACT.default || look.off.length > 0 || look.landing !== 'thump' || look.sound || look.buzz;
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Motion lab">
      <div className="motion-lab motion-settings">
        <p className="hint" style={{ marginTop: 0 }}>How a goal’s page moves when it opens. Kept in this browser.</p>
        <label className="slider-row" htmlFor="lab-pace">
          <span>Speed</span>
          <input id="lab-pace" type="range" min={PACE.min} max={PACE.max} step={PACE.step} value={look.pace} aria-valuetext={paceWords(look.pace)} onChange={(e) => setAppearance({ pace: Number(e.target.value) })} />
          <span className="slider-value">{paceWords(look.pace)}</span>
        </label>
        <label className="slider-row" htmlFor="lab-impact">
          <span>Impact</span>
          <input id="lab-impact" type="range" min={IMPACT.min} max={IMPACT.max} step={IMPACT.step} value={look.impact} aria-valuetext={impactWords(look.impact)} onChange={(e) => setAppearance({ impact: Number(e.target.value) })} />
          <span className="slider-value">{impactWords(look.impact)}</span>
        </label>
        <div className="field">
          <span className="field-label" id="lab-landing">Landing</span>
          <div className="seg" role="group" aria-labelledby="lab-landing">
            {LANDINGS.map(([k, l]) => <button key={k} type="button" aria-pressed={look.landing === k} onClick={() => setAppearance({ landing: k })}>{l}</button>)}
          </div>
        </div>
        <fieldset className="effect-list">
          <legend className="sr">Effects</legend>
          {EFFECTS.map(([k, l]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={!look.off.includes(k)} onChange={(e) => setAppearance({ off: e.target.checked ? look.off.filter((x) => x !== k) : [...look.off, k] })} /> {l}
            </label>
          ))}
          <label className="check"><input type="checkbox" checked={look.sound} onChange={(e) => setAppearance({ sound: e.target.checked })} /> A soft “tock” when it lands</label>
          <label className="check"><input type="checkbox" checked={look.buzz} onChange={(e) => setAppearance({ buzz: e.target.checked })} /> A buzz on your phone when it lands</label>
        </fieldset>
        <MotionPreview pace={look.pace} countOn={!look.off.includes('count')} replayKey={`${look.pace}-${look.impact}-${look.off.join('.')}-${look.landing}`} />
        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
          <button type="button" className="btn sm" onClick={() => { setOpen(false); window.dispatchEvent(new Event('goals-replay')); }}>Replay this page</button>
          {changed && <button type="button" className="btn sm ghost" onClick={() => setAppearance({ pace: PACE.default, impact: IMPACT.default, off: [], landing: 'thump', sound: false, buzz: false })}>Back to the default</button>}
        </div>
        <p className="hint">None of it moves when your device asks for reduced motion.</p>
      </div>
    </Sheet>
  );
}
