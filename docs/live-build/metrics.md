# Live build: the metric library's screens (Tuesday 10 November)

About 25 minutes in the talk. The point is to show **how a feature gets added with AI**: start from a manager's request, agree requirements with the room, refine them, then watch an AI build it on a tested foundation, inside the rules the project already has.

The back end (backlog 0b) is on main (PR #52). The rehearsal's result is kept on the branch `demo/metrics-live-fallback` (never merged).

**Rehearsal, Monday 9 Nov (23:16 UTC on the 8th):** the brief below, with the default answers and answer 3 as "yes, with a reason". A working preview at **21 minutes**, CI green at 41 (about 15 of those lost to a late look at a red run). Draft PR #55 (do not merge). **Fallback preview:** https://goals-app-git-demo-metric-925e78-lanehirschfield-5825s-projects.vercel.app/demo/data/metrics (behind Vercel sign-in: open it in a browser signed in to Vercel). What it taught, now in this brief and the module README: a reason for changing a metric is a rule change in the core, so it pulls the build out of the module and turns on the full eval suite; a new journey also turns on the full suite through `evals/touches.cjs`, so the brief names the eval command to run instead; changing `help.ts` changes `api/mcp.js`, so `build:mcp` runs last.

## Before you start (15 minutes before the talk)
- Work through `docs/live-build/checklist.md`.
- Open three tabs: the demo (`/demo`, Data page), this file, and a **new Claude Code session on the goals-app repository** (claude.ai/code), environment **goals-app**, mode **Auto** so it doesn't stop for permissions. Auto has to be chosen when the session starts.
- Check the fallback preview link opens.

## 1. The request (2 minutes)

Say: *"My manager asked: every goal should say exactly what it measures, defined once, so two teams' 'build time' are the same thing. That's a metric library."*

Show that the foundation is already there: in the demo, Data has a Metrics sheet but no Metrics page; show `src/modules/metrics/README.md` and the Metrics sheet in the workbook (Data → Spreadsheets → download): it lists 13 metrics already defined, 12 of them measuring a goal. *"The data and the rules exist and are tested. What's missing is the screens. We'll add them now."*

## 2. Requirements on screen (3 minutes)

Starting requirements:
1. A **Metrics** page under Data: every metric with its name, unit, direction and owner, and how many goals use it. Search by name.
2. **Add a metric** and **edit a metric** in one form: name, what it means and how it's calculated, unit, decimals, higher or lower is better, source and its owner, how often it refreshes, owner, caveats. Only name, unit and direction are required.
3. On a goal (New goal and edit): **"Measured by"**, pick a metric or create one there and then.
4. On a goal page, show which metric it uses, with its meaning.

## 3. Refine with the room (5 minutes)

Ask, and write the answers into the brief before you paste it:
1. **Who can create a metric?** (Faro's rule today: anyone; the owner or an admin edits it.) Keep, or admins only?
2. **What must a metric have before a goal can use it?** (Today: name, unit, direction.) Add meaning and source?
3. **Can a goal change its metric after check-ins have started?** (Faro today: yes, freely; the change is in its history.) If the room wants a reason, say that's a rule change in the core, not a screen: *"that's exactly the kind of change that goes through review, not a 20-minute build"*, and put it in the backlog. Keep "yes, freely" in the brief. (The rehearsal built the reason; it took the build into the core and the full test suite.)
4. **Should the Metrics page show which teams use each metric?**
5. Anything to leave out today? (Fewer requirements, faster build.)

## 4. Build (about 20 minutes)

Paste the brief below into the new session, with the room's answers filled in. While it works, narrate:
- it reads `CLAUDE.md` and the module README first: the project's own rules (design, tests, help, what's new) apply to AI too;
- it builds the screens as part of the `metrics` module, plugging into places the core already offers (a Data page, a goal-form field);
- it runs the checks the change touches, not everything, so it's fast;
- it opens a pull request; CI runs (about 3 to 4 minutes); Vercel makes a preview link within a minute or two of the push. **Open the preview as soon as Vercel says Ready;** don't wait for CI.

### The brief

> Build the screens for the metric library in Faro, following `CLAUDE.md`, `docs/design-rules.md` and `src/modules/metrics/README.md`. The data, rules, store and AI tools already exist; don't change them unless a requirement below needs it.
>
> Requirements (agreed with the room):
> 1. A Metrics page under Data listing every metric (name, unit, direction, owner, how many goals use it), with search by name.
> 2. One form to add and edit a metric. Required: name, unit, direction. Optional: meaning and calculation, decimals, source and its owner, refresh cadence, owner, caveats. [ROOM: changes]
> 3. "Measured by" on New goal and goal edit: pick a metric, or create one in place.
> 4. The goal page shows its metric and what it means.
> [ROOM: answers to questions 1–5]
>
> Register the screens through the metrics module's places, not by editing the core. Add What's new and Help. Read "Before pushing the live build" in the module README first and follow it. Run `npm run typecheck` and `npm test`; for evals, run only the ids `npm run evals:changed` lists, as the README says, never the full suite. Push and post the preview link as soon as Vercel has it, then open a pull request and watch CI; if it goes red, fix it at once. Be quick: this is being built live in front of an audience.

## 5. Show it (3 minutes)

Open the preview link: add a metric live (for example "Deploy frequency", deploys per week, higher is better), then make a new goal measured by it. Then merge it, or say you'll merge after review.

## If it goes wrong
- **It's slow:** keep talking through what it's doing; at 20 minutes, switch to the fallback preview: *"here's the same brief, run yesterday."*
- **It fails a check:** that's the point of the checks; show the message, let it fix it, or switch to the fallback.
- **The preview won't load:** show the fallback preview.
