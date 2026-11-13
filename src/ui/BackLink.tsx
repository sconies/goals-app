/* The back link (navigation spec 2.5 and rule 4): above the title, "‹ {where}", on every page below a place's first page.
   It returns to the page you came from in this app, the way the browser's Back would, and says where that is; arriving
   from outside (a shared link, a new tab), it goes to the page's parent instead. Forms you passed through on the way
   (an edit you saved, a check-in) are stepped over, by the link and by the browser's Back alike: Back never reopens a
   form you left. The rules are in src/domain/navigation.ts (backTo, pageName); this draws them and keeps the trail. */
import { useEffect, useMemo } from 'react';
import { Link, matchPath, useLocation, useNavigate, useNavigationType } from 'react-router';
import { useApp } from '../app/state';
import { useModules } from '../core/app';
import { Icon } from './Icon';
import { useViews, viewParams } from '../screens/GoalFilters';
import { articleRef } from '../help/lookup';
import { backTo, isForm, type PlaceNames } from '../domain/navigation';
import { useSectionNames } from '../screens/workspaceSections';

const KEY = 'goals-trail';
type Entry = { key: string; path: string };
let memory: (Entry | null)[] = [];
const trail = (): (Entry | null)[] => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') as (Entry | null)[]; } catch { return memory; } };
const keep = (t: (Entry | null)[]) => { memory = t; try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage blocked: this tab's memory only */ } };
/** Where this page is in the tab's history (the router numbers each entry). */
const here = () => { const s = window.history.state as { idx?: number } | null; return typeof s?.idx === 'number' ? s.idx : 0; };
const bare = (path: string) => path.split('?')[0]!;
/** The entry the tab was on before this one (to tell Back from Forward). */
let last: number | null = null;

/** Names by id, from the open workspace, for a page's name and a Back link's words (navigation rules 2 and 4). */
export function usePlaceNames(): PlaceNames {
  const app = useApp();
  const { screens } = useModules();
  const sections = useSectionNames();
  // The views as the Views menu reads them (old-form params read in the new form), so the two never disagree.
  const views = useViews();
  return useMemo((): PlaceNames => {
    const routes = screens.flatMap((m) => m.routes ?? []);
    return {
      goal: (id) => app.goal(id)?.title ?? null,
      review: (id) => app.snapshot.reviews.find((r) => r.id === id)?.name ?? null,
      view: (sp) => { const vp = viewParams(sp); return views.find((v) => !!v.params && v.params === vp)?.name ?? null; },
      article: (id) => articleRef(id)?.title ?? null,
      person: (id) => app.person(id)?.name ?? null,
      team: (id) => app.team(id)?.name ?? null,
      section: (id) => sections[id] ?? null,
      cycle: () => app.cycle?.name ?? null,
      parent: (id) => app.goal(id)?.parentId ?? null,
      // A module's page names itself from its thing (AR2), else by its fixed title.
      module: (path) => {
        const r = routes.find((x) => matchPath(x.path, path));
        if (!r) return null;
        return r.name?.(matchPath(r.path, path)?.params ?? {}, { goal: app.goal, person: app.person, team: app.team }) ?? r.title ?? null;
      },
    };
  }, [app, screens, sections, views]);
}

/** The modules' first pages (their menu items' addresses): no Back link there either. */
export function useFirsts(): string[] {
  const { screens } = useModules();
  return useMemo(() => screens.flatMap((m) => (m.navigation ?? []).map((n) => n.to)), [screens]);
}

/** The modules' pages drawn in focus mode: forms, to the one rule (navigation spec 2.5). */
export function useForms(): string[] {
  const { screens } = useModules();
  return useMemo(() => screens.flatMap((m) => (m.routes ?? []).filter((r) => r.focus).map((r) => r.path)), [screens]);
}

/**
 * The Shell calls this on every page, so a Back link knows where each earlier page in the tab was. The browser's Back
 * (or Forward) onto a form you had left steps over it, and over this page's other copies, to where the link would go.
 */
export function useTrail() {
  const loc = useLocation();
  const type = useNavigationType();
  const nav = useNavigate();
  const forms = useForms();
  useEffect(() => {
    const now = here();
    const t = trail();
    const from = last;
    last = now;
    if (type === 'POP' && from != null && from !== now && isForm(loc.pathname, loc.search, forms)) {
      const came = t[from];
      if (came && !isForm(came.path, '', forms)) {
        const dir = now < from ? -1 : 1;
        let j = now;
        while (t[j] && (isForm(t[j]!.path, '', forms) || (dir < 0 && bare(t[j]!.path) === bare(came.path)))) j += dir;
        if (t[j] && j !== now) { last = j; void nav(j - now); return; }
      }
    }
    // A new entry drops the ones after it, as the browser does; Back and Forward keep them.
    const next = type === 'PUSH' ? t.slice(0, now) : t.slice();
    while (next.length < now) next.push(null);
    next[now] = { key: loc.key, path: loc.pathname + loc.search };
    keep(next);
  }, [loc.key, loc.pathname, loc.search, type, nav, forms]);
}

/** This tab's pages, oldest first, ending with this one: the known earlier entries, then this page. */
function knownTrail(path: string): { path: string }[] {
  // Only the entries before this one: this one's may still be the last page's, from before a reload.
  const t = trail().slice(0, here());
  let k = t.length;
  while (k > 0 && t[k - 1]) k--;
  return [...(t.slice(k) as Entry[]), { path }];
}

/**
 * "‹ {where}": back to the page you came from, or to the page's parent when you came from outside the app. Nothing on
 * a place's first page. (Its old props are accepted and unused: rule 4 decides.)
 */
export function BackLink(_old: { to?: string; label?: string; same?: (path: string) => boolean } = {}) {
  void _old;
  const nav = useNavigate();
  const { pathname, search } = useLocation();
  const names = usePlaceNames();
  const firsts = useFirsts();
  const forms = useForms();
  const b = backTo(pathname, search, knownTrail(pathname + search), names, firsts, forms);
  if (!b) return null;
  return (
    <Link className="backlink" to={b.to} aria-label={`Back to ${b.label}`} onClick={(e) => { if (b.steps > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); void nav(-b.steps); } }}>
      <Icon name="chevron-left" />
      <span className="ellipsis">{b.label}</span>
    </Link>
  );
}

/** A goal's back link: rule 4 (back to where you came from; in a review walk, to the review; else up the tree). */
export function GoalBack() {
  return <BackLink />;
}
