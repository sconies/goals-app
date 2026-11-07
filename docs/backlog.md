# Backlog

Lane's ideas and the follow-ups found along the way, in the order they should be built. A new idea is added here first, never built straight away; it is built when Lane picks it or approves the next item.

**How items are ordered:** by what they unblock first, then value against effort. Effort: S (under a day), M (a release), L (more than one release).

**In progress:** release 3, one spreadsheet format (approved 6 Nov).

## Up next, in order

| # | Item | Why here | Effort | Depends on | Source |
|---|---|---|---|---|---|
| 1 | **Release 4a: sign-in and access.** Email-link sign-in for everyone, workspace membership, access rules in the database, server-made AI tokens | Faro can't hold real data until anyone can't read everything; everything after needs real identity | M | Release 3 (person emails) | Plan, 6 Nov; decided 7 Nov |
| 2 | **Release 4b: scale.** Summary rows worked out on the server, paging, code split by screen, only visible rows drawn, speed checks in CI | 15,000 people would download about 1 GB per open today | L | 4a | Plan, 6 Nov |
| 3 | **Time zones (with release 4).** Real moments stored and shown in the viewer's zone, home zone per workspace, the AI in the person's zone, reviews with a time and zone | Cross-region companies see wrong orders and weeks today | S–M | 4a | Lane's question, 7 Nov |
| 4 | **On-track goals flagged "Getting worse" or "Greener than calculated" show the At risk half-circle on Home** | Breaks "status is a shape plus a word": the shape says At risk while the word says On track | S | Nothing | Found in release 2, 7 Nov |
| 5 | **The AI can triage feedback** (list, read, update, like markups) | Parity rule: everything a person can do, the AI can do | S | Nothing | Found in release 1b merge, 6 Nov |
| 6 | **"You raised this" for feedback**, as markups already have | Closes the loop for people who send feedback, not just markups | S | Nothing | Found in release 1b merge, 6 Nov |
| 7 | **Exports drop a stopped goal's forecast fields** | Exports still show a forecast the goal page no longer makes | S | Release 3 (one export format) | Found in release 1b merge, 6 Nov |
| 8 | **Watching on a phone: Oskar's watched goals start below the first screen** (U9 scores 8.9) | The only journey below 10 | S | Nothing | Evals, since 5 Nov |
| 9 | **Release 5: observability.** Overlay, Observability page, troubleshoot right, weekly Claude review, alerts | Needs real identity; data protection sign-off needed before recording anyone | M | 4a, data protection sign-off | Plan, 6 Nov |
| 10 | **Company single sign-on** (Entra ID, Okta or Google) in place of email links | When IT is ready; the app doesn't change | S | 4a, IT | Decided 7 Nov |
| 11 | **Release 6: rebuild kit** | Captures the finished product, so it goes last | M | Everything above | Plan, 6 Nov |

## Done

| Item | Shipped |
|---|---|
| Release 2: one meaning for every status word | PR #32, 7 Nov |
| Release 1b: remove, archive and undo anything | PR #31, 6 Nov |
| Release 1: screen markup, builder inbox, server-made tokens | PR #31, 6 Nov |
| Full evals green again | PR #30, 6 Nov |
| Goal page scorecard | PR #28, 6 Nov |
| Faro rebrand | PR #26, 6 Nov |
