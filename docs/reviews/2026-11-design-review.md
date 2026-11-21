# Design review, 21 November 2026

A review of the live demo (`/demo?today=2026-10-30`, so every screen shows week 44), at 1440×900 and 390×844, in light mode and, for Home, a goal, Goals and the map, in dark mode. People: Amara Nwosu (leader), Rhea Kapoor (goal owner) and, for Workspace, Grace Achterberg (admin). Screens: Home, Check-in, a goal's page (`/goals/lead-ci-time`, Pipeline queue wait, with its chart; also `/goals/lead-flaky` for a limit chart), Goals, Data, a review (Platform leadership weekly for Amara, Developer Productivity fortnightly for Rhea), the goal map, the metric library and Workspace.

Review only: no code was changed. Faro's own rules come first (`docs/design-rules.md`, `spec/core/vocabulary.md`, CLAUDE.md). Nothing here proposes restyling Faro into another look.

**How it was done.** Three passes, in the brief's order:

1. **Design critique** (hierarchy, consistency, usability, screen by screen). The `design:design-critique` skill isn't installed in this session (the Skill tool answered "Unknown skill"), so this pass followed that skill's usual checklist by hand.
2. **Charts**, with the `dataviz` skill. Its colour validator was run on Faro's own tokens (`src/styles.css`); its palette was not used.
3. **Copy.** The `design:ux-copy` skill isn't installed either, so this pass checked button labels, empty states, flags, asks and refusals by hand against plain British English and `spec/core/vocabulary.md`. To do that, the text and button labels of every screen were taken from the page.

**Ranking.** High: it breaks one of Faro's own rules or misleads someone reading a number. Medium: it slows people down or is inconsistent across screens. Low: polish. Value and effort use the backlog's scale (S under a day, M a release, L more than one).

**Already decided** marks a finding that the backlog or the design rules already settle, either wholly or in part. The finding stays in the report so the decision can be seen.

---

## Findings

### High

**H1. The progress ring's label spills out of the ring, and on a phone it loses its word**
- **Screen, person:** Home (Amara, Rhea); a review's page (Amara). Desktop and phone.
- **Seen:** At 1440, the 64px ring's second line ("reviewed", "check-ins") is wider than the ring and is cut at both edges. On a phone, the word is dropped, so Amara sees a bare "0/17". The ring's number also differs from the headline beside it. Home's ring reads 0/17, but the headline says "5 goals to discuss". On the review's page, the ring reads 0/56, but the main button says "Start review · 16 goals".
- **Why it matters:** The ring is the first thing on the screen's hero. If its number doesn't match the sentence beside it, a leader has to work out which count is the real one.
- **Rule:** U16, "Rings say what they count" (backlog, Done). The decision stands; the way it is drawn breaks it. Also "calm".
- **Fix:** Put the word under or beside the ring, not inside it (`.ring-counts` is 0.625rem inside a 64px ring). Either make the ring count the same thing as the headline and button, or name both counts in words ("0 of 16 flagged reviewed · 56 in scope").
- **Value / effort:** H / S. **Already decided:** in part (U16 says what a ring must do).

**H2. The projection's range can't be seen, and the projection is always drawn in off-track red**
- **Screen, person:** A goal's page, Chart (Rhea, Amara). Desktop and phone, light and dark.
- **Seen:** The legend says "Projection, with its range". The range is filled with `--off-mark` at 10% opacity, which measures about 1.16:1 against the chart surface: it can't really be seen at 1440 and is gone at 390 in dark mode. The projection line `.c-fc` is always `--off-mark` red, whatever the goal's status (`src/styles.css` 439; the band in `src/styles/notes/goal-flagship.css` 166). A goal on track that is projected to land on target still gets a red dashed line.
- **Why it matters:** The brief asks whether the range reads as uncertainty. Right now it barely reads at all. Because the line is red, every projection looks like bad news, so the colour stops meaning off track.
- **Rule:** Status colours mean a status and only that ("Status shapes mean a status, and only that"; the dataviz rule that status colours are reserved). Also, the legend promises a range the chart doesn't show.
- **Fix:** Draw the range in neutral ink (`--fg`) at roughly 15–20%, with a thin edge on its top and bottom. Label it at its right-hand end ("likely 9–11"), so it reads as "somewhere in here" and not as a target. Draw the projection line in neutral ink, dashed. Keep red for the words that say a miss ("7 over").
- **Value / effort:** H / S.

