# Demo review, 8 November 2026

An outside review of https://goals-app-puce-five.vercel.app/demo (09:57–10:09, as Rhea Kapoor and Amara Nwosu), shared by Lane. Triaged by the planning session; "Fix now" items are backlog item D (demo polish).

## Fix now (item D)

Critical
1. **Start over doesn't reset.** It restores saved data but leaves check-in and new-goal drafts, and What's new / Help "seen" state. Make it clear everything the demo keeps in the browser (`src/app/state.tsx` resetExample; drafts in `src/app/drafts.ts`).
2. **Check-in drafts:** no Discard (only Close/Save draft or Post); a reopened draft at step 2 has no Back, so a wrong value can't be corrected without posting.
3. **Lower-is-better wording:** gaps are always called "short" (`src/domain/scorecard.ts` gapText and wherever else). 7 min against a 6 min plan reads "1 min short"; it is 1 min over. 36 h vs 31 h plan: "5 short", should be 5 over. 0.68 against a plan of 0.68 reads "0.00 short" and "Last quarter not met": compare at the displayed precision, equal is met. The same page elsewhere says "5 min to go": make it consistent.
4. **Walkthrough "Post your weekly check-in" step 1** says Rhea is all set while Home says 1 check-in to do, 3 days late; it has only Skip, no Next.

Trust
5. "Needs attention · 47" on Goals is never defined (Board groups sum to 37; the other 10 are flagged on-track/done goals). Say what it counts.
6. "Quiet for three weeks or more": includes 7 Done goals; heading says 2 weeks, filter says 3+. One threshold; exclude Done.
7. Review walkthrough says "Goal 3 of 14" while the review covers 35 and progress says "1 of 35 reviewed". Explain or align.
8. As Amara, the review ring's alt text says 0 of 56 while the ring and Reviews say 2 of 56.
9. Past-due reviews aren't flagged (Thu 5 Nov, Not started, 3 days past).
10. Demo data text: the "two pull requests slipped to Monday" line repeats across 5+ goals; a blocked-by-dependency line repeats verbatim; a week 43 check-in refers to "the same reason as week 45"; "the old the"; a goal title ending in a comma; G-124 sorted between G-48 and G-49 (sort keys numerically); blank Start/Target cells for range goals in Data; unexplained "warnings" counts in the Goals table.
11. New goal pre-selects "Feeds into: CI/CD": start empty.
12. One Activity filter option is disabled with no explanation.
13. Say plainly on Demo controls (and Help) that Faro is a prototype and model, with no commercial offer.

If there's time
14. Goals layout switcher is icons only on phones: label it. Goals tabs/filter chips cut off when scrolling sideways. What's new banner drops to the bottom of Home on phones. Saved-view names truncate even at 1920 px.
15. Goals Map is blank white for ~5 s with no loading state.
16. Animated headline numbers pass through wrong values (Home ring 3/7, 5/7 before 6/7; flaky rate 1.4% before 1.8%): count from the previous value or start at the final value for screenshots and checks.

## Later (backlog)
- Searchable pickers ("Feeds into" ~126 goals, Owner ~97 people, Review edit ~100 checkboxes): item 0a.
- Builder-token field in the public Workspace inbox: item 0a (builders' area).
- Root `/` takes over 5 s past its loading skeleton; Activity's blank first paint.
- Confirm before Map Delete; contrast-check status colours; explain why a check-in with no visible plan is Off track.

## Worked well (keep)
Plain, self-explaining copy and contextual help; status and trend explained on goal pages; search, layouts, saved views, filters and empty states; goal detail chart with keyboard support and text alternative; review walkthrough; dark mode; Help search; 404 page; persona switching; privacy wording; What's new.
