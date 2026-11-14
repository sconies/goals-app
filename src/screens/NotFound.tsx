/* An address that leads nowhere: say so, and offer the way home (re-review, 8 Nov, backlog T), then Find and Help
   (navigation spec, 2.6). One that is a route of a module installed here but switched off says so, and who can switch
   it on (FT2, N21). It loads when first opened, as every page but Home does (the first download, scripts/check-bundle.mjs). */
import { Link, matchPath, useLocation } from 'react-router';
import { useModules } from '../core/app';
import { Find } from '../ui/Find';
import { SwitchedOffLine } from '../ui/SwitchedOff';

export function NotFound() {
  const { pathname } = useLocation();
  const { installed, on } = useModules();
  // Its routes, its old addresses (Feedback's /inbox, say: SW1) and its Workspace sections (Fields' /workspace/fields, TG1; AI access's /workspace/ai, SW2).
  const off = installed.find((m) => !on.has(m.id) && [...m.routes, ...m.redirects.map(([from]) => from), ...(m.sections ?? []).map((s) => `/workspace/${s}`)].some((r) => matchPath(r, pathname)));
  return (
    <div className="page narrow not-found">
      <h1 className="title-xl">Page not found</h1>
      <p className="muted">There’s nothing at this address. The link may be old, or mistyped.</p>
      {off && <SwitchedOffLine name={off.name} />}
      <div className="row"><Link className="btn primary" to="/">Go to Home</Link></div>
      {/* Then Find, inline, and Help (navigation spec, 2.6). */}
      <section className="stack not-found-find" aria-label="Find">
        <h2 className="field-label">Or find what you were looking for</h2>
        <Find inline onClose={() => {}} />
      </section>
      <div className="row"><Link className="btn ghost" to="/help">Help</Link></div>
    </div>
  );
}