**H3. The marks for at risk and no recent update are too faint on white**
- **Screen, person:** Every screen with a status shape, in light mode (Home, Goals, the check-in, a review, the map, the metric library).
- **Seen:** The validator's contrast check against `#FFFFFF`: `--risk-mark` #E59A3E is 2.33:1 and `--stale-mark` #B8BFCA is 1.85:1. Both are below the 3:1 needed for graphics people must make out (WCAG 1.4.11). The half fill is the only thing that tells at risk from off track, so it is the part that most needs to be seen. In dark mode all five marks pass.
- **Why it matters:** Status is a shape plus a word. If the shape can't be made out, only the word is left.
- **Rule:** "Status is a shape plus a word, always together" (design-rules.md).
- **Fix:** In light mode only, darken `--risk-mark` (to about #B86E14) and `--stale-mark` (to about #8A94A3). Check both with `contrast()` at 3:1 or more on `--surface` and `--off-wash`. Add the 3:1 check for marks to the design check (P6).
- **Value / effort:** H / S.

**H4. The map's critical path wears off-track red around nodes that aren't off track**
- **Screen, person:** The goal map (Amara: Watching, Fit all; Rhea, on a phone, in dark mode).
- **Seen:** `.map-node.critical` draws a 2px `--off-mark` border (`map-reviews.css` 37–38), dashed when the goal has no recent update. With Fit all, most top-level nodes on Amara's map have a red outline, including at-risk and on-track goals, and the one with no recent update gets a dashed red outline. The legend's "Critical path" sits in the key line above the map, far from the nodes.
- **Why it matters:** Red is Faro's off-track colour. A red outline around an "At risk" node tells the eye "off track" before the word is read, and a dashed red outline looks like a status shape.
- **Rule:** "Status shapes mean a status, and only that"; status colours are reserved.
- **Fix:** Show the critical path on the edges (they are already 3px red) and put the words "Critical path" in small capitals on the node. Draw the node's outline in ink (`--fg`), not red, and make it solid whatever the goal's status.
- **Value / effort:** H / S–M.

**H5. Amara's Home has two "Not held yet" reviews, and the main action doesn't say which one**
- **Screen, person:** Home (Amara), desktop and phone.
- **Seen:** The strip at the top says "Not held yet · Thu 29 Oct · Platform leadership weekly · 1 day past". The hero below it says "Not held yet · Security monthly was on Tuesday 27 Oct · 5 goals to discuss", then "Open the review". Its sentence is "Hold it now, or it closes when next week starts and these carry to Tuesday 24 Nov." On a phone, the hero's warning mark sits alone on a line of its own.
- **Why it matters:** There is one primary button, but there are two late reviews, and the button doesn't name the review it opens. The strip is above the hero, so the eye reads the strip's review first and the button seems to belong to it.
- **Rule:** One main action per screen; calm and low density.
- **Fix:** Name the review in the button: "Open Security monthly". Drop the repeated "Not held yet" from the strip when the hero is already about a late review; the strip can say "Also late: Platform leadership weekly". Keep the warning mark on the same line as its words.
- **Value / effort:** H / S.

### Medium

**M1. The limit chart has no numbers on its axis, no key, and a note about a projection it doesn't draw**
- **Screen, person:** A goal's page, Chart: Flaky test rate (`lead-flaky`, Rhea's).
- **Seen:** The y-axis has no values, there is no legend, and the footnote says "Likely end projected from the last eight weeks" although no projection is drawn. The words "Limit 2.0% · shaded: warning margin" run into the line's peak in week 41, where the red over-limit dot sits on the text.
- **Why it matters:** Without the axis you can't tell how close 1.6% is to the 2.0% limit, and the footnote describes a line that isn't there.
- **Rule:** Dataviz anatomy (axes, legend for two or more series, no label collisions); honest copy.
- **Fix:** Show the y-axis values as the target chart does. Show the key (Actual, Limit, Warning margin). Show the projection footnote only when a projection is drawn. Move the limit label to the left end, or above the margin band.
- **Value / effort:** M / S.

