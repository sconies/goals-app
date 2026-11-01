# Response to the mobile UX review (1 November 2026)

What changed for each item in the review's change register, and what is still open.

## Pass 1: predictability and trust

| ID | Change | Status |
|---|---|---|
| R01 | In a review, Save note / question / action saves and **stays on the goal**. **Reviewed & next** (or **Reviewed & finish** on the last goal) is the only button that moves on. A failed save keeps the draft and stays put. | Done (U3 checks it) |
| R02 | One success message at a time: a new one replaces the last; errors stay until they time out. Routine "reviewed" needs no message, because the bar shows progress. | Done (U3 counts messages) |
| R03 | Footers and sheets sit above the on-screen keyboard (measured from the visual viewport, so it works on iOS too). Composer buttons sit right under the field. The number field's keyboard shows "next". | Done; needs a real-device check |
| R04 | Check-in shows "Week 6: 29.4 days" as history and leaves the field empty. **Measured again: unchanged** fills it deliberately, and a matching number is flagged "post only if you measured it again". **No new number this week** records that, without re-posting old data; the check-in stays due. | Done |
| R05 | The streak no longer sits beside "late", and a late week breaks it. The check-in head says "at the week 6 check-in" for the old status. | Done |
| R06 | A stale goal leads with **Current performance unknown** and "Last reported: 50% in week 4 (7 Oct), 23 days ago". The projection and path-to-green lines are removed from the chart and legend. **Ask Jonas for an update** posts a visible comment the owner sees under For you. | Done |
| R09 | The composer is a sheet titled "Add a note: *goal name*", naming the review. | Done (U3 checks it) |

## Pass 2: decision quality and speed

| ID | Change | Status |
|---|---|---|
| R07 | "Decision or help needed" is its own block, above history, on the goal page and in reviews. | Done |
| R08 | During a review the goal page is compact: goal and owner; result, comparison and when it was reported; the decision needed; what the owner said. Chart, check-ins and **Contributing goals · 8 · 3 need attention** are folded away. Edit, Watch and taxonomy tags are hidden. | Done |
| R10 | "Where are you with getting it back on plan?" offers I have a plan (with a week), Still investigating, Need a decision or help, The target should change. Only a plan needs a date. The database rule changed to match (migration 0007). | Done (scenario and schema tests) |
| R11 | Actions have a **who** (defaults to the owner) and an optional **by week**, shown in the record. | Done; no picker for decision requests in check-ins yet |
| R12 | Gaps lead with the raw difference in the goal's units ("1.7 days above plan"); the progress score is labelled "% of the planned improvement so far". | Done |
| R13 | "Projected end of cycle: 25.8 days, 7.8 days above the 18.0 days target. An estimate from the recent trend." No "short of" for lower-is-better numbers. | Done; chart dates and tick tidy-up are still open |
| R14 | Check-in step one is the number, its history and one assessment; the chart stays behind "Show chart". | Partly done (big-number layout unchanged) |
| R15 | The streak was removed from the check-in card on Home. | Partly done (the greeting still comes first) |
| R16 | One confirmation: "Check-in saved", what was saved, whether the week is done, **Back to home** and **View the goal**. The second "Week 7 is done" screen is gone. | Done (U1) |
| R17 | The bar says "Goal 2 of 13 · 5 reviewed". "Seen, next" became "Reviewed & next". Skip for now leaves the goal in "Still to review". The arrows are labelled "Next goal, without reviewing this one". | Done |
| R18 | A finished review leads with "Review complete: 13 goals reviewed", then Actions (who, when), Questions (answered or waiting), Notes by goal, and **Reviewed without comment · 9** folded. An unfinished review leads with "Still to review". "Change it" became "Edit review setup". The start button says "Continue review · 12 goals left". | Done (U3) |

## Pass 3 and still open

- R19 and R20: a real-device accessibility pass (contrast of muted text and borders, actual hit areas, larger text settings) and consolidating type and spacing. These wait for the design direction from the picker.
- Status model (section 1): performance, trend, freshness, reporting timeliness and review state are now separated in most places. A single written definition, shown in Details, is still to do.
- Imported data provenance (section 2): no integrations exist yet, so every value is manual. When one lands, show its source, period and sync time.
- Validation plan: the eight observed tasks are a good script for the first sessions with real owners and reviewers.

# Second review (F01–F16) and the product-direction note

## Fixed

| ID | Change |
|---|---|
| F01 | The new-goal preview now plans from the week the goal is set up, the same as the saved goal (week 7 = 40 → week 13 = 80). A unit test covers it. |
| F02 | Only "Reviewed & next" marks a goal reviewed. Saving a note, question or action leaves it in "Still to review". U3 checks the count. |
| F03 | The button now says "Still true: post check-in". |
| F04 | Every gap names its week: "6 pts above week-6 plan". |
| F05 | Check-in shows "This week: 1 pt above week-7 plan" and, separately, "Cycle end: projected …, 13 pts below the target … The plan expects a faster pace later, so the two can disagree." |
| F06 | Guardrails say "Over the 12.0% limit" or "Near the 12.0% limit" instead of "Breached". |
| F07 | "Need a decision or help" gives one request: what's needed, plus who from. The second field is now "Also need a decision or help?" for the other recovery states. |
| F09 | The definition, unit and direction show above the number. The source reads "Where to get it: … Typed in by hand." |
| F12 | The step total counts every possible step up front, so it never grows. A resumed draft returns to the step where it was left. |
| F13 | Items said in the current review appear once. Your own note, question or action has Edit, and the change log keeps the before and after. |
| F14 | Week choices show their dates ("Week 8 · 2–8 Nov"), and actions can be due this week. |
| F15 (part) | The Activity filter is renamed "Review notes". The observer home says "No check-ins or reviews due". |
| F16 (part) | Review arrows, close buttons, quiet links and fold-outs are at least 44px on phones. Each stage's week field has its own name. |

## Deliberately not done, or waiting on a product decision

- **Decision lifecycle with Approve, Decline and Request more info (F08, note §9).** This is close to the approvals and governance you chose to leave out for now. A lighter version (a request has a recipient and an Open, Answered or Done state; an action can be marked Done; both show on the person's Home) keeps the loop closed without becoming governance. This needs your call.
- **Typed relationships: measures, expected to improve, required for, must stay within (note §4).** Useful, but it asks a question on every link, which works against keeping the app light. A cheaper first step is an optional "Why do we expect this to help?" on a link; guardrails are already flagged.
- **Navigation: Home, Goals, Reviews, More (note §11).** This removes the Watching mode you asked for. The note itself calls it a hypothesis, so it isn't built.
- **Owner confidence as a fifth signal (note §7).** It adds a question to every check-in. The status explanation now separates the plan from the projection, which addresses most of the confusion without more input.
- **Onboarding (F10, F11).** Fair points. A structured stage editor and a confirmation that lists owners and targets are next on the list.
- **Search and filters (F15).** The review itself says to wait until realistic volumes justify them.
