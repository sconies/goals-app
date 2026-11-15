# Core changes for stage 4 (AI access)

Six core files changed. Each change is generic (no module named), except where noted. Before: `m4-ai-access/local/core-before/` (stage 3's rebuild as copied).

| # | File | Change | Why |
|---|---|---|---|
| 1 | `app/state.mjs` | Modules are found in `rebuild/modules/<id>/index.mjs` (each exports `module`); a module's own facts replace `INSTALLED`'s row with the same id. | Stage 3's core imported its one module (example) by name; a module stage had nowhere to register without editing the core. |
| 2 | `platform.mjs`, `app/state.mjs` | An action may be `{ run, whileOff: true }`: the dispatcher then lets the module refuse in its own words. The log takes the action's `entity`/`entityId` and skips a result marked `unchanged`. | The platform refuses every action of a module that is off, but AI access must refuse making a token with “AI access is off in {workspace}.” and must never refuse revoking (rules.md). |
| 3 | `platform.mjs`, `app/server.mjs` | A new place, `settings.you`, drawn in Settings. | Settings shows “Your MCP tokens”, but the kit's places have none on Settings. |
| 4 | `app/pages.mjs` | `people.person` is also given the viewer. | Make an MCP token is for admins; the place is given only the person. |
| 5 | `app/pages.mjs` | Workspace draws a module section's own page (it only drew its link), hides an admins-only section from others (and tells them who the admins are), places a section after the one it names; adds the core's Access section (“Who the admins are.”, the admins A to Z); Features draws a module's third line (`featureLine`) and a read-back slot; `.features-group` and a wrapper on the groups. | U175 and the AI access stage: its section is “after Access”, and Access was missing from stage 3. |
| 6 | `app/server.mjs` | Before `setFeature`, a module's `switchReadBack(app, on)` may answer with a read-back; its button posts `confirm=1`. A module section's address while it is off is Page not found with its sentence. Help articles a module declares are left out of the core's guide list (the module's own is shown while on). `/act/…` follows a `back` field. | Exit criteria 5 and 6; `ai` is in the core's help guide but is the module's article. |
| 7 | `app/mcp.mjs` (names AI access, as the kit keeps it) | The door shuts only when AI access is installed and switched off (built without it, the server stays open); a token is found by `tokenHash` (the data model's name) or the core's `hash`; the tool context carries the token. | Stage 3 shut the door in a build without the module (rules.md: “a build without the module keeps the server open”). |
| 8 | `app/public/style.css` | Features' rows compact (switch beside the name), the three groups side by side on a wide screen, one-line summaries on a phone. | U175: the AI access switch in view without scrolling, on both widths. |

The door, `set_feature`'s last words and the token records stay the core's, as the kit says Faro keeps them (stage page, Gaps in the kit).
