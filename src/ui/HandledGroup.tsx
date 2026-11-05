/* Goals being handled: behind, but someone has looked since the latest check-in and nothing new has come up. Used on
   Watching, Home and the Goals screen's Needs attention. */
import { useState } from 'react';
import type { GoalAttention } from '../domain/attention';
import { GoalRow } from './goalRows';
import { Icon } from './Icon';

/**
 * The status (shape and word) and what's in hand, e.g. "Action: Maya, due week 47". On Home it starts folded away.
 */
export function HandledGroup({ list, folded }: { list: GoalAttention[]; folded?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const rows = <ul className="tree handled-list">{list.map((a) => <li key={a.goal.id}><HandledRow a={a} /></li>)}</ul>;
  if (folded) {
    // The rows are drawn only once it's opened, so nothing hidden sits in the page.
    return (
      <details className="disclose handled-fold" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><Icon name="chevron-down" size={14} />Being handled · {list.length}<span className="handled-fold-hint">· behind, but someone has looked since the latest check-in</span></summary>
        {open && rows}
      </details>
    );
  }
  return (
    <section className="block handled-block">
      <div className="stack" style={{ gap: 'var(--s1)' }}>
        <h2 className="block-title">Being handled <span className="hint">· {list.length}</span></h2>
        <span className="hint">Behind, but someone has looked since the latest check-in. Back under Needs attention when there’s a new check-in or a new warning.</span>
      </div>
      {rows}
    </section>
  );
}

/** A goal being handled: the usual row, with what's in hand as its reason. */
export function HandledRow({ a }: { a: GoalAttention }) {
  const h = a.handled!;
  const flag = a.flags.find((f) => f.kind !== 'due');
  const said = h.said || flag?.detail || '';
  return (
    <GoalRow g={a.goal} className="handled-row" whyTitle={`${h.text}${said ? '. ' + said : ''}`}
      why={<><span className="handled-what">{h.text}</span>{said ? ` · ${said}` : ''}</>} />
  );
}
