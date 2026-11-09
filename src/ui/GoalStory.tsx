/* A goal's story where goals are listed: why it's off, the recovery plan, by when, what's needed and any warnings;
   and its result in words. Used by the Table, Board and Cards layouts and the map's side panel. */
import { Fragment, useState } from 'react';
import { RESULT_MEANING, RESULT_TEXT } from '../domain/story';
import type { GoalSummary } from '../domain/summary';
import { WarnMark } from './bits';
import { FLAG } from '../domain/vocabulary';

/** Text in which "week 43" and "week-43" never break inside; a line breaks at a space or after "·" instead. */
export function Keep({ text }: { text: string }) {
  const parts = text.split(/(week[- ]\d+)/);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="nb">{p}</span> : p))}</>;
}

/** A goal's warnings, with the ones that are only history now set apart: a quarter not met, while on track or done. */
export function splitHistory(s: GoalSummary): { now: string[]; past: string[] } {
  const st = s.story;
  const settled = s.status === 'on' || s.status === 'done';
  const now: string[] = [], past: string[] = [];
  st.warnings.forEach((w, i) => (settled && st.flags[i] === 'missed-quarter' ? past : now).push(w));
  return { now, past };
}

export const hasStory = (s: GoalSummary) => ['off', 'risk', 'stale'].includes(s.status) || s.story.warnings.length > 0;

/** Why it's off, what the owner will do, by when, what they need, and any warnings. */
/**
 * A goal's story where it's listed. Full: why, the recovery plan, by when, what's needed, and every warning.
 * Brief (board and cards, where goals sit side by side): why in two lines, by when, and the first warning with a count
 * of the rest. The goal's page always has the whole story.
 */
export function StoryLines({ s, compact, brief }: { s: GoalSummary; compact?: boolean; brief?: boolean }) {
  const st = s.story;
  const full: [string, string][] = s.status === 'stale'
    ? [['Last heard', st.since ?? '']]
    : ['off', 'risk'].includes(s.status)
      ? [['Why', st.why ?? 'Not given'], ['Recovery plan', st.doing ?? 'Not given'], ['Owner’s date', st.byWhen?.replace(/^Owner’s date: b/, 'B') ?? 'No date given'], ...(st.needs ? [['Needs', st.needs] as [string, string]] : [])]
      : [];
  const rows = brief ? full.filter(([k]) => k === 'Why' || k === 'Owner’s date' || k === 'Last heard') : full;
  // On a goal on track or done now, a quarter it didn't meet is history, said quietly after any warning (review F08).
  const { now: live, past } = splitHistory(s);
  const warnings = brief ? live.slice(0, 1) : live;
  const more = live.length - warnings.length;
  return (
    <div className={'story' + (compact ? ' compact' : '') + (brief ? ' brief' : '')}>
      {/* Brief, a clamped line keeps the whole of it as a tooltip. */}
      {rows.length > 0 && <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className={v === 'Not given' || v === 'No date given' ? 'tone-off' : undefined} title={brief && k === 'Why' ? v : undefined}><Keep text={v} /></dd></Fragment>)}</dl>}
      {warnings.map((w) => <span key={w} className="story-warn"><WarnMark />{w}</span>)}
      {more > 0 && <span className="hint">and {more} more {more === 1 ? 'warning' : 'warnings'} on the goal</span>}
      {!(brief && warnings.length) && past.map((w) => <span key={w} className="story-history hint">{w}</span>)}
    </div>
  );
}

/**
 * The story in a table: one line (what's needed, why, by when, how many warnings), so rows stay comparable,
 * with Details to open the whole story in place (Senior UX review, 2 Nov).
 */
export function TableStory({ s }: { s: GoalSummary }) {
  const [open, setOpen] = useState(false);
  const st = s.story;
  const { now: live, past } = splitHistory(s);
  const n = live.length;
  const parts = s.status === 'stale'
    ? [st.since ?? 'No check-in for two weeks or more']
    : [
      ...(st.needs ? [FLAG.decision.label] : []),
      ...(['off', 'risk'].includes(s.status) ? [st.why ? `Why: ${st.why}` : 'No reason given', st.byWhen ?? 'No date given'] : []),
    ];
  // Warnings by name, not a bare count (demo review, 8 Nov): the first one's own words, then how many more.
  const head = (w: string) => w.split(/(?<=\w)[.:—]\s/)[0]!.replace(/\.$/, '');
  if (n) parts.push(n === 1 ? head(live[0]!) : `${head(live[0]!)} and ${n - 1} more ${n === 2 ? 'warning' : 'warnings'}`);
  else if (past.length) parts.push(head(past[0]!));
  return (
    <div className="table-story">
      {open ? <StoryLines s={s} compact /> : <span className="table-story-line small" title={[...parts.slice(0, n ? -1 : undefined), ...st.warnings].join(' · ')}>{parts.join(' · ')}</span>}
      <button type="button" className="linkish small table-story-toggle" aria-expanded={open} aria-label={`${open ? 'Less' : 'Details'}: the story of ${s.goal.title}`} onClick={() => setOpen((v) => !v)}>{open ? 'Less' : 'Details'}</button>
    </div>
  );
}

export function ResultTag({ s }: { s: GoalSummary }) {
  const r = s.story.result;
  if (!r) return null;
  return <span className={'result-tag result-' + r.kind} title={RESULT_MEANING[r.kind]}>{RESULT_TEXT[r.kind]}{r.kind === 'missed' ? ` · due week ${r.dueWeek}` : r.kind === 'late' ? ` · week ${r.week}, due ${r.dueWeek}` : ''}</span>;
}
