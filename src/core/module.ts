/* Feature modules (docs/architecture.md): what a module is, and which ones are on.

   Faro is a small core (people, teams, goals, plans, check-ins, the status rules, the vocabulary and the change engine)
   plus feature modules. Each module is one folder, src/modules/<id>/, holding:

     module.json   the facts, as plain data a generator can read without running anything (ModuleFacts below)
     help.ts       its Help articles (optional; pure data, read by the guide, the app and the AI's get_help)
     tools.ts      its AI tools (optional; the MCP server offers them)
     app.tsx       its screens and where they go: routes, navigation, places on core screens (optional; AppModule)
     records.ts    its own records: rows each way, what a cycle carries, how a removed one comes back (optional;
                   domain/records ModuleRecords, AS part 2)
     actions.ts    its actions, run by app.run like the core's (optional; app/actions ModuleActions)
     spec.ts       its rules in plain words, with worked examples, for its section of the spec (optional)

   The build lists the folders (vite.modules.ts) and the core reads them through `virtual:faro-modules…`, so the core
   never imports a module, and a module left out of the build (FARO_WITHOUT=<id>) is simply not there.
   This file is plain TypeScript, with no screens: the server and the guide use it too. */

/** Places on core screens a module can put something: Home's blocks, a goal page's sections, Data's tools, Goals'
    tools, the goal forms' "Measured by" field, a fact in a goal's summary (goal.facts, GT1), a person's and a team's page in People (app redesign WR1), a Help article's own block (help.article), the
    check-in's number step and the one-table check-in (checkin.number and checkin.table, NR: where a number can be filled
    in from its source).
    src/core/app.tsx says what each is given. (Workspace takes whole sections instead: `sections` below.) */
export const PLACES = ['home.blocks', 'goal.facts', 'goal.sections', 'data.tools', 'goals.tools', 'goal.measure', 'people.person', 'people.team', 'help.article', 'checkin.number', 'checkin.table'] as const;
export type PlaceName = (typeof PLACES)[number];

/** A module's module.json: what it is, what it needs and what it adds, as data. */
export interface ModuleFacts {
  /** The folder's name: lower case, words joined by hyphens. Never changes; workspaces switch modules off by it. */
  id: string;
  /** What people see on Workspace, Features. */
  name: string;
  /** One sentence: what it lets people do. */
  summary: string;
  /** The modules it can't work without. It's off whenever one of them is off or left out. */
  needs: string[];
  /** The routes its app.tsx adds, as React Router writes them (each has a Help article). */
  routes: string[];
  /** Old addresses that now lead to one of its routes: [from, to]. */
  redirects: [string, string][];
  /** The navigation items its app.tsx adds, by label. */
  navigation: string[];
  /** The places on core screens it fills. */
  places: PlaceName[];
  /** The kinds of thing its app.tsx makes findable (AR2): each answers find-and-pick and Find through the Search port. */
  finders?: string[];
  /** The filters its app.tsx adds to a core list, by id (AR2): declared as data, so a server can apply them. */
  filters?: string[];
  /** Whether its app.tsx raises things to sort out on Workspace's overview, with no Workspace section of its own (AR2). */
  toSortOut?: boolean;
  /** The Workspace sections its app.tsx adds, by id: each is at /workspace/<id>, in Workspace's menu, with a Help
      article (backlog W). Optional: most modules add none. */
  sections?: string[];
  /** The database tables it owns, each with its migration. */
  tables: { name: string; migration: string; purpose: string }[];
  /**
   * Its own records (AS part 2, domain/records), as its records.ts declares them: what one row is (`name`, its kind on
   * Recently removed), the table it is kept in (one of `tables`), the key a commit and the workspace file it under
   * (`modules[id][key]`), and whether a row can be removed and restored. The core's tables are closed; a module that
   * keeps anything brings its own. Optional: most modules keep nothing.
   */
  records?: { name: string; table: string; key: string; removable: boolean }[];
  /** The AI tools its tools.ts adds, by name. */
  aiTools: string[];
  /** The Help articles its help.ts adds, by id. */
  help: string[];
  /** Its requirements, by id (evals/requirements.json). */
  requirements: string[];
  /** The eval journeys (evals/journeys.cjs) and checks (F…, N…) that exercise it: left out when it is. */
  journeys: string[];
  /** Its screens, by file name, and the AI tools that read or do what each shows, or why an assistant has no need of it
      (src/mcp/parity.ts merges them with the core's). A core screen named here gains the module's tools beside its own
      (Print shows a review). Optional; module map F8. */
  parity?: Record<string, string[] | { notForAssistants: string }>;
  /** The source files that belong to it outside its folder, if any (there should be none once it's fully moved). */
  elsewhere?: string[];
  /** What it deliberately leaves out, why, and how it could grow: written into the spec as spec/modules/<id>/growth.md,
      so a rebuild can tell a choice from a gap. Optional. */
  growth?: { idea: string; why: string; how: string }[];
}

/** Workspace's sections in menu order: the core's, then each module's after the section it names in `after` (or at the
    end). Two modules naming the same section keep their own order, one after the other. */
