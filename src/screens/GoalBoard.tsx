/* The Board layout: a lane per status, worst first; the healthy lanes show a few cards and a count. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { LABEL } from '../domain/status';
import { type GoalSummary } from '../domain/summary';
import { SHORT_MEANING } from '../domain/story';
import { LEVELS } from '../domain/query';
import type { DisplayStatus } from '../domain/types';
import { LevelTag, StatusShape, TitleTell } from '../ui/bits';
import { hasStory, Keep, ResultTag, StoryLines } from '../ui/GoalStory';
import { useSummaries, type ViewGroup } from './GoalViews';

/** A lane per status, worst first, each titled with its own word: No check-in yet and Not started are lanes of their own. */
const COLUMNS: { key: string; title: string; statuses: DisplayStatus[]; always: boolean }[] = (['off', 'risk', 'stale', 'none', 'planned', 'on', 'done'] as const).map((k) => ({
  key: k, title: LABEL[k], statuses: [k], always: k === 'off' || k === 'risk' || k === 'stale' || k === 'on',
}));

export function GoalBoard({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  const all = [...sums.values()];
  // Within a lane: the higher goals first (the north star leads), then those waiting on a decision, then by name.
  const order = (a: GoalSummary, b: GoalSummary) => LEVELS.indexOf(a.goal.level) - LEVELS.indexOf(b.goal.level) || Number(!!b.story.needs) - Number(!!a.story.needs) || a.goal.title.localeCompare(b.goal.title);
  // Filtered, an empty lane is noise: only the lanes with goals in them (round 3 and visual review 2).
  const app = useApp();
  const filtered = all.length < app.snapshot.goals.length;
  const cols = COLUMNS.map((c) => ({ ...c, items: all.filter((s) => c.statuses.includes(s.status)).sort(order) })).filter((c) => c.items.length || (c.always && !filtered));
  const [shown, setShown] = useState<Set<string>>(new Set());
  return (
    <div className="board">
      {cols.map((c) => {
        // Healthy lanes show a few cards and a count; the exceptions show everything.
        const healthy = c.key === 'on' || c.key === 'done';
        const items = healthy && !shown.has(c.key) ? c.items.slice(0, 3) : c.items;
        return (
        <section key={c.key} className="board-col" aria-label={`${c.title}, ${c.items.length}`}>
          <h2 className={'board-head tone-' + (c.key === 'waiting' ? 'stale' : c.key)}><StatusShape k={c.statuses[0]!} />{c.title}<span className="board-count tnum">{c.items.length}</span></h2>
          <span className="hint board-meaning">{SHORT_MEANING[c.statuses[0]!][0]!.toUpperCase() + SHORT_MEANING[c.statuses[0]!].slice(1)}</span>
          {c.items.length === 0 && <span className="hint board-empty">None</span>}
          {items.map((s) => (
            <Link key={s.goal.id} to={'/goals/' + s.goal.id} className="board-card" data-tone={s.status}>
              {/* The level on a short row of its own, right-aligned as on Cards; no row when the goal is a team goal. */}
              {s.goal.level !== 'team' && <span className="board-level"><LevelTag level={s.goal.level} /></span>}
              <span className="board-title">{s.goal.title}</span><TitleTell goal={s.goal} />
              <span className="hint ellipsis">{s.owner} · {s.team}</span>
              <ResultTag s={s} />
              {/* The same evidence on every card: the number and its gap, then the owner's account when there is one. */}
              <span className="small muted">{s.now}{s.gap !== s.now && <> · <Keep text={s.gap} /></>}</span>
              {hasStory(s) && <StoryLines s={s} compact brief />}
            </Link>
          ))}
          {healthy && c.items.length > 3 && (
            <button type="button" className="btn ghost sm board-more" aria-expanded={items.length === c.items.length}
              onClick={() => setShown((v) => { const n = new Set(v); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}>
              {items.length < c.items.length ? `Show all ${c.items.length}` : 'Show fewer'}
            </button>
          )}
        </section>
        );
      })}
    </div>
  );
}
