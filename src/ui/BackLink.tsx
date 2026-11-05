/* One Back link for detail pages (review notes, 5 Nov: "an easier way to go back"). It returns to the page you came from
   in this app, the way the browser's back button would, and says where that is. Arriving from outside (a shared link,
   a new tab), it goes to the page's parent instead. Forms you passed through on the way (an edit you saved, a check-in)
   are stepped over: Back never reopens a form. */
import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { Icon } from './Icon';
import { viewParams } from '../screens/GoalFilters';
import { articleById } from '../help/guide';

const KEY = 'goals-trail';
type Entry = { key: string; path: string };
let memory: Entry[] = [];
const trail = (): Entry[] => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') as Entry[]; } catch { return memory; } };
const keep = (t: Entry[]) => { memory = t; try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage blocked: this tab's memory only */ } };
/** Where this page is in the tab's history (the router numbers each entry). */
const here = () => { const s = window.history.state as { idx?: number } | null; return typeof s?.idx === 'number' ? s.idx : 0; };

/** The Shell calls this on every page, so a Back link knows where each earlier page in the tab was. */
export function useTrail() {
  const loc = useLocation();
  useEffect(() => {
    const t = trail().slice(0, here() + 1);
    t[here()] = { key: loc.key, path: loc.pathname + loc.search };
    keep(t);
  }, [loc.key, loc.pathname, loc.search]);
}

/** Forms: passed through, never gone back to. */
const FORM = /^\/(check-in|quick-check-in|import|workspace\/new)(\/|$)|^\/goals\/(new|[^/]+\/edit)$|^\/reviews\/(new|[^/]+\/edit)$|^\/retro\/[^/]+$/;

/** A page's name, said the way the navigation says it. */
function placeName(path: string, app: ReturnType<typeof useApp>): string {
  const [p = '/', q = ''] = path.split('?');
  const sp = new URLSearchParams(q);
  const review = sp.get('review');
  if (review && p.startsWith('/goals/')) return app.snapshot.reviews.find((r) => r.id === review)?.name ?? 'the review';
  if (p === '/') return 'Home';
  if (p === '/goals') {
    const vp = viewParams(sp);
    const view = (app.snapshot.views ?? []).find((v) => !v.deletedAt && !!v.params && v.params === vp && (v.pinned || v.personId === app.viewer.id));
    if (view) return view.name;
    return sp.get('show') === 'mine' ? 'your goals' : sp.get('show') === 'watching' ? 'Watching' : 'Goals';
  }
  const goal = /^\/goals\/([^/]+)$/.exec(p);
  if (goal) return app.goal(goal[1]!)?.title ?? 'the goal';
  const rev = /^\/reviews\/([^/]+)$/.exec(p);
  if (rev) return app.snapshot.reviews.find((r) => r.id === rev[1])?.name ?? 'the review';
  const names: Record<string, string> = { '/watching': 'Watching', '/reviews': 'Reviews', '/activity': 'Activity', '/data': 'Data', '/workspace': 'Workspace', '/settings': 'Settings', '/retro': 'Wrap up', '/research': 'Research', '/help': 'Help', '/whats-new': 'What’s new' };
  const help = /^\/help\/([^/]+)$/.exec(p);
  if (help) return articleById(help[1]!)?.title ?? 'Help';
  return names[p] ?? 'the last page';
}

/**
 * Back to the page you came from, or to `to` (the parent, named `label`) when you came from outside the app.
 * `same` says which earlier pages are this one too (a review walk's other goals), to step over them.
 */
export function BackLink({ to, label, same }: { to: string; label: string; same?: (path: string) => boolean }) {
  const app = useApp();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const t = trail();
  const now = here();
  const isSame = same ?? ((path: string) => path.split('?')[0] === pathname);
  let j = now - 1;
  while (j >= 0 && t[j] && (FORM.test(t[j]!.path.split('?')[0]!) || isSame(t[j]!.path))) j--;
  const prev = j >= 0 ? t[j] : undefined;
  const where = prev ? placeName(prev.path, app) : label;
  return (
    <Link className="backlink" to={prev ? prev.path : to} title={`Back to ${where}`} onClick={(e) => { if (prev && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); void nav(j - now); } }}>
      <Icon name="chevron-left" />
      <span className="ellipsis">Back to {where}</span>
    </Link>
  );
}

/** A goal's Back link: in a review walk, back past the walk's other goals (to the review if you came from outside). */
export function GoalBack() {
  const { goalId } = useParams();
  const [params] = useSearchParams();
  const app = useApp();
  const review = params.get('review');
  if (review) {
    const r = app.snapshot.reviews.find((x) => x.id === review);
    return <BackLink to={`/reviews/${review}`} label={r?.name ?? 'the review'} same={(path) => path.startsWith('/goals/') && path.includes('review=' + review)} />;
  }
  return <BackLink to="/goals" label="Goals" same={(path) => path.split('?')[0] === '/goals/' + goalId} />;
}
