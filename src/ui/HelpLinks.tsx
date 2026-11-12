/* The light parts of Help that every page carries (the first download, backlog AX4): the small Help link at the foot
   of every page, chosen from the address by the guide's route map, and HomeNews, the one quiet line on Home after a
   release the person hasn't seen. They read the Help index (src/help/lookup.ts), not the guide's or What's new's text;
   the Help screens themselves are src/screens/Help.tsx. */
import { Link, useLocation } from 'react-router';
import { articleForPath } from '../help/lookup';
import { markWhatsNewSeen, useUnreadNews } from '../help/seen';
import { Icon } from './Icon';

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
 * One quiet line on Home after a release this person hasn't seen. Dismissing it counts as seen. Under the greeting from a
 * tablet up; on a phone just after your goals that need attention, so the first screen is still the week's work and the
 * first goal needing you (backlog N, 8 Nov: at the foot of Home it went unseen).
 */
export function HomeNews({ at }: { at: 'head' | 'phone' | 'foot' }) {
  const unread = useUnreadNews();
  const top = unread[0];
  if (!top) return null;
  return (
    <p className={'home-news home-news-' + at}>
      <span className="home-news-text"><span className="strong">New in Faro:</span> {top.title}{/[.?!]$/.test(top.title) ? '' : '.'} <Link to="/whats-new">See what’s new</Link></span>
      <button type="button" className="home-news-close" aria-label="Dismiss what’s new" title="Dismiss" onClick={markWhatsNewSeen}><Icon name="close" size={14} /></button>
    </p>
  );
}
