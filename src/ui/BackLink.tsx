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
import { placeName as namePlace } from '../domain/navigation';

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

/** A page's name, said the way the navigation says it (src/domain/navigation.ts, placeName). */
function placeName(path: string, app: ReturnType<typeof useApp>): string {
  return namePlace(path, {
    goal: (id) => app.goal(id)?.title ?? null,
    review: (id) => app.snapshot.reviews.find((r) => r.id === id)?.name ?? null,
    view: (sp) => { const vp = viewParams(sp); return (app.snapshot.views ?? []).find((v) => !v.deletedAt && !!v.params && v.params === vp && (v.pinned || v.personId === app.viewer.id))?.name ?? null; },
    article: (id) => articleById(id)?.title ?? null,
  });
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

/** A goal's Back link: in a review walk, back past the walk's other goals (to the review if you came from outside);
 *  otherwise to the page you came from, by name, or the goal it feeds. */
export function GoalBack() {
  const { goalId } = useParams();
  const [params] = useSearchParams();
  const app = useApp();
  const review = params.get('review');
  if (review) {
    const r = app.snapshot.reviews.find((x) => x.id === review);
    return <BackLink to={`/reviews/${review}`} label={r?.name ?? 'the review'} same={(path) => path.startsWith('/goals/') && path.includes('review=' + review)} />;
  }
  // From outside the app (a shared link), back goes up the tree: to the goal this one feeds, by name.
  const goal = goalId ? app.goal(goalId) : undefined;
  const parent = goal?.parentId ? app.goal(goal.parentId) : undefined;
  return <BackLink to={parent ? '/goals/' + parent.id : '/goals'} label={parent ? parent.title : 'Goals'} same={(path) => path.split('?')[0] === '/goals/' + goalId} />;
}
