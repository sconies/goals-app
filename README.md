# Faro

Faro is a goals (OKR) tool that keeps a large organisation's goals honest week by week. It shows each person what needs them now, without anyone having to chase. It is also a model: built to be copied by an internal team, with a spec generated from its code. It never holds real company data.

The live demo, https://goals-app-puce-five.vercel.app/demo, needs no sign-in.

## The problem it solves

In most organisations, goals are set with care and then go quiet:
- Status is a colour someone picks, so it drifts green until the quarter ends.
- When a goal slips, nobody has to say what will bring it back.
- Questions and decisions get lost in chat.
- Reviews are spent reading slides instead of deciding.
- Leaders can't see which of hundreds of goals actually need them.

## How it works: one weekly loop

1. **Set a goal with a plan.** Every goal has one owner and is one of three kinds:
   - a number to move from a start to a target;
   - a number to keep within a limit;
   - dated stages.

   The plan says where the number should be in every week of the year. Goals sit at levels, from the north stars down to teams, and lower goals feed the ones above.
2. **Check in each week.** The owner gives the number and their own call on the status. It takes about a minute.
3. **The numbers give a second opinion.** Faro works out from the plan what the numbers say:
   - on track at 95% of the planned progress or more;
   - at risk from 80%;
   - off track below that.

   It shows this beside the owner's call, and it projects where the goal will land. A call greener than the numbers needs a reason. A goal at risk or off track needs a path back to green. A goal with no check-in for two weeks is marked as having no recent update.
4. **What needs attention is flagged until someone acts.** A slipping goal stays on the list until an action with an owner and a due week is agreed. Marking it as seen is not enough.
5. **Asks go to one person and wait in plain sight.** Questions, requests for a decision or help, and agreed next steps each go to one person. They wait, with their age showing, until that person answers.
6. **Reviews only cover what needs a decision.** A review walks a set of goals on a cadence, decides what happens next and keeps what was said.
7. **The year closes with a wrap-up.** Each owner says how their goals landed and what they learned.

**Home** starts every day with the one thing asked of you, then what's waiting on you, your goals, your team and the goals you watch. When nothing is asked of you, Home says so in one line, with no big button.

## The ideas behind it

- **Status is the owner's call, checked against the numbers.** People stay accountable for their judgement, and the numbers keep it honest.
- **Bad news asks for a plan, not an apology.** Behind means saying why and how you get back.
- **Something is handled only when someone owns the next step.**
- **The same rules everywhere.** Check-ins, statuses, flags and bulk changes follow one set of rules, whether a change comes from a screen, a spreadsheet or an AI tool acting for a person through MCP.
- **Every save is on the record.** It says who, when, and each field's before and after. Changes can be undone.
- **Calm by design.** One main action per screen, plain British English, and status always shown as a shape and a word, never colour alone.

## Who sees what

Everyone is a person in a workspace. Admins add people, teams and features and look after the workspace; everyone else is a member. There are no fixed profiles. What a person sees comes from what they own, lead, watch or are asked about, and from which reviews they run:
- a **leader** sees what needs them, from the north stars down;
- an **owner** sees their check-ins;
- a **watcher** sees the goals they follow.

## Core and modules

The core is always on:
- goals and plans;
- check-ins;
- the status rules;
- flags;
- asks;
- Home;
- the Goals and Data lists;
- the change log.

Each module is self-contained and an admin can switch it off under Workspace → Features:
- **Metric library**: each number defined once and verified.
- **Spreadsheets**: export and import, with every change shown first.
- **Reviews**.
- **Watching**.
- **Wrap-up**.
- **Goal map**.
- **Fields**: a workspace's own fields on goals.
- **AI access**: MCP.
- **Feedback**.

The full map is in [docs/architecture/module-map.md](docs/architecture/module-map.md).

## Try the demo

