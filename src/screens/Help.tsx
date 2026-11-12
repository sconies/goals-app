/* Help: what everything does (the guide, src/help/guide.ts) and what's new (src/help/whatsNew.ts).
   /help lists the articles by section with a search; /help/:id is one article; /whats-new is every release.
   The small Help link at the foot of every page and the line on Home after a release are in src/ui/HelpLinks.tsx, which
   the first download carries without the guide's text; these screens load when first opened (src/App.tsx). */
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { historyStep } from '../domain/find';
import { CountLine, ListSearch, NoneFound } from '../ui/ListBar';
import { ARTICLES, GROUPS, articleById as anyArticle, articleWords, searchGuide, type Article } from '../help/guide';
import { nearMiss } from '../domain/find';
import { useModules } from '../core/app';

/** A module's articles show only while it's on here (src/core/app.tsx); the core's always do. */
function useShown() {
  const { on } = useModules();
  return (a: Article | undefined): a is Article => !!a && (!a.module || on.has(a.module));
}
import { WHATS_NEW, latestNews, newsDate } from '../help/whatsNew';
import { markWhatsNewSeen, useUnreadNews } from '../help/seen';
import { BackLink } from '../ui/BackLink';
import { EmptyResult } from '../ui/bits';
import { StatusLegend } from '../ui/StatusLegend';
import { Icon } from '../ui/Icon';
import { useApp } from '../app/state';
import { raisedBy } from '../markup/backend';
import { raisedIn, raisedText, type Raised } from '../markup/model';
import { emptyText, fieldTable, FILL_SHEETS, isFillIn, requiredLine, requiredText, specOf, type FieldRow, type FillKind } from '../domain/columns';
import { templateWorkbook } from '../domain/export';
import { saveAndSay } from '../app/files';

/** Optional columns, shown on request: the table leads with what a new row needs. */
const isOptional = (c: FieldRow) => !!c.required && typeof c.required === 'object' && 'optional' in c.required;

/**
 * "Every column, and what it needs" (backlog IM1, wireframe 8): the field table of each sheet that loads back, from
 * domain/columns, so Help can't say a column differently from the template's Start here sheet. A tab per sheet with its
 * count of fill-in columns; what a new row must have first, the optional columns on request; one list that reads the
 * same on a phone. The one action is the template.
 */
function FieldTableHelp() {
  const app = useApp();
  const [kind, setKind] = useState<FillKind>('goals');
  const [all, setAll] = useState(false);
  const table = fieldTable(kind);
  const fill = table.filter(isFillIn);
  const shown = all ? fill : fill.filter((c) => !isOptional(c));
  const more = fill.length - shown.length;
  const worked = table.filter((c) => !isFillIn(c)).map((c) => c.header);
  const spec = specOf(kind);
  const line = kind === 'plan' ? 'Its Key or ID says which number goal it is; type a number into any week to set the plan by hand.' : `A new row needs: ${requiredLine(kind)}`;
  const template = () => saveAndSay(app.toast, { workspace: app.ws.name, what: 'template', date: app.today }, { kind: 'xlsx', sheets: templateWorkbook({ ws: app.ws, cycle: app.cycle, week: app.week, today: app.today }) }, 'Template saved');
  return (
    <section className="help-section" aria-labelledby="help-columns">
      <h2 className="h2" id="help-columns">The columns</h2>
      <div className="seg tabs one-row" role="tablist" aria-label="Sheet">
        {FILL_SHEETS.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setAll(false); }}>{specOf(k).name}<span className="tabcount">{fieldTable(k).filter(isFillIn).length}</span></button>)}
      </div>
      <p>One row per {spec.rowIs}. {line}</p>
      <ul className="help-points" aria-label={`${spec.name} columns`}>
        {shown.map((c) => (
          <li key={c.header}>
            <span className="strong">{c.header}</span>: {requiredText(c, table)}.{' '}
            <span className="hint">{c.format}. For example, {c.example}. If it’s left empty: {emptyText(c)}.</span>
          </li>
        ))}
        {worked.length > 0 && <li><span className="strong">{worked.slice(0, 3).join(', ')}{worked.length > 3 ? '…' : ''}</span>: {kind === 'plan' ? 'For reading' : 'Worked out'}. <span className="hint">Never read. Leave them or delete them.</span></li>}
      </ul>
      {more > 0 && <p>{more} more optional {more === 1 ? 'column' : 'columns'}: <button type="button" className="linkish tap" onClick={() => setAll(true)}>show them all</button>.</p>}
      <p><button type="button" className="btn primary" onClick={() => void template()}>Download the template</button></p>
    </section>
  );
}

function ArticleRow({ a }: { a: Article }) {
  return (
    <li className="help-row">
      <Link to={'/help/' + a.id} className="help-row-link">
        <span className="help-row-title">{a.title}</span>
        <span className="help-row-sum">{a.summary}</span>
      </Link>
    </li>
  );
}

