# Goals

An internal goals (OKR) tool for team leads, built slice by slice. It grew out of the clickable prototype and keeps its design. Status rules come from the build spec.

**Slice 1: goals, plans and check-ins.** In this slice a lead can:

- create a goal of one of three types: move a metric along a plan, keep within a range, or reach dated milestones;
- connect input goals to a headline goal across teams;
- post a weekly check-in that follows the spec's rules: the reason, the path to green, and the greener-call flag;
- read each goal on its own page.

The app runs on demo data from an AI-native developer platform. That data sits seven weeks into a live 13-week cycle, wherever today falls.

## Run it

```
npm install
npm run dev          # http://localhost:5173
```

Pick a person under **Demo · viewing as** in the sidebar. Maya Chen owns the headline goal, Leo Park owns a slipping milestone, and Sam Patel's goal is well ahead. **Reset demo data** starts again.

Add `?today=2026-10-30` to the URL to pin the clock.

## Check it

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the rules, the demo data, the browser store and the database schema (in PGlite, real Postgres) |
| `npm run typecheck` | TypeScript, strict |
| `npm run evals` | The eval suite: the spec scenarios and the browser journeys, written up as a scorecard in `evals/report.md` |

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
src/domain/     the rules: plans, forecast, status per goal type, check-in requirements, goal validation (pure, tested)
src/data/       demo data, the store contract and the browser store
src/screens/    Check-in, Goals, Goal page, Goal editor
src/ui/         shell, status chips (shape + word), charts
supabase/       the Postgres schema for when the data moves to Supabase
evals/          requirements, scenarios, journeys, runner, latest report
```

## Data

The app has two stores behind one contract, `Store` in `src/data/store.ts`:

- **Shared data (Supabase).** Used when `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` are set; copy `.env.example` to `.env` to use them. The data lives in the `okr_` tables of the family-hq project. The first load into empty tables seeds the demo data. Add `?store=browser` to the URL to work on a private copy instead.
- **Browser only (`BrowserStore`).** Used when those values are not set, and always by the evals.

The schema in `supabase/migrations/` enforces these invariants itself:

- one check-in per goal per week;
- a path to green for At risk and Off track;
- a reason for a greener call;
- one headline goal per cycle.

`0002_demo_access.sql` lets the app's public key read and write the `okr_` tables, and only those, until sign-in arrives. The demo data is invented. Anyone with the page can change it, so don't enter real goals until sign-in arrives.

## Not in this slice yet

- Leadership view and team review
- Target-change approval
- Dependencies
- Jira context
- Slack
- AI drafts (beta)
- Key-goal flags
- Data integrations
- Sign-in

All numbers in the demo data are invented.
