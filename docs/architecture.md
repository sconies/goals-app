# Architecture: a modular monolith

Decided with Lane on 7 November 2026. Faro is one deployable app with one database, built as a small core plus feature modules. It is not split into microservices.

## The parts

| Part | What it holds |
|---|---|
| Core | People, teams, goals, plans, check-ins, the status rules, the vocabulary (`src/domain/vocabulary.ts`) and the change engine, including undo and history |
| Extension points | Pages, navigation, Home blocks, goal-page sections, settings, database tables, AI tools, Help articles, requirements and journeys |
| Feature modules | One folder each, with a manifest saying what it adds and what it needs. Examples: reviews, asks, Watching, the goal map, markup and inbox, spreadsheets, observability |
| Background jobs | Separate processes only where work runs on a schedule or after saves: summary rows (release 4b), alerts and the weekly review (release 5), and the AI assistant server (`api/mcp.js`). Each one reuses the shared rules and never restates them |

## Rules

- **Build new features as modules.** Every new feature is a module that registers into the extension points. It never edits the core to wire itself in.
- **One direction of dependency.** The rules layer (`src/domain`) has no database, screen or network code. Modules depend on the core; the core never depends on a module.
- **Declare dependencies.** A module lists the modules it needs in its manifest. For example, reviews need asks.
- **Switch features per workspace.** Each feature can be turned on or off for a workspace.
- **Prove it in CI.** CI builds Faro with each optional module removed and runs the core journeys.
- **Wrap the outside world.** The database, clock, sign-in and files each sit behind one interface, with a contract test any replacement must pass.

## Why not microservices

Faro is one product with one data model, and its features all read the same goals and check-ins. Separate services would add:

- network calls between features;
- copies of the same data;
- harder testing and debugging.

They would also make Faro harder for another AI to understand and rebuild. A module can still be lifted out into its own service later if a real need appears, because its boundary is already clean.

## Where it stands

Today Faro is a monolith with partial boundaries:

- Markup lives mostly in one folder.
- Reviews touch about 90 files across nine folders.
- Three rules files reach into the data layer.

Moving to modules is item 0 in `docs/backlog.md`. The order is:

1. Set up the pattern first.
2. Move existing features over one at a time, markup first and reviews last.
