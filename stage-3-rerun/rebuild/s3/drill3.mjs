// Stage 3's drill: navigation.csv, find.csv, home.csv and readback.csv from the screens' rules.
import fs from 'node:fs';
import path from 'node:path';
import { menuGroups, phoneTabs, litItem, pageName } from './navigation.mjs';
import { goalRows, personRows, teamRows, search } from './finding.mjs';
import { makeCore } from './core.mjs';
import { homeFor } from './home.mjs';
import { readBack } from './readback.mjs';

export function runScreens({ W, cases, outDir, S1 }) {
  const core = makeCore(W, S1);
  const csv = S1.csvCell;
  const write = (name, rows) => fs.writeFileSync(path.join(outDir, `${name}.csv`), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
  const at = W.builtFor;
  const offAll = core.modulesOff();

  // ---- navigation ----
  const nav = [['viewer', 'owns_goals', 'address', 'menu', 'tabs', 'lit', 'page']];
  const N = cases.navigation;
  const mod = N.module;
  const names = core.names(at);
  for (const viewer of N.viewers) {
    const checkin = core.hasGoalToCheckIn(viewer, at);
    const base = { checkin, reviewsOn: !offAll.has('reviews'), feedbackOn: !offAll.has('feedback'), mods: [] };
    const row = (address, opts, page) => {
      const menu = menuGroups(opts).map((g) => g.join(' ')).join(' | ');
      nav.push([viewer, checkin ? 'yes' : 'no', address, menu, phoneTabs(opts).join(' '), litItem(address.split(' ')[0], opts), page]);
    };
    for (const a of N.addresses) row(a, base, pageName(a, names));
    const withMod = { ...base, mods: [mod] };
    for (const a of N.moduleAddresses) row(a, withMod, pageName(a, { ...names, modulePage: (p) => (p === mod.to || p.startsWith(mod.to + '/') ? mod.label : null) }));
    for (const s of N.switchedOff) {
      const off = s.off === 'all' ? new Set(['reviews', 'feedback', ...offAll]) : new Set([...offAll, ...s.off]);
      row(s.address, { ...base, reviewsOn: !off.has('reviews'), feedbackOn: !off.has('feedback') }, 'Home');
    }
  }
  write('navigation', nav);

  // ---- find ----
  const find = [['kind', 'q', 'total', 'near', 'ids']];
  const states = core.goalStates(at);
  const gRows = goalRows(states, core);
  const tRows = teamRows(W.teams, core.personById);
  for (const { kind, q } of cases.find) {
    let r;
    if (kind === 'goal') r = search(gRows, q, { keyRow: true });
    else if (kind === 'person') r = search(personRows(W.people, core.teamById, q), q);
    else r = search(tRows, q);
    find.push([kind, q, r.total, r.near ?? '', r.rows.map((x) => x.id).join(' ')]);
  }
  write('find', find);

  // ---- home ----
  const home = [['viewer', 'day', 'lead', 'title', 'quiet', 'run', 'forgiven']];
  for (const viewer of cases.home.viewers) for (const day of cases.home.days) {
    const h = homeFor(core, viewer, day, { workspaceName: cases.workspaceName });
    home.push([viewer, day.slice(0, 10), h.lead?.kind ?? '', h.lead?.title ?? '', h.quiet ?? '', h.run, h.forgiven ?? '']);
  }
  write('home', home);

  // ---- read-back ----
  const rb = [['case', 'viewer', 'draft', 'rows', 'after']];
  for (const c of cases.readback.cases) {
    const draft = { ...cases.readback.blank, ...c.draft };
    const r = readBack(core, draft, c.viewer, at, { workspaceName: cases.workspaceName, draftGiven: c.draft });
    rb.push([c.case, c.viewer, JSON.stringify(c.draft), r.rows.map(([label, s]) => `${label}: ${s}`).join(' | '), r.after.join(' | ')]);
  }
  write('readback', rb);
}
