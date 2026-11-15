# Stand-in rebuild: stage 5, Feedback (drill item 11)
(Saved by the drill session from the builder's reply, condensed; the builder's tool could not write report files.)

Core stand-in (`core-standin`) with feedback out of FARO_WITHOUT. Proofs: `platform/prove-feedback.mjs` (API, 41), `platform/ui-feedback.mjs` (screens, 11), `platform/prove.mjs` (core, 36).

## (a) Ported as-is
2,317 of 2,329 files unchanged. All Feedback code runs unchanged: src/modules/feedback/, Feedback.tsx, Inbox.tsx, Markup.tsx, Connect.tsx, the Shell sheet, model.ts (statusPatch, mayTriage, undoChange), ops.ts markupOps, feedback.ts feedbackOps, inboxList.ts, markupTools/feedbackTools, server/mcp.ts picture route, sendFeedback and the off dispatch. The server reruns Faro's markupOps/feedbackOps as the signed-in person, so the status rule is not restated.

## (b) Rewired (12 files, +691 −13; 3 existing Faro files, 39 lines)
| Area | Files | Why |
|---|---|---|
| Existing Faro | src/markup/backend.ts (+14 −7), inboxData.ts (+1 −1), package.json (+1 −1) | under VITE_STANDIN markups and inbox go to the server; the inbox passes its workspace so the server can check the switch and admin |
| Schema | translate-schema.mjs (+36), 0003_feedback.sql (55) | okr_markup_ids, okr_markups translated; inbox_triage_log keeps every triage change |
| Inbox store | src/adapters/standin/inbox.ts (110) | Markup/FeedbackStore on SQLite; pictures on the files API; add only under an issued id, once, untriaged; triage log |
| Browser adapter | inboxHttp.ts (47) | over /api/inbox/ |
| Routes and access | platform/server.ts (+97 −2) | /api/inbox/*; reruns statusPatch/setIssueUrl as the member; off → the page's sentence; feedbackRefusal on /commit |
| AI tools' Deps | deps.ts (+13 −1) | markups/feedback for any live token |
| Proof | standin.test.ts (+57), prove-feedback.mjs (167), ui-feedback.mjs (93) | |

Server checks per record kind, each refusal proved through the API by a non-admin member: feedback via /commit refused while off, as someone else, or changing sent feedback (always arrives New); markups only under a server-issued id, once, sender/workspace/status set by the server; triage admins only (3 API, 2 MCP refusals); switching off admins only.

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Inbox store outside any workspace, with triage fields | NAMED | stage-5:15; schema.sql:188, 314-368 |
| Files for pictures, never listable | NAMED | MARKUP; adapters.md:23, 59; R4 rule 5 |
| Pictures only to the allowed, short-lived addresses | NAMED | R4 rule 7; R1 rule 6 |
| Anyone sends feedback | NAMED | r1:98 |
| Admins triage, on the server | NAMED | r1:100; r5:38; stage-5:38 |
| Which admin, for an inbox across workspaces | GAP | r1:100, r5:38 vs R5 rule 9 per workspace |
| Feedback only added, by the sender, always New | GAP (plpgsql only) | okr_feedback_add (schema.sql:923) |
| Markup only under an issued id | NAMED | MARKUP |
| Every triage change kept | NAMED, no shape | stage-5:15 points to fakeSupabase |
| Inbox server door answering the off sentence | NAMED | module-platform.md:51; stage-5 exit 4 |
| Browser↔server API for the inbox | GAP | as core GAP 5 |
| Demo markups on a platform whose demo has no session | GAP | MARKUP |
| AI tools' inbox for any token | NAMED | MCP-FEEDBACK, MARKUP-INBOX, R1 rule 6 |
| Module code still the core's | NAMED | stage-5:36 (SW4); inboxHttp chunk ships even without Feedback |

## (d) Behaviour
- typecheck, lint:layers pass; npm run spec no drift. npm test 2,209 pass, 9 failed only on time limits under load 17, all 9 pass on rerun (126/126). standin.test.ts 39 (markupContract and feedbackContract on the SQLite inbox).
- drill-faro 100% (462,003 cells), contracts 56/56. No module conformance CSV.
- Exit 1 PART (all requirements MET except CONNECT-CLAUDE not exercised: making a token is AI access's, left out; "anyone, no sign-in" replaced by members, R1 rule 9). Exit 2 PART (journeys not run through evals, which drive Faro's own build; their Feedback steps proved on the stand-in: U41, U42, U47, U165, N22; U40, U52, U53 not exercised; no failure is class names or wording). Exits 3, 4, 5 MET (menu and key off; pages and eight tools answer the sentence; sending refused, what was sent stays, back on restores, pictures load after a restart).
- Left out: core proof 36/36, /api/inbox 404, /mcp 53 core tools, feedback rows refused. In: core 36/36.

## One-line kit fixes
- r1:98: "(only ever added, by the person signed in, always New: okr_feedback_add)".
- r1:100: say which admin triages an inbox across workspaces.
- stage-5:15: name the triage history's shape (item, status, fixed_in, reason, issue_url, by, at).
- adapters.md:23-24: "a server-side store must rerun statusPatch as the signed-in person; the browser's admin is only a courtesy".
- src/markup/backend.ts inboxOps(): take the workspace id.
- MARKUP: say what a platform with no public key does with demo markups.
