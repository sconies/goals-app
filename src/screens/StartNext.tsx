/* Start the next year (cycle-end spec 2.4): a read-back in counts that add up to every goal, then one button. Starting
   prepares the next year; everyone stays in this one until its last day, and Cycles offers Undo until someone uses it. */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { cycleDates, dayWithYear, laterCycle, nextCycleShape } from '../domain/cycle';
import { startPage } from '../domain/startYear';
import { adminsLine } from '../domain/workspaceAttention';
import { BackLink } from '../ui/BackLink';

export function StartNext() {
  const app = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  // Once the next year exists, this page has nothing to do: Cycles says it's ready, with Undo.
  if (laterCycle(app.full.cycles, app.cycle)) return <Navigate to="/workspace/cycles" replace />;
  const page = startPage(app.full, app.cycle, app.today);
  const ended = app.today.toISOString().slice(0, 10) > cycleDates(app.cycle).lastDay;
  const start = async () => {
    setBusy(true);
    try {
      const name = await app.startNextCycle();
      app.toast(ended ? `${name} has started.` : `${name} is ready. It opens on ${dayWithYear(cycleDates(nextCycleShape(app.cycle)).firstDay)}.`, 'success');
      nav('/workspace/cycles');
    } catch { setBusy(false); }
  };
  return (
    <div className="page narrow start-next" data-part="Start the next year">
      <BackLink to="/workspace/cycles" label="Cycles" />
      <div className="page-head">
        <h1 className="title-xl">Start {page.next}</h1>
        <span className="muted">{page.line}</span>
      </div>
      {!page.readBack ? (
        <section className="block calm"><p>{page.whyNot}</p></section>
      ) : (
        <>
          {page.counts.length > 0 && (
            <section className="block" aria-label="What happens to each goal">
              <ul className="read-back">
                {page.counts.map((c) => (
                  <li key={c.says} className="read-back-count">
                    <span className="read-back-n">{c.n}</span>
                    <span className="stack"><strong>{c.says}</strong>{c.sub && <span className="hint">{c.sub}</span>}</span>
                  </li>
                ))}
              </ul>
              <p className="hint">These add up to the {page.readBack.total} goals in {app.cycle.name}.</p>
            </section>
          )}
          <section className="block" aria-labelledby="starts-with">
            <h2 id="starts-with" className="title-m">What {page.next} starts with</h2>
            <ul className="plain-list">
              {page.startsWith.map((x, i) => <li key={i}><strong>{x.bold}</strong>{x.rest}</li>)}
            </ul>
          </section>
          {app.viewer.admin ? (
            <div className="foot-row">
              <Link className="btn ghost big-btn" to="/workspace/cycles">Not yet</Link>
              <button type="button" className="btn primary big-btn" disabled={busy || !page.canStart} onClick={() => void start()}>{busy ? 'Starting…' : `Start ${page.next}`}</button>
            </div>
          ) : (
            <p className="hint">An admin starts {page.next}: {adminsLine(app.snapshot.people)}.</p>
          )}
        </>
      )}
    </div>
  );
}

