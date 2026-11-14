/* The number step's block (NR2, docs/design/round-4/readings/spec.md 2.1 and 2.2): the check-in's place
   `checkin.number`, drawn when the goal is measured by a metric a registered source reads. The source is asked once
   when the step opens (never on Home); rule 1 (rulesReading.ts) says which state the step is in, and each state draws
   its row of 2.1's table. A reading is a suggestion in the field, never a check-in: the owner confirms it by name, or
   types their own and says why it differs. What is recorded goes back to the step (`onReading`), and the engine checks
   it again (rule 3). Loaded with the check-in, in the module's own chunk. */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/state';
import type { NumberStep, PlaceProps } from '../../core/app';
import { parseNumber, previousFor } from '../../domain/checkin';
import { checkInsFor } from '../../domain/status';
import { fmt } from '../../domain/format';
import { MIN_CORRECT_REASON } from '../../domain/checkin';
import { READING_WHY } from '../../domain/reading';
import { filledAt, readWhen } from '../../domain/readingWords';
import type { CheckInReading, ReadingWhyKind } from '../../domain/types';
import { WarnMark } from '../../ui/bits';
import { CheckBlock } from '../../ui/Levels';
import { measureOf } from './rules';
import { askSource, readingState, recordReading, sameAt, type Asked } from './rulesReading';
import { sliceOf } from './source';
import { demoBehindWeeks, sourcesFrom } from './sources';
import './metrics.css';

const DAY = 86_400_000;
const onDate = (at: string) => new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
/** The field, for "Type a different number". */
const focusField = () => { const f = document.querySelector<HTMLInputElement>('input[aria-label="This week’s value"]'); f?.focus(); f?.select(); };

