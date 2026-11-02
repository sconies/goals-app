# Working on this repository

- **Design:** read `docs/design-rules.md` before changing anything visual. It must not look like a default AI interface. In particular:
  - no coloured edge stripes on cards, rows or tiles;
  - no quote bars;
  - no emoji icons;
  - no pastel pill badges.

  Status is always a shape plus a word. `npm run evals` enforces these rules (design check P6).
- **Quality gate:** nothing is pushed until `npm run typecheck`, `npm test` and `npm run evals` all pass with no regressions. New features come with their own evals.
- **Language:** plain British English. The UI is low density and calm, with one primary action per screen.
- **Rules live once:** status rules, check-in rules and the bulk-change engine are shared by the app, the import and the MCP server. Don't restate them.
- **Database:** migrations live in `supabase/migrations`. A paste-in script for the ones not yet applied lives in `supabase/manual`. Apply migrations before merging code that needs them.
- **MCP:** after changing `server/` or anything it imports, run `npm run build:mcp` and commit `api/mcp.js`.
