/* The Board layout: a lane per status, worst first; the healthy lanes show their first few cards and a count. */
import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { LABEL } from '../domain/status';
import { type GoalSummary } from '../domain/summary';
import { SHORT_MEANING } from '../domain/story';
import { isEveryday, levelRank } from '../domain/levels';
import type { DisplayStatus } from '../domain/types';
import { LevelTag, StatusShape, StatusWord, TitleTell } from '../ui/bits';
import { rhythmOf } from '../domain/thresholds';
import { Icon } from '../ui/Icon';
import { ATTENTION } from '../domain/vocabulary';
import { waitingOnDecision } from '../domain/attention';
import { hasStory, Keep, ResultTag, StoryLines } from '../ui/GoalStory';
import { useSummaries, type ViewGroup } from './GoalViews';

/** A lane per status, worst first, each titled with its own word: No check-in yet and Not started are lanes of their own. */
const COLUMNS: { key: string; title: string; statuses: DisplayStatus[]; always: boolean }[] = (['off', 'risk', 'stale', 'none', 'planned', 'on', 'done'] as const).map((k) => ({
  key: k, title: LABEL[k], statuses: [k], always: k === 'off' || k === 'risk' || k === 'stale' || k === 'on',
}));

/** How many cards a healthy lane shows before Show all: room for a team's goals, not 3 or 4 of 60 (backlog GP, 9 Nov). */
export const HEALTHY_SHOWN = 8;

export function GoalBoard({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  const all = [...sums.values()];
  // Within a lane: the higher goals first (the north star leads), then those waiting on a decision, then by name.
  const order = (a: GoalSummary, b: GoalSummary) => levelRank(app.cycle, a.goal.level) - levelRank(app.cycle, b.goal.level) || Number(waitingOnDecision(b.attention)) - Number(waitingOnDecision(a.attention)) || a.goal.title.localeCompare(b.goal.title);
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
        const items = healthy && !shown.has(c.key) ? c.items.slice(0, HEALTHY_SHOWN) : c.items;
        return (
        <section key={c.key} className="board-col" aria-label={`${c.title}, ${c.items.length}`}>
          <h2 className={'board-head tone-' + (c.key === 'waiting' ? 'stale' : c.key)}><StatusShape k={c.statuses[0]!} />{c.title}<span className="board-count tnum">{c.items.length}</span></h2>
          <span className="hint board-meaning">{SHORT_MEANING[c.statuses[0]!][0]!.toUpperCase() + SHORT_MEANING[c.statuses[0]!].slice(1)}</span>
          {c.items.length === 0 && <span className="hint board-empty">None</span>}
          {items.map((s) => (
            <Link key={s.goal.id} to={'/goals/' + s.goal.id} className="board-card" data-tone={s.status}>
              {/* The card's own status first, a shape and its word (D2): on a phone the lanes stack, and a card scrolled
                  past its lane's heading still says where it stands. The level sits right on the same row. */}
              <span className="board-top">
                <StatusWord k={s.status} className="board-status" />
                {/* With no set rhythm, a status not from this week says which (FT1). */}
                {!rhythmOf(app.cycle) && s.asOfWeek != null && s.status !== 'done' && <span className="hint board-asof">as of week {s.asOfWeek}</span>}
                {!isEveryday(app.cycle, s.goal.level) && <span className="board-level"><LevelTag level={s.goal.level} /></span>}
              </span>
              <span className="board-title">{s.goal.title}</span><TitleTell goal={s.goal} />
              <span className="hint ellipsis">{s.owner} · {s.team}</span>
              {/* Which goal it feeds, so a card makes sense away from its tree (backlog GP, 9 Nov). */}
              {s.feedsInto && <span className="hint ellipsis board-parent" title={`Feeds into ${s.feedsInto}`}>Feeds into {s.feedsInto}</span>}
              <ResultTag s={s} />
              {/* Being handled sits in its status's lane, so the card says so: a shape and the word, and what's in hand (outside review, 10 Nov, U14). */}
              {s.attention.handled && <span className="board-handled small" title={s.attention.handled.text}><Icon name="check-circle" size={13} />{ATTENTION.handled.label}<span className="muted"> · {s.attention.handled.text}</span></span>}
              {/* The same evidence on every card: the number and its gap, then the owner's account when there is one. */}
              <span className="small muted">{s.now}{s.gap !== s.now && <> · <Keep text={s.gap} /></>}</span>
              {hasStory(s) && <StoryLines s={s} compact brief />}
            </Link>
          ))}
          {healthy && c.items.length > HEALTHY_SHOWN && (
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
