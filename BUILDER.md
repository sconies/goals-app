# Module builder (drill item 11)
You rebuild one Faro module from its kit alone. Never read Faro's source (/home/user/goals-app, or S/pin's src/, server/ etc.). S = /tmp/claude-0/-home-user-goals-app/8ddaa217-c92b-5e8f-a1b8-4bccda268de4/scratchpad.
Set up S/<folder>:
1. `mkdir -p S/<folder> && cp -r S/kit/spec S/kit/llms.txt S/<folder>/`.
2. `rebuild/` = copy of the passing core: `rsync -a --exclude node_modules --exclude drill-out S/stage-3/rebuild/ S/<folder>/rebuild/`, then install deps inside. Empty `local/` for scratch.
3. `git -C /home/user/goals-app show origin/drill-11-rebuild:BRIEF.md > S/<folder>/BRIEF.md`; read it first.
Read only that folder from then on.
Build the module (its stage in spec/rebuild/), registering into the core's module platform (spec/rebuild/module-platform.md), with its switch. Meet its exit criteria, follow its journeys. Score: `cd S/pin && npm run drill -- S/<folder>/rebuild` (README flags/also). Never `npm run spec` in S/pin; `git -C S/pin checkout -- spec` if it changes. Ports 47xxx.
Rules: journey tests fail when a check fails (no filtering, no stale results, honour exit codes, a failed app start is a failure); exit.test.mjs runs the criteria with the module on, off and left out; core journeys still pass with it in and out. CORE-CHANGES.md: every core change (aim: few or none). GAPS.md: id, evidence file/line, what you guessed, whether a harness diff taught it. JOURNEYS.md: each journey DONE/PART/NOT BUILT. Keep context lean.
When done: `cd S && tar --exclude node_modules --exclude drill-out -czf <folder>.tgz <folder>`.
Report under 300 words: criteria met, harness, journeys tally, core changes (count, what), gaps count and top 5.