export function CheckInNumber(p: PlaceProps['checkin.number']) {
  const app = useApp();
  const goal = p.goal;
  const m = goal.kind === 'milestone' ? null : measureOf(app.snapshot, goal);
  // What asking gave, and whether the source reads the whole company's number (for no-slice's words).
  const [asked, setAsked] = useState<(Asked & { company?: boolean }) | null>(null);
  const [tries, setTries] = useState(0);
  const [why, setWhy] = useState<ReadingWhyKind | null>(null);
  const [more, setMore] = useState('');
  const [jumpAnswer, setJumpAnswer] = useState<'yes' | 'no' | null>(null);
  const filled = useRef(false);
  const linkKey = m ? `${m.metric.id}|${m.link.teamId ?? ''}|${m.part}` : '';

  // Asked once when the step opens, and again on "Try again".
  useEffect(() => {
    if (!m) return;
    let live = true;
    void (async () => {
      const seed = await app.exampleSeed().catch(() => null);
      const sources = sourcesFrom(seed, app.cycle, demoBehindWeeks());
      const a = await askSource(sources, m.metric, sliceOf(m.link), app.today);
      const company = !!sources.find((x) => x.name === a.source)?.reads(m.metric, { teamId: null, part: '' });
      if (live) setAsked({ ...a, company });
    })();
    return () => { live = false; };
  }, [linkKey, tries]); // eslint-disable-line react-hooks/exhaustive-deps

  const source = asked?.source ?? null;
  const raw = asked && source ? asked.reading : null;
  // The goal's places, as the engine judges (review of #437, medium 4), never the metric's.
  const decimals = goal.kind === 'milestone' ? 0 : goal.decimals;
  // The reading as the field holds it, at those places (medium 6).
  const fill = (v: number) => p.setValue(filledAt(v, decimals));
  const typed = p.value.trim() ? parseNumber(p.value) : null;
  const state = source && m && goal.kind !== 'milestone' ? readingState(raw, p.lastReading, p.last?.value ?? null, app.today, typed, decimals) : null;
  const reading = raw && typeof raw === 'object' ? raw : null;

  // The field opens with the reading in it (fresh, or a jump to confirm), unless the owner's draft already has a number.
  useEffect(() => {
    if (filled.current || !reading || (state !== 'fresh' && state !== 'jump')) return;
    filled.current = true;
    if (!p.value.trim()) fill(reading.value);
  }, [state, reading?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (v: number) => (goal.kind === 'milestone' ? String(v) : fmt(v, goal));
  const differs = !!reading && typed != null && !sameAt(typed, reading.value, decimals);
  // A jump answered: yes is a confirmation, then typing another number is a change like any other.
  const shown = state === 'jump' && jumpAnswer ? (differs ? 'changed' : jumpAnswer === 'yes' ? 'fresh' : 'typing') : state;
  const whyOk = !!why && (why !== 'else' || more.trim().length >= MIN_CORRECT_REASON);

  // What the step's primary does, and what the check-in records: said whenever either changes.
  const step: NumberStep | null = !state ? null
    : shown === 'fresh' ? (typed != null && reading ? { label: `Confirm ${num(reading.value)}` } : {})
    : shown === 'changed' ? { label: `Use ${num(typed!)}`, waits: !whyOk }
    : shown === 'same' ? (typed == null && p.onSkip ? { label: 'No new number this week', run: p.onSkip } : {})
    : shown === 'jump' ? { waits: true }
    : {};
  const record: CheckInReading | null = !reading || !source ? null
    : shown === 'fresh' && typed != null ? recordReading(source, reading, typed, decimals)
    : shown === 'changed' && whyOk ? recordReading(source, reading, typed, decimals, { kind: why!, ...(more.trim() ? { text: more.trim() } : {}) })
    : null;
  const stepKey = JSON.stringify(step && { label: step.label, waits: step.waits, run: !!step.run });
  const recordKey = JSON.stringify(record);
  const stepNow = useRef(step);
  stepNow.current = step;
  useEffect(() => { p.onStep(stepNow.current); }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { p.onReading(record); }, [recordKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Gone (another goal, or the module switched off): the step is as it always was.
  useEffect(() => () => { p.onStep(null); p.onReading(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !source || !m) return null;
  const when = reading ? readWhen(reading.at, app.today) : '';
  const lastLine = p.last ? `Week ${p.last.week}: ${num(p.last.value)}.` : 'First check-in.';
  const skip = p.onSkip && <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={p.onSkip}>No new number this week</button>;

  let body: React.ReactNode;
  if (shown === 'fresh' || shown === 'typing') {
    body = (
      <>
        <p className="small"><strong>From {source}</strong>, read {when}.</p>
        <p className="hint">{p.last ? `${lastLine} ` : ''}Change the number if it’s wrong, and you’ll be asked why. You still say what changed: that is the next step.</p>
        {reading && typed == null && <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={() => fill(reading.value)}>Put {num(reading.value)} back</button>}
        {skip}
      </>
    );
  } else if (shown === 'changed' && reading) {
    body = (
      <>
        <p className="small">You typed {num(typed!)}. <strong>{source}</strong> said {num(reading.value)}, read {when}. <button type="button" className="linkish" onClick={() => fill(reading.value)}>Put {num(reading.value)} back</button></p>
        <div className="stack reading-why" style={{ gap: 'var(--s2)' }}>
          <h3 className="qtitle sm" id="reading-why">Why is it different?</h3>
          <div className="optlist ci-opts" role="radiogroup" aria-labelledby="reading-why">
            {READING_WHY.map(([k, l]) => <button key={k} type="button" role="radio" className="opt" aria-checked={why === k} onClick={() => setWhy(k)}><span>{l}</span></button>)}
          </div>
          <label className="field">
            <span className="field-label">Say more <span className="muted" style={{ fontWeight: 400 }}>{why === 'else' ? `at least ${MIN_CORRECT_REASON} characters` : 'optional, unless “Something else”'}</span></span>
            <input className={'input' + (p.tried && why === 'else' && !whyOk ? ' invalid' : '')} value={more} onChange={(e) => setMore(e.target.value)} maxLength={500} />
          </label>
          {p.tried && !whyOk && <span className="hint tone-off" role="alert">{!why ? 'Choose why it’s different.' : `Say more, in at least ${MIN_CORRECT_REASON} characters.`}</span>}
          <p className="hint">Kept with this check-in, beside what {source} said. It doesn’t change the goal’s status and nobody is told.</p>
        </div>
        {skip}
      </>
    );
  } else if (shown === 'same' && reading) {
    body = (
      <>
        <p className="small">No new reading since your last check-in: {source} still says {num(reading.value)}, read {when}.</p>
        {p.last && <p className="hint">{lastLine}</p>}
        {typed == null && <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={focusField}>Type a different number</button>}
      </>
    );
  } else if (shown === 'old' && reading) {
    const days = Math.floor((app.today.getTime() - Date.parse(reading.at)) / DAY);
    body = (
      <>
        <p className="small reading-old"><WarnMark /> {source} last read this on {onDate(reading.at)}, {days} days ago.</p>
        <p className="hint">That is too old to fill in. Type this week’s number, or say there isn’t one. {lastLine}</p>
        {skip}
      </>
    );
  } else if (shown === 'no-slice') {
    const what = m.link.teamId != null ? `${app.team(m.link.teamId)?.name ?? 'this team'}${m.part ? ` · ${m.part}` : ''}` : `the whole company${m.part ? ` · ${m.part}` : ''}`;
    body = (
      <>
        <p className="small">{source} measures this for {asked?.company ? 'the whole company' : 'other teams and parts'}, not for {what} on its own, so it isn’t filled in.</p>
        <p className="hint">{goal.source ? `Where to get it: ${goal.source}. ` : ''}{lastLine}</p>
      </>
    );
  } else if (shown === 'missing') {
    body = <><p className="small">{source} has no number for this yet. Type this week’s number.</p><p className="hint">{lastLine}</p></>;
  } else if (shown === 'unreachable') {
    body = (
      <>
        <p className="small">{source} couldn’t be reached just now. Type the number, or try again.</p>
        <p className="hint">{lastLine}</p>
        <button type="button" className="linkish tap small" style={{ alignSelf: 'flex-start' }} onClick={() => { setAsked(null); setTries((n) => n + 1); }}>Try again</button>
      </>
    );
  } else if (shown === 'jump' && reading && p.last) {
    const bigger = Math.abs(reading.value) > Math.abs(p.last.value);
    body = (
      <CheckBlock id="reading-jump" question={`${source} says ${num(reading.value)}. That is ${bigger ? 'ten times' : 'a tenth of'} week ${p.last.week}’s ${num(p.last.value)}. Is it right?`}
        yes={`Yes, confirm ${num(reading.value)}`} no="Type a different number" alert={p.tried}
        onYes={() => { setJumpAnswer('yes'); fill(reading.value); }} onNo={() => { setJumpAnswer('no'); p.setValue(''); setTimeout(focusField, 0); }} />
    );
  } else {
    body = <p className="hint">{lastLine}</p>;
  }
  return <div id="value-hint" className="stack ci-reading-block" style={{ gap: 'var(--s2)' }} data-reading={shown ?? ''}>{body}</div>;
}


/** The one-table check-in (place checkin.table, NR 2.3): the readings it fills in, asked once when the table opens, by
    goal. Only a fresh reading for a goal not yet checked in this week is offered there; any other state leaves the cell
    to the owner, as on the step. */
export function CheckInTableReadings({ goals, week, onReadings }: PlaceProps['checkin.table']) {
  const app = useApp();
  const key = goals.map((g) => g.id).join(',');
  useEffect(() => {
    let live = true;
    void (async () => {
      const sources = sourcesFrom(await app.exampleSeed().catch(() => null), app.cycle, demoBehindWeeks());
      if (!sources.length) return;
      const out: Record<string, CheckInReading> = {};
      for (const g of goals) {
        const m = g.kind === 'milestone' ? null : measureOf(app.snapshot, g);
        if (!m) continue;
        const a = await askSource(sources, m.metric, sliceOf(m.link), app.today);
        if (!a.source || !a.reading || typeof a.reading !== 'object') continue;
        const own = checkInsFor(g, app.snapshot.checkIns);
        // A goal already checked in this week isn't filled in again: the table would post a second check-in for it.
        if (own.some((c) => c.week === week)) continue;
        const lastValue = previousFor(own, week).number?.value ?? null;
        if (readingState(a.reading, own.at(-1)?.reading ?? null, lastValue, app.today, null, g.kind === 'milestone' ? 0 : g.decimals) === 'fresh') out[g.id] = { source: a.source, value: a.reading.value, at: a.reading.at };
      }
      if (live) onReadings(out);
    })();
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
