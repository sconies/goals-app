# Brief: rebuild one module from the kit

You are a fresh rebuild session in Faro's full rebuild drill. You add ONE module, on its own, to a core rebuild (stages 1 to 3) that already passes.

## Isolation (strict)
Work only inside this folder (FOLDER). Never read or list anything outside it: not /home/user/goals-app, not other scratchpad folders, no git, no web. Never read expected conformance CSVs to learn behaviour (you may run the harness and fix from its diffs; each behaviour learned from a diff is a gap). Links to src/, docs/, evals/ can't be followed: that is a gap, write it down.

## Read
spec/rebuild/README.md, spec/rebuild/lessons.md, your stage page (spec/rebuild/stage-N-module-<m>.md), and spec/modules/<m>/ (its rules, screens, journeys, requirements, conformance rows if any). The core is in rebuild/ (start with rebuild/GAPS.md and rebuild/JOURNEYS.md to see what the core has and lacks; the app is rebuild/app/server.mjs).

## Build
- The module in rebuild/modules/<m>/, registering into the core's extension points. List every core file you changed, and why, in rebuild/modules/<m>/CORE-CHANGES.md (a core that needed changing for a module is itself a finding).
- A switch: the module is off when the workspace's `modulesOff` holds its id. With it off: no menu row, no Home card, no MCP tool answers (they refuse with the module-off sentence), and the import says once what it didn't read, as the kit says.
- rebuild/modules/<m>/exit.test.mjs: one test per exit criterion on the stage page, run with the module on and with it off, using `node --test`. Name each test after its criterion number.
- Stages 1 to 3 must still PASS with the module in, on and off: `node spec/rebuild/drill.mjs rebuild`.
- Where the module has journeys, try each against your running app (Playwright is pre-installed: require('playwright') works anywhere) and tally DONE / PART / NOT BUILT in rebuild/modules/<m>/JOURNEYS.md.
- rebuild/modules/<m>/GAPS.md: one row per gap (what the kit didn't say or said wrongly, the evidence, which page should say it, GUESSED-RIGHT / LEARNED-FROM-DIFF / UNPROVEN / NOT-IN-KIT).

## Reply (under 400 words)
Each exit criterion with MET / PART / NOT MET; the harness result with the module on and off; the journey tally; the number of core files changed; the gaps, one line each.
