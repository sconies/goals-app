# Dry-run checklist for Wednesday 11 November

Tick each line on Tuesday evening, then do the "15 minutes before" block again on Wednesday. If a line fails, fix it or switch to its fallback before the talk, not during it.

## Tuesday evening: one full dry run (about 45 minutes, with a timer)

**The app**
- [ ] `https://goals-app-puce-five.vercel.app/api/mcp?check` says database and pictures are true.
- [ ] `/demo` → Demo controls → **Start over** works; view as **Rhea Kapoor**; light theme.
- [ ] The root page shows the splash then the welcome page (load it once first: the first load is slow).
- [ ] Walk Parts 1 and 2 of `docs/demo-script.md` once, out loud, timed (targets 10 and 5 minutes). Note any screen that looks odd.
- [ ] As Amara Nwosu: Home shows 126 goals and the review ring; this week's review walkthrough opens.
- [ ] Workspace → Inbox opens and shows items; Workspace → Features lists the modules.
- [ ] Data → Spreadsheets → download: the workbook has a Metrics sheet, and Data has **no** Metrics page yet (main must not have the fallback merged).

**The live build**
- [ ] Sign in to Vercel in the presenting browser: every preview link, the fallback's and the live build's, is behind Vercel sign-in.
- [ ] Open the fallback preview (link in `docs/live-build/metrics.md`, draft PR #57; #55 is a second fallback): Data → Metrics lists the 13 metrics; add "Deploy frequency"; make a new goal measured by it; open a goal page and see its metric.
- [ ] Start a **new Claude Code session** at claude.ai/code: repository **sconies/goals-app**, environment **goals-app**, permission mode **Auto**. Check you can pick Auto (it must be set when you start the session; it can't be set later from another session).
- [ ] Only once the brief and README fixes are on main: paste the brief from `docs/live-build/metrics.md` with the default room answers (answer 3: "yes, freely"), and time it to the preview link (run 2 took 13 minutes to the preview, 16 to green CI). Close its pull request unmerged afterwards.
- [ ] Decide your cut-off: if no preview link by **20 minutes**, switch to the fallback.
- [ ] Decide the room questions you'll actually ask (all five, or only 1 and 4 to save time), and practise the line for question 3 if the room asks for a reason.

**The room**
- [ ] Laptop at full width, browser zoom so the back row can read (try 125%), notifications off, a charger.
- [ ] Tabs, in order: `/demo`; the root page; `docs/live-build/metrics.md` on GitHub; claude.ai/code; the fallback preview; the drill review (`docs/reviews/2026-11-08-drill-1.md`).
- [ ] A phone hotspot in case the venue's network blocks claude.ai or Vercel.

## Wednesday, 15 minutes before

- [ ] Health check link is true; `/demo` → **Start over** → Rhea Kapoor → light theme.
- [ ] Root page loaded once in its tab (so the splash is quick in front of the room).
- [ ] Fallback preview opens.
- [ ] A fresh Claude Code session is open on goals-app, environment goals-app, mode Auto, nothing typed yet.
- [ ] The brief is in a text editor, ready to fill in with the room's answers.

## During the live build

- [ ] Paste the brief by **minute 7** of Part 3 (after requirements and the room's answers).
- [ ] Open the preview as soon as Vercel says Ready; CI can finish while you show it.
- [ ] At **20 minutes** with no preview: "here's the same brief, run yesterday", open the fallback.
- [ ] Don't merge on stage unless CI is green and you've looked at it; "I'll merge after review" is a fine ending.
- [ ] If you do merge, reload the demo tabs once afterwards (a deploy replaces the code under open tabs).