**M2. The chart doesn't show the goal's status, and its colour does the talking**
- **Screen, person:** A goal's page, Chart; review session mode (both people).
- **Seen:** The chart's notes ("3 min behind plan", "7 over") are in red and are words, which is good. The status itself (Off track, with its open ring) is only in the summary at the top of the page, several screens above the chart on a phone. The chart also appears on its own in review session mode and in print.
- **Why it matters:** The brief asks whether status shows on the chart without relying on colour. Mostly it does: the notes are words. The status word and its shape are missing, though.
- **Rule:** Status is a shape plus a word, where the eye starts.
- **Fix:** Add a caption row above the plot: `StatusShape` plus "Off track · 3 min behind plan · likely 10 min by year end".
- **Value / effort:** M / S.

**M3. The plan's wide pale band reads like a tolerance range, and it is faint**
- **Screen, person:** A goal's page, Chart.
- **Seen:** The plan is an 8px band of `--accent` at 30%, about 1.41:1 on white. It is told apart from the actual line well, by width, weight and texture, so the answer to the brief's first question is yes. But a wide pale band is also how charts usually show a range, so the plan and the projection's range look like the same kind of thing.
- **Why it matters:** Readers may take the band as "anywhere in here is fine".
- **Rule:** Dataviz anatomy (one encoding, one meaning).
- **Fix:** Keep the band, which is Faro's choice. Label it directly at its right-hand end ("Plan 3 min"), and make sure the range (H2) looks different from it: neutral, edged, and fanning out.
- **Value / effort:** M / S.

**M4. Three statuses share the dashed ring, and the design rules list only one of them**
- **Screen, person:** The check-in, Goals and Home (Rhea: "No check-in yet").
- **Seen:** `StatusShape` draws the dashed ring for No recent update (`stale`), No check-in yet (`none`) and Not started (`planned`). The shape list in `design-rules.md` names only "dashed ring for no recent update".
- **Why it matters:** The word does tell them apart, as the rules allow. But someone rebuilding Faro from the design rules alone would not know about the other two.
- **Rule:** Status shapes (design-rules.md).
- **Fix:** Add `none` and `planned` to the shape list as sharing the dashed ring, and give the reason. Alternatively, give No check-in yet a shape of its own. That is Lane's call.
- **Value / effort:** M / S. **Already decided:** in part (the rules say the word separates shared shapes).

**M5. One request has three names: Respond, Answer … request, and Decision or help**
- **Screen, person:** Home (Amara: "Decisions or help needed", then "Respond"). Rhea's goal seen by Amara (primary "Answer Rhea's request"; the Next steps card's button "Respond").
- **Seen:** For a question, Faro says "Answer" everywhere. For a decision or help ask, the same thing is called Respond, Answer … request, or Decision or help, depending on the screen.
- **Why it matters:** The verb on a button should name the thing it does, and it should be the same verb wherever the thing appears.
- **Rule:** Vocabulary ("Kinds of ask" in `spec/core/vocabulary.md`); rules live once.
- **Fix:** One verb for each kind of ask, everywhere: "Answer" for a question, and "Decide or help" (or "Respond to Rhea's ask") for a decision or help ask. Put the pair in the vocabulary.
- **Value / effort:** M / S.

**M6. On a phone, key words are cut off with an ellipsis**
- **Screen, person:** Home (Amara, phone): "Waiting since 24 Jul, 14 week…", "Due week 45 (2–8 Nov) · Y…", and the goal title "Lead time for changes, an…". The map's nodes: "9 hours…", "3 min behind …". The top bar on every phone screen: "Example d…".
- **Why it matters:** What is cut off is the part people need: how long something has waited, who asked, how far behind it is. "Example d…" doesn't name the workspace.
- **Rule:** Every screen size (design-rules.md); plain language.
- **Fix:** Let the second and third lines of ask cards wrap (two lines at most). On map nodes, wrap the gap words under the value. In the phone's top bar, show the workspace's short name ("Platform Engineering") without the word "Example".
- **Value / effort:** M / S.