export function placeSections<T extends { id: string; after?: string }>(core: readonly T[], added: readonly T[]): T[] {
  const all = [...core];
  for (const s of added) {
    if (all.some((x) => x.id === s.id)) continue;
    let at = s.after ? all.findIndex((x) => x.id === s.after) : -1;
    if (at < 0) { all.push(s); continue; }
    while (at + 1 < all.length && added.includes(all[at + 1]!) && all[at + 1]!.after === s.after) at++;
    all.splice(at + 1, 0, s);
  }
  return all;
}

/**
 * The Workspace sections someone sees, in menu order (rule 7, app redesign WR2): the core's and the modules', placed
 * by `placeSections`, without the admins-only ones for anyone who isn't an admin. The menu, the phone's "More in
 * Workspace" and the admins-only page all ask this.
 */
export function sectionsFor<T extends { id: string; after?: string; admins?: boolean }>(viewer: { admin: boolean }, core: readonly T[], added: readonly T[]): T[] {
  return placeSections(core, added).filter((s) => !s.admins || viewer.admin);
}

/** Why a module isn't on, when it isn't. */
export type OffReason = { kind: 'switched-off' } | { kind: 'needs'; missing: string[] };

/**
 * Which modules are on in a workspace: installed, not switched off there, and with everything they need on (so
 * switching one off switches off what depends on it, however deep). A need that isn't installed counts as off.
 */
export function resolveModules(installed: readonly Pick<ModuleFacts, 'id' | 'needs'>[], switchedOff: readonly string[] = []): { on: Set<string>; off: Map<string, OffReason> } {
  const ids = new Set(installed.map((m) => m.id));
  const on = new Set(installed.filter((m) => !switchedOff.includes(m.id)).map((m) => m.id));
  const off = new Map<string, OffReason>();
  for (const m of installed) if (switchedOff.includes(m.id)) off.set(m.id, { kind: 'switched-off' });
  // Until nothing changes: a module whose needs aren't all on goes off, which can take others with it.
  for (let changed = true; changed;) {
    changed = false;
    for (const m of installed) {
      if (!on.has(m.id)) continue;
      const missing = m.needs.filter((n) => !on.has(n) || !ids.has(n));
      if (missing.length) { on.delete(m.id); off.set(m.id, { kind: 'needs', missing }); changed = true; }
    }
  }
  return { on, off };
}

/** Problems with a set of manifests: ids that clash or are badly formed, needs that aren't installed, needs in a loop. */
export function manifestProblems(installed: readonly Pick<ModuleFacts, 'id' | 'needs'>[]): string[] {
  const out: string[] = [];
  const ids = installed.map((m) => m.id);
  for (const id of ids) if (!/^[a-z][a-z0-9-]*$/.test(id)) out.push(`${id}: a module id is lower case, words joined by hyphens`);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) out.push(`${id}: two modules have this id`);
  const by = new Map(installed.map((m) => [m.id, m]));
  for (const m of installed) for (const n of m.needs) if (!by.has(n)) out.push(`${m.id} needs ${n}, which isn't installed`);
  // A loop of needs can never be on.
  const seen = new Set<string>();
  const visit = (id: string, path: string[]) => {
    if (path.includes(id)) { out.push(`needs go round in a loop: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`); return; }
    if (seen.has(id)) return;
    seen.add(id);
    for (const n of by.get(id)?.needs ?? []) visit(n, [...path, id]);
  };
  for (const m of installed) visit(m.id, []);
  return [...new Set(out)];
}

/**
 * What's wrong with a module's records (AS part 2), in words: its module.json `records` and `tables` must agree (every
 * record in one of its tables, every table holding a record), the records must be those its records.ts declares, and
 * `elsewhere` must name no file outside its own folder: a module's code lives in its folder, the core never holds it.
 */
export function recordProblems(
  m: Pick<ModuleFacts, 'id' | 'tables' | 'records' | 'elsewhere'>,
  declared: readonly { name: string; table: string; key: string; removable: boolean }[],
): string[] {
  const out: string[] = [];
  const records = m.records ?? [];
  const tables = new Set(m.tables.map((t) => t.name));
  for (const r of records) if (!tables.has(r.table)) out.push(`${m.id}: the record “${r.name}” is kept in ${r.table}, which module.json’s tables don’t list`);
  for (const t of tables) if (!records.some((r) => r.table === t)) out.push(`${m.id}: the table ${t} holds none of module.json’s records`);
  const key = (r: { name: string; table: string; key: string; removable: boolean }) => `${r.name} | ${r.table} | ${r.key} | ${r.removable}`;
  const said = records.map(key).sort(), made = declared.map(key).sort();
  if (said.join('\n') !== made.join('\n')) out.push(`${m.id}: module.json’s records (${said.join('; ') || 'none'}) aren’t those its records.ts declares (${made.join('; ') || 'none'})`);
  for (const f of m.elsewhere ?? []) if (!f.startsWith(`src/modules/${m.id}/`)) out.push(`${m.id}: elsewhere names ${f}, a file of the core's; a module's code lives in its own folder`);
  return out;
}
