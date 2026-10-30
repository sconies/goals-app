# Eval scorecard · 1 · Goals, plans and check-ins

Run 2026-10-30 16:14 UTC. **23 of 23 requirements pass**. Spec scenarios 56/56; browser journeys 14/14.

| | Requirement | Area | Scenarios | Journeys |
|---|---|---|---|---|
| ✅ | **PLAN-SHAPE** Plans can be straight, back-loaded ((w/13)^1.5) or stepped, and set the weekly checkpoint. | Plans | 3 | J06 |
| ✅ | **FORECAST** Forecast is the last three weeks' slope projected to the end of the cycle, and only shown with enough data. | Plans | 2 | — |
| ✅ | **REBASELINE** Changing a plan after check-ins start re-baselines it and keeps the original visible. | Plans | 1 | J07 |
| ✅ | **STATUS-BANDS** Metric: on track at 95% of planned progress or more, at risk 80–95%, off track below 80%. | Status rules | 8 | — |
| ✅ | **STATUS-DIRECTION** Lower-is-better metrics are judged the same way as higher-is-better ones. | Status rules | 3 | — |
| ✅ | **RANGE** Range: at risk inside the warning margin or after one breach; off track after two weeks out of range. | Status rules | 6 | — |
| ✅ | **MILESTONE** Milestone: a stage up to 2 weeks late is at risk, more is off track; an overdue stage counts as late. | Status rules | 6 | J05 |
| ✅ | **OWNER-CALL** The owner's call is the official status shown everywhere, with the calculated status beside it. | Status rules | 1 | J03, J08 |
| ✅ | **GREENER** A call greener than the calculation needs a reason and is flagged on the goal. | Check-in | 3 | J03 |
| ✅ | **REASON-BEHIND** A reason (cause and explanation) is required when behind plan (below 95%). | Check-in | 3 | J02 |
| ✅ | **REASON-AHEAD** A reason is required when 120% or more ahead, and the check-in asks whether the target should change. | Check-in | 3 | J04 |
| ✅ | **PATH-TO-GREEN** At risk and Off track need a path to green: what changes and a future week it is back on plan by, plus any decision needed. | Check-in | 4 | J02, J05 |
| ✅ | **CHECKIN-STATUS-VS-PLAN** The check-in shows actual against plan today, the gap, the forecast and the calculated status as the value is typed. | Check-in | 1 | J01 |
| ✅ | **ONE-PER-WEEK** One check-in per goal per week; editing replaces it. | Check-in | 0 | J01 |
| ✅ | **OWNER-ONLY** Only the goal's owner can post its check-in. | Check-in | 0 | J09 |
| ✅ | **STALE** No owner check-in for 14 days shows as Stale, never as on track. | Status rules | 6 | J08 |
| ✅ | **HIERARCHY** A headline goal with input goals from several teams, each with an estimated effect; the headline shows its inputs and their mix of statuses. | Goals | 3 | J06 |
| ✅ | **GOAL-CREATE** A lead can create a metric, range or milestone goal with a plan, and invalid input is explained. | Goals | 3 | J06 |
| ✅ | **GOAL-PAGE** The goal page shows status strip, why, path to green, chart with plan/forecast/path back, and check-in history. | Goals | 0 | J02 |
| ✅ | **PERSIST** Changes are saved and survive a reload; demo data can be reset. | Platform | 0 | J01, J10 |
| ✅ | **PHONE** Every screen works at phone width (390px) with no horizontal scrolling. | Platform | 0 | J11 |
| ✅ | **A11Y** No serious or critical accessibility violations (axe-core); status is shape plus word, never colour alone. | Platform | 0 | J12, J13 |
| ✅ | **NO-ERRORS** No console or page errors on any screen. | Platform | 0 | J14 |

## Browser journeys

- ✅ **J01** Owner posts an on-plan check-in, edits it, and it survives a reload _(CHECKIN-STATUS-VS-PLAN, ONE-PER-WEEK, PERSIST)_
- ✅ **J02** Behind plan: posting is blocked until the reason and path to green are given _(REASON-BEHIND, PATH-TO-GREEN, GOAL-PAGE)_
- ✅ **J03** A greener call needs a reason and is flagged on the goal and in the list _(GREENER, OWNER-CALL)_
- ✅ **J04** Well ahead: asks why, and whether to propose a higher target _(REASON-AHEAD)_
- ✅ **J05** Milestone: a stage slipping three weeks turns it off track and needs a path to green _(MILESTONE, PATH-TO-GREEN)_
- ✅ **J06** A lead creates an input goal that feeds the headline _(GOAL-CREATE, HIERARCHY, PLAN-SHAPE)_
- ✅ **J07** Changing a plan after check-ins re-baselines it and keeps the original _(REBASELINE)_
- ✅ **J08** A goal with no check-in for 14 days shows Stale, never on track _(STALE, OWNER-CALL)_
- ✅ **J09** Only the owner can post; others see the goal but no check-in _(OWNER-ONLY)_
- ✅ **J10** Reset demo data restores the seed _(PERSIST)_
- ✅ **J11** Every screen fits a 390px phone with the tab bar in view _(PHONE)_
- ✅ **J12** No serious or critical accessibility violations (desktop); status chips carry a shape and a word _(A11Y)_
- ✅ **J13** No serious or critical accessibility violations (phone); status chips carry a shape and a word _(A11Y)_
- ✅ **J14** No console or page errors across every journey _(NO-ERRORS)_

## Not in this slice

- Leadership view and team review (inspection)
- Target-change approval by the sponsor
- Dependencies between goals
- Jira linking (context only)
- Slack check-ins and nudges
- AI drafts and explanations (beta)
- Key-goal flags
- Data integrations (Power BI, Grafana, ServiceNow)
- Sign-in and permissions
