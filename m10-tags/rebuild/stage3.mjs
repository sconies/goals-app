// Stage 3's drill: navigation.csv, find.csv, home.csv and readback.csv from screen-cases.json.
import fs from 'node:fs';
import path from 'node:path';
import { menuFor, tabsFor, litFor, pageName, makeIndex } from './screens.mjs';
import { modulesOn, INSTALLED, resolveModules } from './platform.mjs';
import { homeFor } from './home.mjs';
import { readBack, startLevel } from './readback.mjs';

export function ownsGoals(W, S1, personId, moment) {
  const ws = S1.asOf(moment);
  return ws.goals.some((g) => g.ownerId === personId && S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], moment).status !== 'done');
}

export function runScreenCases({ W, cases, outDir, S1 }) {
  const csv = (rows) => rows.map((r) => r.map(S1.csvCell).join(',')).join('\n') + '\n';
  const out = (name, head, rows) => fs.writeFileSync(path.join(outDir, `${name}.csv`), csv([head, ...rows]));
  const now = W.builtFor;
  const N = cases.navigation;
  const example = N.module;
  const installed = [...INSTALLED, { id: example.id, name: example.label, group: 'tools', needs: [] }];
  const navRows = [];
  for (const viewer of N.viewers) {
    const owns = ownsGoals(W, S1, viewer, now);
    const row = (address, label, modulesOff, withModule) => {
      const on = resolveModules(installed, modulesOff);
      const modules = withModule ? [{ id: example.id, to: example.to, label: example.label, group: example.group }] : [];
      const ctx = { on, modules };
      const menu = menuFor({ ownsGoals: owns, on, modules });
      const tabs = tabsFor({ ownsGoals: owns, on });
      navRows.push([viewer, owns ? 'yes' : 'no', label, menu.map((g) => g.join(' ')).join(' | '), tabs.join(' '), litFor(address, ctx, menu), pageName(W, address, { modules, on: () => true })]);
    };
    for (const a of N.addresses) row(a, a, W.modulesOff, false);
    for (const a of N.moduleAddresses) row(a, a, W.modulesOff, true);
    for (const s of N.switchedOff) row('/', s.address, s.off === 'all' ? [...new Set([...(W.modulesOff || []), ...installed.filter((m) => m.id !== example.id).map((m) => m.id)])] : [...new Set([...(W.modulesOff || []), ...s.off])], false);
  }
  out('navigation', ['viewer', 'owns_goals', 'address', 'menu', 'tabs', 'lit', 'page'], navRows);

  const index = makeIndex(W, S1, now);
  out('find', ['kind', 'q', 'total', 'near', 'ids'], cases.find.map(({ kind, q }) => {
    const r = index.search(kind, { q, size: 100000 });
    return [kind, q, r.total, r.near || '', r.all.map((x) => x.id).join(' ')];
  }));

  if (cases.home) {
    const on = modulesOn(W);
    const rows = [];
    for (const viewer of cases.home.viewers) for (const day of cases.home.days) {
      const h = homeFor(W, S1, viewer, day, { on, wsName: cases.workspaceName });
      rows.push([viewer, day.slice(0, 10), h.lead ? h.lead.kind : '', h.lead ? h.lead.title : '', h.quiet || '', h.run, h.forgiven || '']);
    }
    out('home', ['viewer', 'day', 'lead', 'title', 'quiet', 'run', 'forgiven'], rows);
  }
  if (cases.readback) {
    const on = modulesOn(W);
    out('readback', ['case', 'viewer', 'draft', 'rows', 'after'], cases.readback.cases.map((c) => {
      const d = { ...cases.readback.blank, ...c.draft };
      d.level = c.draft.level ?? startLevel(W, d.parentId, c.viewer) ?? cases.readback.blank.level;
      const r = readBack(W, S1, d, c.viewer, now, { on, wsName: cases.workspaceName });
      return [c.case, c.viewer, JSON.stringify(c.draft), r.rows.map((x) => `${x.label}: ${x.text}`).join(' | '), r.after.join(' | ')];
    }));
  }
}
