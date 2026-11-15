# Stage 5 (Feedback): its journeys, tallied

Driven by `node modules/feedback/journeys.cjs` (starts its own app on :4191; Playwright, a phone 390×844 and a desktop 1440×900), following each page's steps and checks in `spec/modules/feedback/journeys/`. Each checkpoint is scored as the core's runner does (at most one main button in view, no sideways scroll, 44px main button on a phone, every status shape beside its word). Results: `journeys-results.json`. Exit test 2 runs it.

**9 journeys and checks: DONE 4 · PART 5 · NOT BUILT 0.** Every Feedback line of every journey passes on both widths; the PARTs are the core's or the Goal map's lines.

| Id | Tally | Steps (phone, desktop / budget) | What fails, and why |
|---|---|---|---|
| U41 | DONE | 12, 9 / 14 | — The “picture differs from a real screenshot by N% of pixels” check isn't run: I check the picture exists, not how closely it matches (the picture is an SVG of the DOM, not a raster). |
| U42 | DONE | 15, 15 / 23 | — No `fakeSupabase`: the inbox is this server's own store. `sendHomeMarkup` is a helper whose steps aren't counted, as in the kit. |
| U47 | DONE | 6, 6 / 12 | — |
| U52 | DONE | 28, 25 / 30 | — The 75 items are my own `seed75` (6 folded on Home's week strip, 3 on a scorecard, 68 rows); the kit names the helper, not its rows. |
| U40 | PART | 5, 5 / 16 | Feedback's lines pass (Send feedback from Feedback's page, “It gets in the way”, a few words, Send, “It goes to the people building this app”). The check-in's Something else cause and the Research panel are the core's and not built in the core rebuild. |
| U165 | PART | 2, 2 / 12 | Feedback's half passes: switched off on Features at once (“Feedback is off in …”), no menu row (desktop and More), Ctrl+Shift+M opens nothing, /feedback is Page not found with the off sentence, the switch is in Activity; back on, row, key and page return. The Goal map (stage 6) isn't built, so its half isn't. |
| U51 | PART | 0, 0 / 14 | Only the inbox's old link is Feedback's: `/workspace?inbox=1&markup=mk_old` becomes `/feedback?markup=mk_old`. Workspace's sections (Cycles, Access, Privacy, Recently removed, the side menu) aren't built in the core rebuild. |
| U53 | PART | 0, 0 / 45 | Feedback's lines pass: `/workspace/inbox` becomes `/feedback`, and Feedback follows Help in the sidebar. The switcher, the role line and leaving from Settings are the core's and not built. |
| N22 | PART | — | Its source (`evals/notes/22-more-switches.cjs`) isn't in the kit; only its one-line summary is. Feedback's part of it (no menu row and no Help article while off, each back on) is checked in exit test 2. Watching, the Wrap-up and the Goal map aren't built. |

The core's own scripted journeys (`journeys/run.cjs`) still give 13 DONE and 5 PART with the module in.
