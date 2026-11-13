# Handing Faro to the internal team

What the internal team needs to take Faro onto the company's platform, and how far Faro has got in making it easy. It is written for the team that will do it. Faro is a model to copy, not a product: it never holds real data, and some things are left to the platform on purpose.

**Two ways to do it.** *Copy and adapt:* take the code, swap its outside parts for the company's, build what the platform must add. *Rewrite from the spec:* build fresh from `spec/` and `llms.txt`, proving each stage with the rebuild kit. Either way, the spec says what Faro does, and the conformance data says when a rebuild gets the rules right.

## What you get

| Part | Where | State (9 Nov, with 8c) |
|---|---|---|
| What Faro does, generated from the code | `llms.txt`, `spec/` | Complete for the core and both modules; can't drift (CI) |
| The rules, with worked examples | `spec/core/rules/`, `spec/modules/*/rules.md` | Complete |
| Expected results for every demo goal in every week | `spec/conformance/` | Status, flags, projection, scorecard, what a check-in must say (with the habit's moment), find, navigation and Home (with the habit's on-time run and its forgiven week). The habit is core and has no switch: its spec says why |
| The rebuild kit, stage by stage | `spec/rebuild/` | Stage 1 (the rules) has a drill: 100% from the kit alone, 8 Nov. Stages 2 to 5 are outlines, checked by hand |
| What the platform must add | `spec/requirements/internal/` | R1 sign-in and access, R2 single sign-on, R3 time zones, R4 scale and safety, R6a the organisation, R6b delegates, R6c the planning round, each with acceptance checks |
| The ports at company scale | `spec/rebuild/ports-at-scale.md` | A sketch: the query and command ports that replace the demo-scale goals store, and how its contract tests carry across. Neither port is built |
| How it's built | `docs/architecture.md` | A modular monolith: a core plus modules, one app, one database |
| The feature modules | `src/modules/` | Spreadsheets: download the goals as a workbook or CSV files and load changes back, each shown before it is saved. Metric library: each number goals are measured by defined once, and which metric measures a goal. Reviews, Watching, the Wrap-up, the Goal map and Feedback are switches a workspace can turn off, whose screens are still the core's until each moves into its folder. Each has its section in `spec/modules/` and its rebuild stage |
| The code | this repository (public) | React and Vite app, one Node endpoint for the AI tools (`api/mcp.js`), Postgres |

## The checklist (copy and adapt)

Each line says what you do and what Faro gives you for it.

### 1. Run it