**M7. The map puts eleven controls before the map**
- **Screen, person:** The goal map (Amara, desktop; Rhea, phone).
- **Seen:** Find, Needs attention, Filters, Sort (which does nothing on the map), Group, Layout and Views, then the key, Troubled trees, Unfold all, Fit all or Readable, and the zoom buttons. On a phone they fill about 55% of the first screen, and only two nodes show. On desktop, Fit all makes node text about 7px.
- **Why it matters:** The map's main action is "follow how goals roll up and open one". The controls bury it.
- **Rule:** Calm and low density; one main action.
- **Fix:** On the map, hide Sort. Fold Group and Troubled trees into Views. On a phone, start in Readable with the key folded away.
- **Value / effort:** M / S–M. **Already decided:** in part (the 17 Nov usability study called "Map tree-first" taste or demo-only). This finding is narrower: it is about the controls, not the tree.

**M8. The check-in's to-do row isn't the shared goal row, and it doubles the main action**
- **Screen, person:** Check-in (Rhea), desktop.
- **Seen:** The to-do row puts "No check-in yet · No value yet" on one line, then an empty gap, then the goal's title underlined on a line of its own, with its own "Check in" button. The main button directly above it, "Check in on CI cost per pipeline run", does the same thing. The done rows put the status first and the title second, also underlined. That differs from Goals and Home, where the title is set in bold beside the status.
- **Why it matters:** UX2a's aim was one goal row everywhere, including the check-in queue. When only one goal is due, two buttons do the same job.
- **Rule:** Consistency (UX2a, one `GoalRow`); one main action.
- **Fix:** Use `GoalRow`'s layout for the queue. When there is only one goal to do, drop the row's own "Check in" button.
- **Value / effort:** M / S. **Already decided:** in part (UX2a built one row; the check-in queue still differs).

**M9. A goal's page says "2 open", then "No next step yet"; on a phone its tabs are cut off**
- **Screen, person:** A goal's page (Rhea), desktop and phone.
- **Seen:** "Next steps and asks · 2 open" is followed by a warning: "No next step yet. Nobody has said what happens next". The two open items are asks, not next steps, but the heading counts them together. On a phone, the section tabs run off the screen ("What fee…") with nothing to show they scroll, and there is a 50px gap above the divider under the tabs.
- **Rule:** Plain language; every screen size.
- **Fix:** Count them apart ("No next step · 2 open asks"). On a phone, let the tabs wrap or fade at the edge, and close the gap.
- **Value / effort:** M / S.

### Low

**L1. "Done?" as a link's label.** On a review's page (Amara), each agreed action has "Open" and then a link called "Done?". Home's label for the same act is "Mark done". *Fix:* "Mark done" everywhere. *Rule:* Plain language; verb-object labels (UX2b). S.

**L2. "Defined" on its own in the metric line.** On a goal's page: "Measured by Pipeline queue wait (p90) · min, lower is better · Defined · Refreshed hourly". On its own, "Defined" reads like a missing word. *Fix:* "stage: Defined". S.

**L3. Data's columns.** The Goal column cuts names short while the Team column is wide and repeats "Change" on all 126 rows. Level is shown in lower case ("north star", "svp"), but elsewhere it is "NORTH STAR" or "SVP". *Fix:* Give Goal the room, put Change on hover or focus, and use one way of writing levels. M. **Already decided:** in part (Data is a desktop admin tool the platform's grid will replace; keeping the row's name in view is "UX (later)").

**L4. The "MET" result is cramped.** In Goals' list (Rhea), the Done row's "MET" in small capitals sits under "21 pts ahead of plan" and almost touches the row's edge. *Fix:* Put it on the status line ("Done · Met"). S.

**L5. The main button wraps on a phone.** On a goal's page at 390, "Answer Daniel's question" breaks onto two lines in a button narrower than its neighbour. *Fix:* A full-width primary button on its own row on a phone. S.

**L6. The chart's hint sits between the chart and its key.** "Drag along the chart to read any week." comes before the legend. *Fix:* Key first, under the plot, then the hint. S.

**L7. The metric library's tab counts add up to more than All** (All 13, while the other tabs add to 23, because the groups overlap). **Already decided:** the 17 Nov study's "Metrics' chips" was judged taste. It is listed only so nobody reopens it by mistake. The term "To sort out" is the backlog's own (metric library spec).

**L8. The map in dark mode is heavy.** Off-track nodes get a dark red fill plus the critical path's bright red outline, so a phone screen of the map reads as an alarm. This is fixed by H4. S.

---

## Charts (dataviz pass)

