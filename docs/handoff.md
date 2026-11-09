# Handing Faro to the internal team

What the internal team needs to take Faro onto the company's platform, and how far Faro has got in making it easy. It is written for the team that will do it. Faro is a model to copy, not a product: it never holds real data, and some things are left to the platform on purpose.

**Two ways to do it.** *Copy and adapt:* take the code, swap its outside parts for the company's, build what the platform must add. *Rewrite from the spec:* build fresh from `spec/` and `llms.txt`, proving each stage with the rebuild kit. Either way, the spec says what Faro does, and the conformance data says when a rebuild gets the rules right.

## What you get

| Part | Where | State (9 Nov) |
|---|---|---|
| What Faro does, generated from the code | `llms.txt`, `spec/` | Complete for the core and both modules; can't drift (CI) |
| The rules, with worked examples | `spec/core/rules/`, `spec/modules/*/rules.md` | Complete |
| Expected results for every demo goal in every week | `spec/conformance/` | Status, flags, projection, scorecard; the check-in rule has examples but no rows yet (8g) |
| The rebuild kit, stage by stage | `spec/rebuild/` | Stage 1 (the rules) has a drill: 100% from the kit alone, 8 Nov. Stages 2 to 5 are outlines, checked by hand |
| What the platform must add | `spec/requirements/internal/` | R1 sign-in and access, R2 single sign-on, R3 time zones, R4 scale and safety, each with acceptance checks |
| How it's built | `docs/architecture.md` | A modular monolith: a core plus modules, one app, one database |
| The code | this repository (public) | React and Vite app, one Node endpoint for the AI tools (`api/mcp.js`), Postgres |

## The checklist (copy and adapt)

Each line says what you do and what Faro gives you for it.

### 1. Run it

- [ ] **Host the web app** (static files from `npm run build`) and **one Node endpoint** (`api/mcp.js`, the AI tools). Nothing depends on Vercel.
- [ ] **Settings:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (the browser's), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the endpoint's; used only to sign markup pictures). They change names when the adapters change (step 2).

### 2. Swap the outside parts

Today these are wired to Supabase. **Backlog 8c** puts each behind one interface with a contract test, and proves it with a second, plain-Postgres adapter; until then, this step is untangling.

- [ ] **The goals store:** the `Store` interface (`src/data/store.ts`); Supabase version `src/data/supabaseStore.ts`, browser version for the demo. Write one for the company's database or data service.
- [ ] **The database itself**, if you keep Postgres: 33 migrations in `supabase/migrations`, including 44 functions that hold real logic (`okr_write` and `okr_commit` for saves, tokens, the inbox, telemetry). They assume Supabase's roles (`anon`, `authenticated`) and row rules; on plain Postgres those become your service's checks.
- [ ] **Markup and feedback stores:** `src/markup/backend.ts`, `stores.ts`, `feedback.ts`.
- [ ] **File storage** for markup pictures (one bucket, `markups`).
- [ ] **The AI tools' endpoint:** `server/vercel.ts` talks to Supabase directly today; 8c moves it behind the same store.
- [ ] **Research and telemetry:** `src/app/research.ts`, `src/telemetry/`. Keep, swap for the company's analytics, or drop (`spec/requirements/internal/observability.md`).
- [ ] **A number source** for metrics that fill themselves in (8c adds the interface and one demo source; real connectors are yours).

### 3. Build what the platform must add

- [ ] **Sign-in and access (R1, R2):** Faro has none on purpose ("Who are you?" is a picker). Plug in single sign-on; enforce R1's who-may-change-what table on the server, kept true by its test; leavers lose access the day they leave.
- [ ] **Time zones (R3):** real moments stored, shown in the viewer's zone, one home zone per workspace.
- [ ] **Scale and safety (R4):** 15,000 people: summaries worked out on the server, paging, page-load budgets, backups and restore, rehearsed migrations.
- [ ] **Notifications and digests:** not yet written as a requirement (backlog R5).

### 4. Prove it

- [ ] **The rules:** run the drill harness on your build (`spec/rebuild/drill.mjs`) until it scores 100% against the conformance data.
- [ ] **The journeys:** `spec/core/journeys.md` lists what people do end to end; Faro's own checks are in `evals/` if you keep the code.
- [ ] **Each stage's exit criteria** in `spec/rebuild/`.
- [ ] **Each requirement's acceptance checks** in `spec/requirements/internal/`.

### 5. Decide, as an organisation

- [ ] Who owns it.
- [ ] Copy and adapt, or rewrite from the spec.
- [ ] A pilot team.
- [ ] A security review (sign-in, the master key, the AI tools' tokens).

## What Faro still has to do before this is easy

In backlog order:

1. **8g:** close drill 1's gaps, so the spec carries the scorecard's exact words and the check-in rule has conformance rows.
2. **0c:** Faro's own database project, so nothing it does can touch another app's data.
3. **8c:** swappable parts. This is what turns step 2 from "find where Supabase is woven in" into "write about five adapters until their contract tests pass".
4. **11:** the full drill. A fresh team or session rebuilds the whole of Faro, stage by stage, from the kit alone.

This page is written by hand. Keep it in step when one of those items ships.
