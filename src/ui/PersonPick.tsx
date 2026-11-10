/* Choosing who does something: the person search (deep review P2). The person chosen is named with their team; to
   change it, type a name or a team and pick from what's found. Never a list of everyone in the workspace. */
import { useId, useState } from 'react';
import { useApp } from '../app/state';
import { findPeople } from '../domain/people';
import { Avatar } from './bits';

/** `suggest`: people offered first, before anything is typed, each with a note ("you", "who owns this goal"). */
export function PersonPick({ value, onChange, label = 'Who', invalid = false, suggest = [] }: { value: string | null; onChange: (id: string) => void; label?: string; invalid?: boolean; suggest?: { id: string; note: string }[] }) {
  const app = useApp();
  const [q, setQ] = useState('');
  const id = useId();
  const chosen = value ? app.person(value) : undefined;
  const team = (tid: string | null | undefined) => (tid ? app.team(tid)?.name ?? '' : '');
  const found = findPeople(app.snapshot.people, q, (t) => team(t));
  return (
    <div className="field person-pick">
      <span className="field-label" id={`${id}-l`}>{label}</span>
      {chosen && <span className="person-chosen"><Avatar p={chosen} size="sm" /><span className="strong">{chosen.name}</span>{team(chosen.teamId) && <span className="hint">{team(chosen.teamId)}</span>}</span>}
      <input className={'input' + (invalid ? ' invalid' : '')} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={chosen ? 'Someone else? Find by name or team' : 'Find a person by name or team'} aria-label={`${label}: find a person by name or team`} aria-describedby={`${id}-l`} />
      {!q.trim() && !chosen && suggest.length > 0 && (
        <div className="optlist compact-opts" role="group" aria-label="Suggested">{suggest.map((x) => { const p = app.person(x.id); return p && (
          <button key={p.id} type="button" role="radio" className="opt" aria-checked={false} onClick={() => onChange(p.id)}>
            <span className="row" style={{ gap: 'var(--s2)' }}><Avatar p={p} size="sm" /><span className="stack" style={{ gap: 0, minWidth: 0 }}><span>{p.name}{x.note ? `, ${x.note}` : ''}</span>{team(p.teamId) && <span className="hint">{team(p.teamId)}</span>}</span></span>
          </button>
        ); })}</div>
      )}
      {q.trim() && (found.length
        ? <div className="optlist compact-opts" role="group" aria-label="People found">{found.map((p) => (
            <button key={p.id} type="button" role="radio" className="opt" aria-checked={p.id === value} onClick={() => { onChange(p.id); setQ(''); }}>
              <span className="row" style={{ gap: 'var(--s2)' }}><Avatar p={p} size="sm" /><span className="stack" style={{ gap: 0, minWidth: 0 }}><span>{p.name}</span>{team(p.teamId) && <span className="hint">{team(p.teamId)}</span>}</span></span>
            </button>
          ))}</div>
        : <span className="hint">Nobody here matches “{q.trim()}”.</span>)}
    </div>
  );
}