Open https://goals-app-puce-five.vercel.app/demo, or `/demo` locally. It is one invented division of about 100 people in 14 teams, with 12 north stars and a year of history. Open **Demo** (the sidebar on a computer, the header on a phone) and choose a person under **See it as**. Good places to start:
- **Grace Achterberg** (admin): sets up and looks after the workspace.
- **Amara Nwosu** (leader, the division's VP): what needs a leader, from the north stars down.
- **Rhea Kapoor** (owner): runs CI/CD and owns the lead-time north star, with a check-in due.
- **Oskar Lindgren** (member): watches goals; the view of someone who isn't an admin.

Find anyone else under **Everyone else**. The same panel has:
- **Show me how**: walkthroughs;
- **Start over**: admins only;
- **Present without the controls**;
- **Leave the demo**.

Add `?today=2026-10-30` to the address to pin the clock.

## A model to copy

Faro exists so that an internal team can rebuild it on their own platform. The words, rules, screens and journeys are in `spec/` and `llms.txt`. Both are generated from the code and checked in CI, so they say what the code does. The rebuild kit in `spec/rebuild/` takes a team through it stage by stage: the core first, then each module on its own.

Faro deliberately leaves out what the platform provides:
- sign-in and access;
- single sign-on;
- scale;
- notifications;
- audit;
- observability;
- the rest.

Each of these is a requirement in `spec/requirements/internal/`. A porting team starts at [docs/handoff.md](docs/handoff.md).

The name: a faro is a lighthouse. The logo's F is a dark stem with an amber beam and a teal bar (`src/ui/Brand.tsx`, `public/favicon.svg`). The repository and package keep the name `goals-app`.

## Run it

```
npm install
npm run dev          # http://localhost:5173
```

Then open http://localhost:5173/demo.

## Check it

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the rules, the demo data, the browser store and the database schema (in PGlite, real Postgres) |
| `npm run typecheck` | TypeScript, strict |
| `npm run evals` | The eval suite: the spec scenarios, the core journeys scored on the ease test (phone and desktop), and checks on the design, accessibility and platform, written up in `evals/report.md` |

### The evals

`evals/requirements.json` lists every requirement with an ID, for example `STATUS-BANDS` or `PATH-TO-GREEN`. Every eval is tagged with the IDs it checks, and the scorecard marks each requirement pass, fail or untested.

- **Spec scenarios** (`evals/scenarios.eval.ts`) state each rule in plain numbers, including the boundaries: 95%, 94.9%, 80%, 79.9%, 120%, 13 versus 14 days, and two versus three weeks late.
- **Browser journeys** (`evals/journeys.cjs`) drive the built app in Chromium the way a person would, for example:
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
src/domain/     the rules: plans, status, check-ins, attention, review, change log, progress, import, one goal row for every list (`goalRow.ts`), one form footer (`formFooter.ts`) and one page header (`pageHeader.ts`) (pure, tested)
src/data/       demo data, the store contract, the browser and Supabase stores
src/app/        app state (workspaces, people, saves that log) and drafts
src/screens/    Home, Check-in, Review, Goals, Goal page, Goal setup, Activity, Workspace
src/modules/    feature modules, one folder each (see docs/architecture/module-map.md for what each holds)
src/ui/         shell, status chips (shape + word), progress ring, charts
docs/           architecture, the handoff, the backlog and working notes
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

## Handing Faro to the internal team

The team can build Faro core first, then each module on its own (`docs/architecture/module-map.md`). Every module has its own spec section, conformance rows, rebuild stage and switch. The full drill moved Faro onto a stand-in platform (Node, SQLite and its own sign-in). The rules, screens and modules ported as they were; sign-in, the store, migrations, the AI tools' server and file handling were rewired (`docs/drill/2026-11-full-drill.md`). The server on the new platform must enforce R1 (who may change what) for each kind of record, against the stored rows; Faro's browser store does not. The running app and the code are the reference. Start at `docs/handoff.md`.

## Not in Faro

- **What the platform provides:**
  - sign-in and per-person permissions;
  - single sign-on;
  - notifications such as Slack check-in cards and reminders;
  - links to the systems numbers come from.

  Each one is a requirement in `spec/requirements/internal/`.
- **Ideas not built:** Jira context and AI coaching on a draft check-in.

All numbers in the demo data are invented.
