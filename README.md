# Faro

Faro is an internal goals (OKR) tool for team leads, built slice by slice from the prototype and the build spec. A faro is a lighthouse: the logo's F is a dark stem with an amber beam and a teal bar (`src/ui/Brand.tsx`, `public/favicon.svg`). The repository and package keep the name `goals-app`.

**Slice 2: profiles, journeys and the change log.**

- **Four profiles:** team lead, sponsor, goals coach and contributor. Each has its own home and its own next thing to do.
- **Ten user journeys:** the top five score 10/10 on the ease test, on both phone and desktop. See [docs/journeys.md](docs/journeys.md).
- **Change log:** every save (goal, plan, check-in, note, decision, workspace) records who, when, and each field's before and after. Drafts are kept as you type but never logged.
- **The habit (core, no switch):** the on-time run, which forgives one late or missed week after four on time; the check-in's receipt; a target reached or back on track, said once. The rules are in `src/domain/progress.ts` and `habit.ts`; `get_my_work` and `post_check_in` give the same words.
- **Guardrails (core, no switch):** a goal can name up to five goals kept in a range that guard it; a guard past its limit makes it at risk, two weeks running off track, and the check-in and the goal's page say which guard and by how much (`src/domain/guards.ts`).
- **Workspaces:** the example data and your own, loaded from a spreadsheet, kept apart, with a switcher between them.

## Run it

```
npm install
npm run dev          # http://localhost:5173
```

Pick a role in the **Viewing as** bar at the top; each role opens its own home. Use the name beside it, or the avatar, to pick a specific person. Good places to start:

- **Maya Chen** (team lead): owns the headline goal, with a check-in due.
- **Elena Ruiz** (sponsor): has a review queue waiting.
- **Priya Nair** (goals coach): can load your own data.
- **Tom Reid** (contributor): follows his team's goals.

**Workspace → Reset the example** starts the example again.

Add `?today=2026-10-30` to the URL to pin the clock.

## Check it

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the rules, the demo data, the browser store and the database schema (in PGlite, real Postgres) |
| `npm run typecheck` | TypeScript, strict |
| `npm run evals` | The eval suite: the spec scenarios, the ten user journeys scored on the ease test (phone and desktop), and platform checks, written up in `evals/report.md` |

### The evals

`evals/requirements.json` lists every requirement of this slice with an ID, for example `STATUS-BANDS` or `PATH-TO-GREEN`. Every eval is tagged with the IDs it checks, and the scorecard marks each requirement pass, fail or untested.

- **Spec scenarios** (`evals/scenarios.eval.ts`) state each rule in plain numbers, including the boundaries: 95%, 94.9%, 80%, 79.9%, 120%, 13 versus 14 days, and two versus three weeks late.
- **Browser journeys** (`evals/journeys.cjs`) drive the built app in Chromium the way a lead would:
  - post, edit and reload;
  - get blocked until a reason and a path to green are given;
  - make a greener call;
  - propose a higher target;
  - record a slipping milestone;
  - create a goal;
  - re-baseline a plan;
  - see a stale goal;
  - confirm only the owner can post.

  They also check every screen at 390px with no horizontal scroll, run axe-core accessibility checks on desktop and phone, and confirm no console errors.

The scenarios were checked against deliberately broken rules (a different on-track threshold, stale window, lateness limit or breach rule); each break failed at least one scenario.

## Where things are

```
src/domain/     the rules: plans, status, check-ins, attention, review, change log, progress, import (pure, tested)
src/data/       demo data, the store contract, the browser and Supabase stores
src/app/        app state (workspaces, profiles, saves that log) and drafts
src/screens/    Home (per profile), Check-in, Review, Goals, Goal page, Goal setup, Activity, Workspace
src/modules/    feature modules, one folder each: Spreadsheets (Excel and CSV export, and import with every change shown first), the Metric library (each number goals are measured by, defined once) Reviews (walking a set of goals together on a cadence; its screens and rules are still in the core until FT3), and four more switches whose screens are still the core's: Watching (following goals you don't own), the Wrap-up (how each goal landed at the year's end), the Goal map (Goals' map layout) and Feedback (sending feedback and the builders' inbox); and Fields (a workspace's own fields on goals, such as a stage: Workspace → Fields, a Fields block on each goal's page, a filter per list field on Goals and in saved views (`?f.<field id>=Build`), a column per field on Data and every Goals sheet, which loads back and asks once about a value a list doesn't hold, and its AI tools, find_goals' `fields` among them)
src/ui/         shell, status chips (shape + word), progress ring, charts
docs/           the user journeys and the ease test
supabase/       the Postgres schema for when the data moves to Supabase
evals/          requirements, scenarios, journeys, runner, latest report
```

## Data

The app has two stores behind one contract, `Store` in `src/data/store.ts`:

- **Shared data (Supabase).** Used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` are set; copy `.env.example` to `.env` to use them. The data lives in the `okr_` tables of the family-hq project, in Faro's own schema, `faro`, fenced off from the other app there (backlog 0c, `docs/architecture.md`), and every row carries its workspace. The first load into empty tables seeds the example. Reads are paged past Supabase's 1,000-row limit, requests time out after 12 seconds with a Try again screen, and failed saves say so. Add `?store=browser` to the URL to work on a private copy instead.
- **Browser only (`BrowserStore`).** Used when those values are not set, and always by the evals.

The schema in `supabase/migrations/` enforces these invariants itself:

- one check-in per goal per week;
- a path to green for At risk and Off track;
- a reason for a greener call;
- one headline goal per cycle;
- the change log can be added to but never edited (only the example's log is cleared when it is reset).

`0002_demo_access.sql` lets the app's public key read and write the `okr_` tables, and only those, until sign-in arrives. The demo data is invented. Anyone with the page can change it, so don't enter real goals until sign-in arrives.

## Not built yet

- Closing the cycle with a retro (journey 10)
- Dependencies between goals
- Jira context
- Slack check-in cards and reminders
- AI coaching on a draft (beta)
- Sign-in and per-person permissions
- Data integrations

All numbers in the demo data are invented.