- [ ] **Host the web app** (static files from `npm run build`) and **one Node endpoint** (`api/mcp.js`, the AI tools). Nothing depends on Vercel.
- [ ] **Settings:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (the browser's), `SUPABASE_URL`, `VITE_SUPABASE_KEY` again for the endpoint (it uses the public key only, never the service role key). They are Supabase's adapters' settings: your adapters bring their own (step 3).

### 2. Read R1 and R4 before you touch the goals store

The goals store's interface (`Store`) loads a whole workspace and saves rows its caller wrote. That is the demo-scale port: R4 says nothing loads a whole workspace, and R1 says the server enforces the rules and decides who acted. Read them first, so step 3 doesn't start by building the interface they replace.

- [ ] **R1, sign-in and access** (`spec/requirements/internal/r1-sign-in-and-access.md`): who may change what, enforced on the server.
- [ ] **R4, scale and safety** (`spec/requirements/internal/r4-scale-and-safety.md`): summary rows on the server, paging, nothing loads a whole workspace.
- [ ] **The ports at company scale** (`spec/rebuild/ports-at-scale.md`): the query port (summary rows, paged lists, search) and the command port (an action's name and input, run by `src/domain/actions` on the server, which sets who, when and the ids and writes the change log), what stays the same, and a route there in three steps.

### 3. Swap the outside parts

Every outside part sits behind one interface in `src/ports/`, with a contract test any replacement must pass (backlog 8c). Supabase is imported only by its adapters, `src/adapters/supabase/`, and the layers lint keeps it so. The goals store is proven twice: the Supabase adapter and a plain-Postgres one pass the same contract. Step by step: `spec/rebuild/adapters.md`.

- [ ] **The goals store:** `Store` (`src/data/store.ts`). Adapters: browser (the demo), Supabase (`src/adapters/supabase/goalsStore.ts`), plain Postgres (`src/adapters/postgres/goalsStore.ts`). Write one for the company's database to get Faro running there until `storeContract` passes; for the whole company, build towards the query and command ports instead (step 2).
- [ ] **The database itself**, if you keep Postgres: `src/adapters/postgres/bootstrap.sql` once (stand-ins for Supabase's roles and its storage and auth schemas), then every migration in `supabase/migrations`, in order (from 0035 they live in the `faro` schema: `supabase/README.md`). Their functions hold real logic (`okr_write` and `okr_commit` for saves, tokens, the inbox, telemetry); every adapter calls them. They check only that rows belong to the workspace (what each row says, where a row already stored is kept, and a milestone's stages through their goal; 0038) and that goal and review versions haven’t moved: the rules, the actor, the time and the change-log entry come from the caller (the browser today), which R1 and R4 say must move to your server: the command port is how (step 2). Supabase's roles (`anon`, `authenticated`) and row rules become your service's checks.
- [ ] **Markups and feedback:** `MarkupStore` (`src/markup/ops.ts`) and `FeedbackStore` (`src/markup/feedback.ts`); Supabase's are in `src/adapters/supabase/`. Contracts: `markupContract`, `feedbackContract`.
- [ ] **Files** for markup pictures: `Files` (`src/ports/index.ts`); Supabase Storage's is `src/adapters/supabase/files.ts`. Contract: `filesContract`.
- [ ] **Who is viewing:** `Identity`, passed to the app beside the store in `src/main.tsx`. Today the "Who are you?" picker (`src/adapters/local.ts`); your sign-in replaces it with an `Identity` that has no `choose` (`src/adapters/signIn.ts` is the shape; step 4). Outside the demo nobody signed in saves nothing.
- [ ] **The clock:** `Clock`. The system's, or a fixed one for demos and tests.
- [ ] **The AI tools' endpoint:** everything it needs is its `Deps` (`server/mcp.ts`); Supabase's are in `src/adapters/supabase/server.ts`, picked in `server/vercel.ts`. No contract of its own yet.
- [ ] **Research and telemetry:** `src/app/research.ts` (through `src/adapters/supabase/research.ts`), `src/telemetry/` (sends to Supabase's REST address, no client library). Keep, swap for the company's analytics, or drop (`spec/requirements/internal/r9-observability.md`).
- [ ] **A number source** for metrics that fill themselves in: `NumberSource` (the metric library's own port, `src/modules/metrics/source.ts`), with two demo sources (`src/modules/metrics/numbers.ts`: "CI analytics" for the whole company and "CI runner metrics" per team and part, seeded series). A source reads a link's slice (`{ teamId, part }`) or says it doesn't; a company-wide number is never a team's. Real connectors are yours: one per system a metric names as its source, each passing `numberSourceContract`. The rule for a reading in a check-in (`readingState`, `src/modules/metrics/rulesReading.ts`) and the record (`CheckIn.reading`, migration 0047) are built; nothing on screen reads a source until NR2.

### 4. Build what the platform must add

- [ ] **Sign-in and access (R1, R2):** Faro has none on purpose ("Who are you?" is a picker). Plug in single sign-on; enforce R1's who-may-change-what table on the server, kept true by its test; leavers lose access the day they leave.
- [ ] **Time zones (R3):** real moments stored, shown in the viewer's zone, one home zone per workspace.
- [ ] **Scale and safety (R4):** 15,000 people: summaries worked out on the server, paging, page-load budgets, backups and restore, rehearsed migrations.
- [ ] **The organisation (R6a):** teams in a tree from the directory, managers, levels set per workspace, and every list and count scoped to a part of the company.
- [ ] **Delegates (R6b):** someone who checks in and answers asks for an owner who is away, recorded as acting for them.
- [ ] **The planning round (R6c):** next cycle's goals drafted, proposed and agreed before they go live.
- [ ] **Notifications and digests:** not yet written as a requirement (backlog R5).

### 5. Prove it

- [ ] **The rules:** run the drill harness on your build (`spec/rebuild/drill.mjs`) until it scores 100% against the conformance data.
- [ ] **The journeys:** `spec/core/journeys.md` lists what people do end to end; Faro's own checks are in `evals/` if you keep the code.
- [ ] **Each stage's exit criteria** in `spec/rebuild/`.
- [ ] **Each requirement's acceptance checks** in `spec/requirements/internal/`.

### 6. Decide, as an organisation

- [ ] Who owns it.
- [ ] Copy and adapt, or rewrite from the spec.
- [ ] A pilot team.
- [ ] A security review (sign-in, the master key, the AI tools' tokens).

## What Faro still has to do before this is easy

In backlog order (8g and 0c are done: drill 1's gaps are closed, and Faro keeps to its own schema, `faro`, in a shared project rather than a project of its own):

1. **AX:** the architecture readiness review's items (`docs/reviews/2026-11-11-architecture-readiness.md`): every change through the dispatcher (AX2), the query port's first cut (AX5), a stale save run again (AX6), the database as it is in the kit (AX8), browser state behind the ports (AX9).
2. **11:** the full drill. A fresh team or session rebuilds the whole of Faro, stage by stage, from the kit alone.

This page is written by hand. Keep it in step when one of those items ships; `src/docPaths.test.ts` checks that every file it names exists.