export function HelpHome() {
  const [params, setParams] = useSearchParams();
  const shown = useShown();
  const q = params.get('q') ?? '';
  const exact = q.trim() ? searchGuide(q).filter(shown) : null;
  // Nothing found tries a near miss (find rule 5): "chek in" shows what "check in" finds, and says so.
  const near = exact && !exact.length ? nearMiss(q, ARTICLES.filter(shown).map(articleWords)) : null;
  const found = near ? searchGuide(near).filter(shown) : exact;
  const ARTICLE_WORDS = { thing: 'article', things: 'articles' };
  const latest = latestNews();
  const unread = useUnreadNews().length > 0;
  return (
    <div className="page narrow help-page">
      <div className="page-head">
        <h1 className="title-xl">Help</h1>
        <span className="hint">What each page in Faro does, and how to use it.</span>
      </div>
      <div className="help-search">
        <ListSearch value={q} label="Find in Help" placeholder="Find in Help" autoFocus settleMs={0} onSearch={(v, change) => setParams(v ? { q: v } : {}, { replace: historyStep(change) === 'replace' })} />
      </div>
      {latest && !found && (
        <Link to="/whats-new" className="help-news">
          <span className="help-news-label">What’s new{unread && <span className="help-dot" aria-hidden="true" />}{unread && <span className="sr"> (unread)</span>}</span>
          <span className="help-news-title">{latest.title}</span>
          <span className="help-news-date">{newsDate(latest.date)}</span>
        </Link>
      )}
      {found ? (
        <section className="block" aria-label="Search results">
          <h2 className="sr">Search results</h2>
          {near && <NoneFound things={ARTICLE_WORDS} q={q} filtered={false} near={near} onClearSearch={() => setParams({})} onClearFilters={() => setParams({})} />}
          {found.length > 0 && <CountLine things={ARTICLE_WORDS} n={found.length} narrowed />}
          {found.length
            ? <ul className="help-list">{found.map((a) => <ArticleRow key={a.id} a={a} />)}</ul>
            : <NoneFound things={ARTICLE_WORDS} q={q} filtered={false} onClearSearch={() => setParams({})} onClearFilters={() => setParams({})} />}
        </section>
      ) : GROUPS.map((g) => (
        <section key={g.id} className="block" aria-labelledby={'help-' + g.id}>
          <h2 className="block-title" id={'help-' + g.id}>{g.title}</h2>
          <ul className="help-list">{ARTICLES.filter((a) => a.group === g.id && shown(a)).map((a) => <ArticleRow key={a.id} a={a} />)}</ul>
        </section>
      ))}
    </div>
  );
}

export function HelpArticle() {
  const { id = '' } = useParams();
  const shown = useShown();
  const found = anyArticle(id);
  const a = shown(found) ? found : undefined;
  if (!a) {
    return (
      <div className="page narrow help-page">
        <BackLink to="/help" label="Help" />
        <EmptyResult title="There’s no help article here" action={<Link className="btn" to="/help">See all help</Link>}>It may have moved. Search Help for what you need.</EmptyResult>
      </div>
    );
  }
  const related = a.related.map((r) => anyArticle(r)).filter(shown);
  const group = GROUPS.find((g) => g.id === a.group);
  return (
    <div className="page narrow help-page help-article">
      <BackLink to="/help" label="Help" />
      <div className="page-head">
        <span className="eyebrow">{group?.title}</span>
        <h1 className="title-xl">{a.title}</h1>
        <p className="help-lead">{a.summary}</p>
      </div>
      {a.id === 'columns' && <FieldTableHelp />}
      {a.id === 'status' && <StatusLegend kind="key" statuses={['on', 'risk', 'off', 'stale', 'done']} className="help-key" wordClass="strong" label="Status shapes" />}
      {a.sections.map((s) => (
        <section key={s.heading} className="help-section">
          <h2 className="h2">{s.heading}</h2>
          {s.text?.map((t) => <p key={t}>{t}</p>)}
          {s.list && <ul className="help-points">{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
        </section>
      ))}
      {related.length > 0 && (
        <section className="help-section" aria-labelledby="help-related">
          <h2 className="h2" id="help-related">Related</h2>
          <ul className="help-list">{related.map((r) => <ArticleRow key={r.id} a={r} />)}</ul>
        </section>
      )}
    </div>
  );
}

export function WhatsNew() {
  const app = useApp();
  const shown = useShown();
  // Seeing this page is seeing what's new: the dot beside Help and the line on Home go.
  useEffect(() => { markWhatsNewSeen(); }, []);
  // The markups and feedback this person sent, so an entry that fixed one says so.
  const [raised, setRaised] = useState<Raised[]>([]);
  const feedback = app.snapshot.feedback;
  useEffect(() => { let live = true; void raisedBy(app.ws.id, app.viewer.id, app.mode === 'demo', feedback ?? []).then((r) => { if (live) setRaised(r); }).catch(() => undefined); return () => { live = false; }; }, [app.ws.id, app.viewer.id, app.mode, feedback]);
  return (
    <div className="page narrow help-page">
      <BackLink to="/help" label="Help" />
      <div className="page-head">
        <h1 className="title-xl">What’s new</h1>
        <span className="hint">Each release, newest first. <Link to="/help">Help</Link> explains every page.</span>
      </div>
      <ol className="news-list">
        {WHATS_NEW.map((e) => {
          const read = e.articles.map((id) => anyArticle(id)).filter(shown);
          const mine = raisedIn(e, raised, app.viewer.id);
          return (
            <li key={e.id} id={e.id} className="news">
              <time className="news-date" dateTime={e.date}>{newsDate(e.date)}</time>
              <h2 className="h2">{e.title}</h2>
              {mine.length > 0 && <p className="news-raised"><Icon name="check-circle" size={14} /><strong>You raised this.</strong> <span className="muted">{raisedText(mine)}</span></p>}
              <ul className="help-points">{e.points.map((p) => <li key={p}>{p}</li>)}</ul>
              {read.length > 0 && (
                <p className="news-more"><span className="muted">Read more: </span>{read.map((r, i) => <span key={r.id}>{i > 0 && ', '}<Link to={'/help/' + r.id}>{r.title}</Link></span>)}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