| Question | Answer |
|---|---|
| Is the plan line clearly told apart from the actual numbers? | **Yes.** The plan is a wide, pale, stepped band and the actual line is a thin, dark line, so they differ in width and weight, not only colour. This holds in grey and in dark mode. They are not labelled on the chart itself (M3). |
| Does the projection range read as uncertainty, not as a target? | **No, because it barely shows** (about 1.16:1, gone in dark mode at 390). The red projection line and the red "7 over" bracket read as a miss, not as a range (H2). |
| Does the status show on the chart itself, without relying on colour? | **In part.** The notes are words ("3 min behind plan", "likely 10", "7 over", "Lower is better"), but the status word and shape aren't on the chart (M2). The limit chart has no axis values (M1). |
| Do the charts work at phone width, and in dark mode? | **Mostly.** At 390, the axis thins to Q1, Q3 and Now, and the notes stay readable. Dark mode has its own chosen values, not an automatic inversion, which is good. The range disappears (H2). The map at phone width is the weak point (M6, M7). |
| The progress ring | Its label overflows and its count differs from the headline's (H1). |
| Home's counts | Good: shape plus word for each status, in a single row ("5 off track · 9 at risk …"). The table's "Its goals you watch" column wraps the statuses onto two lines at 1440, which is fine. |
| The scorecard (a review's list) | Good: the same row as Goals, status first, the gap in words. Its ring is the weak part (H1). |
| The goal map | Status is shape plus word on every node. The critical path's red outline clashes with the status colours (H4). |

**The colour validator on Faro's tokens** (`scripts/validate_palette.js`; Faro's colours, not the skill's palette):

- The status marks fail the validator's *categorical* checks. In light mode, on and done are 7.2 apart, below the floor of 15, and risk and stale fail on contrast. In dark mode, on and done are 9.4 apart. This is **expected, and fine**: Faro's statuses are not a colour-only set, because the shape and the word carry them (the validator's own rule: under the floor is allowed with secondary encoding). The one real failure is contrast: risk at 2.33:1 and stale at 1.85:1 on white (H3).
- The chart's colours: in light mode, the target line (`--on-mark`) and the plan (`--accent`) are only 5.9 apart, below 15. They are told apart by form (a dotted 1.5px line against an 8px band) and by the label "Target 3 min", so this passes on secondary encoding. Keep the target's label.
- Text: `--faint` #9AA3A1 is 2.37:1 on `--bg`. It is used for borders and hover states only, not for text, so it is not a finding. Keep it that way.

---

## Copy (by hand; the ux-copy skill wasn't installed)

- **British spelling:** clean. Every screen's text was checked: "catalogue", "organisation", "reprioritised"; no American spellings found.
- **Empty states:** good. Amara's Check-in says "You don't own a goal in Example: Platform Engineering, so there's nothing to check in." and offers "See the goals you watch" and "Set up a goal". Workspace's "No fields yet" links to Fields.
- **Verbs:** see M5 (Respond, Answer … request), L1 ("Done?") and L2 ("Defined").
- **Asks and flags:** the asks quote the asker's own words and say who asked, where and when ("Daniel asked in Developer Productivity fortnightly on 20 Oct"). That is a pattern worth keeping.
- **Refusals:** none were met on these screens as these people. (The module-off sentences are covered by the core journeys and weren't re-checked here.)

---

## What works (don't change these by mistake)

- **Status is a shape plus a word, first on every row**: on Home, Goals, the check-in, a review, the map and the metric library. Nothing breaks this on any screen reviewed.
- **No banned patterns** were seen: no edge stripes, quote bars, emoji, gradients or pastel pills. Off track gets a full-surface wash, never an edge.
- **A goal's summary:** VS PLAN, VS LAST WEEK, TO TARGET, WILL IT HIT 3?, each answered in words with the number under it. This is the clearest part of the app.
- **The chart's notes in words:** "3 min behind plan", "likely 10", "7 over", "Lower is better", and the Now marker. You can step through the weeks with a keyboard, and the readout is announced as it changes.
- **Dark mode is chosen, not inverted**, with its own values for every token.
- **The asks quote people:** who asked, in which review, on what date.
- **One primary button per screen**, and it is named for what it does: "Start check-in", "Check in on CI cost per pipeline run", "Start review · 16 goals".
- **Workspace › About** is calm: a list of facts, each with a link to where it can be changed.
- **The phone's tab bar**: five places, with counts for what is due.
