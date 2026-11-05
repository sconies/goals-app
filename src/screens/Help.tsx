/* Help: what everything does (the guide, src/help/guide.ts) and what's new (src/help/whatsNew.ts).
   /help lists the articles by section with a search; /help/:id is one article; /whats-new is every release.
   PageHelp is the small Help link at the foot of every page, chosen from the address by the guide's route map;
   HomeNews is the one quiet line on Home after a release the person hasn't seen. */
import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ARTICLES, GROUPS, articleById, articleForPath, searchGuide, type Article } from '../help/guide';
import { WHATS_NEW, latestNews, newsDate } from '../help/whatsNew';
import { markWhatsNewSeen, useUnreadNews } from '../help/seen';
import { BackLink } from '../ui/BackLink';
import { EmptyResult } from '../ui/bits';
import { StatusLegend } from '../ui/StatusLegend';
import { Icon } from '../ui/Icon';

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
  const q = params.get('q') ?? '';
  const found = q.trim() ? searchGuide(q) : null;
  const latest = latestNews();
  const unread = useUnreadNews().length > 0;
  return (
    <div className="page narrow help-page">
      <div className="page-head">
        <h1 className="title-xl">Help</h1>
        <span className="hint">What each page does, and how to use it.</span>
      </div>
      <label className="help-search">
        <span className="sr">Search help</span>
        <input className="input" type="search" placeholder="Search help" value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} />
      </label>
      {latest && !found && (
        <Link to="/whats-new" className="help-news">
          <span className="help-news-label">What’s new{unread && <span className="help-dot" aria-hidden="true" />}{unread && <span className="sr"> (unread)</span>}</span>
          <span className="help-news-title">{latest.title}</span>
          <span className="help-news-date">{newsDate(latest.date)}</span>
        </Link>
      )}
      {found ? (
        <section className="block" aria-label="Search results">
          <h2 className="block-title">{found.length === 1 ? '1 article' : `${found.length} articles`}</h2>
          {found.length
            ? <ul className="help-list">{found.map((a) => <ArticleRow key={a.id} a={a} />)}</ul>
            : <EmptyResult title="No articles match" action={<button type="button" className="btn" onClick={() => setParams({}, { replace: true })}>Clear the search</button>}>Try fewer or plainer words.</EmptyResult>}
        </section>
      ) : GROUPS.map((g) => (
        <section key={g.id} className="block" aria-labelledby={'help-' + g.id}>
          <h2 className="block-title" id={'help-' + g.id}>{g.title}</h2>
          <ul className="help-list">{ARTICLES.filter((a) => a.group === g.id).map((a) => <ArticleRow key={a.id} a={a} />)}</ul>
        </section>
      ))}
    </div>
  );
}

export function HelpArticle() {
  const { id = '' } = useParams();
  const a = articleById(id);
  if (!a) {
    return (
      <div className="page narrow help-page">
        <BackLink to="/help" label="Help" />
        <EmptyResult title="There’s no help article here" action={<Link className="btn" to="/help">See all help</Link>}>It may have moved. Search Help for what you need.</EmptyResult>
      </div>
    );
  }
  const related = a.related.map((r) => articleById(r)).filter((x): x is Article => !!x);
  const group = GROUPS.find((g) => g.id === a.group);
  return (
    <div className="page narrow help-page help-article">
      <BackLink to="/help" label="Help" />
      <div className="page-head">
        <span className="eyebrow">{group?.title}</span>
        <h1 className="title-xl">{a.title}</h1>
        <p className="help-lead">{a.summary}</p>
      </div>
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
  // Seeing this page is seeing what's new: the dot beside Help and the line on Home go.
  useEffect(() => { markWhatsNewSeen(); }, []);
  return (
    <div className="page narrow help-page">
      <BackLink to="/help" label="Help" />
      <div className="page-head">
        <h1 className="title-xl">What’s new</h1>
        <span className="hint">Each release, newest first. <Link to="/help">Help</Link> explains every page.</span>
      </div>
      <ol className="news-list">
        {WHATS_NEW.map((e) => {
          const read = e.articles.map((id) => articleById(id)).filter((x): x is Article => !!x);
          return (
            <li key={e.id} id={e.id} className="news">
              <time className="news-date" dateTime={e.date}>{newsDate(e.date)}</time>
              <h2 className="h2">{e.title}</h2>
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

/** Pages that have no Help link of their own: Help itself, and the print views (nothing but the page prints). */
const NO_PAGE_HELP = /^\/(help|whats-new)(\/|$)|\/print$/;

/** The small Help link at the foot of every page: it opens the guide's article for the page you're on. */
export function PageHelp() {
  const { pathname, search } = useLocation();
  if (NO_PAGE_HELP.test(pathname)) return null;
  const a = articleForPath(pathname, search);
  if (!a) return null;
  return (
    <footer className="page-help">
      <Link to={'/help/' + a.id} className="page-help-link" title={a.title} data-article={a.id}>
        <Icon name="help" />
        <span>Help with this page</span>
      </Link>
    </footer>
  );
}

/**
 * One quiet line on Home after a release this person hasn't seen. Dismissing it counts as seen. Under the greeting on a
 * tablet or desktop; at the foot of Home on a phone, where the first screen belongs to the week's work.
 */
export function HomeNews({ at }: { at: 'head' | 'foot' }) {
  const unread = useUnreadNews();
  const top = unread[0];
  if (!top) return null;
  return (
    <p className={'home-news home-news-' + at}>
      <span className="home-news-text"><span className="strong">New:</span> {top.title} · <Link to="/whats-new">See what’s new</Link></span>
      <button type="button" className="home-news-close" aria-label="Dismiss what’s new" title="Dismiss" onClick={markWhatsNewSeen}><Icon name="close" size={14} /></button>
    </p>
  );
}
