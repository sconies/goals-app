# Working on this repository

- **Design:** read `docs/design-rules.md` before changing anything visual. It must not look like a default AI interface. In particular:
  - no coloured edge stripes on cards, rows or tiles;
  - no quote bars;
  - no emoji icons;
  - no pastel pill badges.

  Status is always a shape plus a word. `npm run evals` enforces these rules (design check P6).
- **Quality gate:** nothing is pushed until `npm run typecheck`, `npm test` and `npm run evals:smoke` pass locally, plus the targeted F/N/journey checks for the areas changed (`FINISH=…` / `ONLY=…`). The full suite (`npm run evals`) runs in parallel shards on main after merge; a failure opens an issue that is fixed or reverted straight away. Run the full `npm run evals` locally when changing shared layout, styles or the eval harness itself. New features come with their own evals.
- **Help and What's new:** every change people can see adds an entry at the top of `src/help/whatsNew.ts` and updates the guide in `src/help/guide.ts` (an article per screen; new screens, routes and requirements need one, checked by `src/help/guide.test.ts`). CI fails a pull request that changes `src/` or `supabase/migrations` without touching What's new; a pure refactor says `[no news]` in a commit message.
- **Language:** plain British English. The UI is low density and calm, with one primary action per screen.
- **Rules live once:** status rules, check-in rules and the bulk-change engine are shared by the app, the import and the MCP server. Don't restate them.
- **Database:** migrations live in `supabase/migrations`. A paste-in script for the ones not yet applied lives in `supabase/manual`. Apply migrations before merging code that needs them.
- **MCP:** after changing `server/` or anything it imports, run `npm run build:mcp` and commit `api/mcp.js`.
- **Architecture:** a modular monolith (`docs/architecture.md`). Build new features as modules that register into the core's extension points; keep `src/domain` free of database, screen and network code; no microservices.
- **Ideas go to the backlog, not straight into code (Lane, 7 Nov):** when Lane shares an idea, a request or something he spotted, don't start building it. Add it to `docs/backlog.md`, place it in the priority order (value, effort, and what it depends on or unblocks), and tell him where it landed. Build only when he picks an item, says "build/do/start it", or it's the next item he has approved. Questions get answered; they don't become work. Bugs that break main or a merged release are the exception: fix those at once.
- **Supabase changes:** Lane applies SQL himself in the SQL editor on his phone. Hand it over as plain `.txt` files of at most about 5 KB each, split at statement boundaries, tested in order on a scratch database first.
