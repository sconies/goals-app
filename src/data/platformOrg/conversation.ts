/* What people said around the goals in the Platform Engineering example: comments and replies, asks for an update,
   and what was said in reviews. Weeks are written for a demo in week 45 (see goals.ts); day 0 is Monday. */
import type { Level, Review } from '../../domain/types';

/** [week, day, goal, person, words] */
export type Comment = [week: number, day: number, goal: string, by: string, text: string];

export const COMMENTS: Comment[] = [
  [6, 2, 'ns-lead', 'amara', 'Can we agree that the Four Keys number is the one we quote outside the division? I’ve seen three different lead times in decks this month.'],
  [6, 3, 'ns-lead', 'rhea', 'Yes. Four Keys, median, all deployable services. Lucía is adding the definition to the dashboard header.'],
  [6, 3, 'ns-lead', 'lucia', 'Done. The header links to the definition and the query.'],
  [14, 1, 'lead-mq', 'wen', 'Is the payments pilot still on for week 18? Payments want to plan their release train around it.'],
  [14, 2, 'lead-mq', 'diego', 'Week 18 is at risk: MergeFlow’s required-checks support is in beta. I’ll know by Friday.'],
  [17, 4, 'lead-mq', 'diego', 'Pilot moves to week 21. MergeFlow found a race in their batch logic during our trial.'],
  [17, 4, 'lead-mq', 'pavel', 'Thanks. Payments are fine with 21 if the rollback plan is the same as today’s.'],
  [21, 2, 'ns-ai', 'farah', 'Before this goes higher: the AI reviewer still isn’t approved for the regulated repositories. Please keep them out of the denominator until it is.'],
  [21, 3, 'ns-ai', 'tariq', 'Agreed. The definition now excludes the regulated repositories until SEC-140 is done. It changes the number by less than a point.'],
  [24, 1, 'ns-cost', 'ethan', 'The GPU fleet is now 9% of the production bill. Showing it separately in the monthly report from this month.'],
  [24, 2, 'ns-cost', 'zara', 'Most of that is the assistant’s training runs. We expect it to halve once queue-based scheduling is in.'],
  [26, 3, 'ns-cost', 'amara', 'Björn, if the target needs to move because of the GPU fleet, move it, and say why. Better than a red line all year.'],
  [27, 1, 'ns-cost', 'bjorn', 'Moved to 0.62 with the reason in the change log. Everything except GPUs stays on the original pace.'],
  [29, 1, 'ns-slo', 'marisol', 'Post-incident review for the 14 July storage outage is in the incident tracker. Two actions are on this goal’s tree: the failover drill and the second region.'],
  [29, 2, 'ns-slo', 'akosua', 'The second-region work for those two services is in our plan for Q3. The capacity reservation is the open question.'],
  [30, 0, 'dep-gates', 'daniel', 'Moving this to Rhea: CI/CD already runs the pipelines, and Marcus is moving to the ARM runner work. Thanks, Marcus, for getting it this far.'],
  [30, 1, 'dep-gates', 'rhea', 'Picked up. First change: the gates run in report-only mode for two weeks before they block.'],
  [31, 2, 'lead-runners', 'johanna', 'Pilot pool on the web monorepo cut queue wait from 14 to 3 minutes at peak. Cost model is in the doc.'],
  [31, 3, 'lead-runners', 'ethan', 'The cost model looks right. It’s about 18% more CI spend for Q4, which needs Amara’s sign-off.'],
  [33, 2, 'ns-devsat', 'ingrid', 'Pulse comments this fortnight: 41 mention CI times, 23 flaky tests, 19 local set-up. Sharing the full export with the team leads.'],
  [33, 3, 'ns-devsat', 'tariq', 'Local set-up is ours. Isabel’s one-command work is unblocked now Data Platform shipped the seed data.'],
  [35, 2, 'ns-vuln', 'farah', 'The gap is almost all container findings. Fixing them one service at a time won’t catch up; we need images rebuilt automatically.'],
  [35, 3, 'ns-vuln', 'rhea', 'We can do a rebuild trigger in CI. Johanna has capacity from week 38.'],
  [36, 1, 'vuln-containers', 'yasmin', 'Raised it as a request so it doesn’t get lost between the two teams.'],
  [37, 2, 'vuln-secrets', 'laila', 'All nine keys rotated within 24 hours. Push protection is on for the mobile org from today.'],
  [37, 3, 'vuln-secrets', 'farah', 'Good response. Let’s do the same audit on the data science notebooks next month.'],
  [38, 2, 'ns-cfr', 'marisol', 'Two weeks over 15%. Two of the three failures were console config changes, not deploys. Can we get config through the pipeline this quarter?'],
  [38, 3, 'ns-cfr', 'pavel', 'Config through the pipeline is on the Build & Release plan for week 42. I can bring it forward a fortnight if the canary halt slips again.'],
  [39, 1, 'ns-lead', 'nadia', 'From the architecture side: the merge queue is the critical path, then runners. Flaky tests are noise in comparison. I would put every spare hour on the queue.'],
  [39, 2, 'ns-lead', 'rhea', 'Agree on the order. The queue is waiting on MergeFlow though, so the spare hours are going to the runners pilot and the quarantine.'],
  [40, 2, 'fresh-kafka', 'santiago', 'Vendor now says December for the connector fix. We could self-host the connector for about two weeks of work.'],
  [40, 3, 'fresh-kafka', 'arjun', 'Self-hosting means we own its upgrades too. Let’s put both options to Jun with the costs.'],
  [41, 1, 'lead-ci-time', 'rhea', 'Linking this to the runner budget request on lead time, so Amara sees one ask, not three.'],
  [41, 4, 'slo-multiregion', 'akosua', 'Four tier-1 services are active-active now. The rest need Data Platform’s replication, which is next year.'],
  [41, 4, 'slo-multiregion', 'marisol', 'That’s the honest answer. Let’s show it as off track and put the replication work in next year’s plan, not stretch this one.'],
  [42, 1, 'ns-env', 'camille', 'Preview environments: median 9 minutes. Test environments with data: 52 minutes, all in the snapshot restore. That’s the whole gap.'],
  [42, 2, 'ns-env', 'priyam', 'Pre-warmed snapshots would get the top five under 15 minutes. It needs about 2 TB of extra storage.'],
  [42, 3, 'ns-env', 'bjorn', 'Fine on the storage. Put it on the cost report so it’s visible.'],
  [43, 0, 'ns-lead', 'amara', 'I’ll take the runner budget to the finance review on Thursday. Rhea, can you send me the cost model and what we get for it in one page?'],
  [43, 1, 'ns-lead', 'rhea', 'Sent. Short version: 18% more CI spend for Q4, about six hours off lead time, and the queue wait goes from 14 to 3 minutes.'],
  [43, 2, 'lead-review', 'oskar', 'Is there a way to see which repositories are slowest to first review? My team suspects it’s the ones with a single code owner.'],
  [43, 3, 'lead-review', 'tariq', 'Good question. Kwame has a breakdown by repository; I’ll add it to the dashboard this week.'],
  [43, 4, 'lead-review', 'kwame', 'Added. You’re right: the twelve repositories with a single owner are 40% of the wait.'],
  [44, 1, 'ns-ai', 'oskar', 'The AI reviewer is now commenting on generated files. Could it skip anything under /gen?'],
  [44, 2, 'ns-ai', 'ravi', 'Yes, shipped the ignore rule this morning. It respects .gitattributes linguist-generated too.'],
  [44, 2, 'ns-mttr', 'mateo', 'The July outage dropped out of the rolling average this week. We’re back on plan for the first time since June.'],
  [44, 3, 'mttr-aiops', 'connor', 'The AI timeline drafts saved about ten minutes per incident review last month. People are editing rather than writing from scratch.'],
  [44, 3, 'ns-devsat', 'lucia', 'The pulse response rate dropped to 31% this fortnight. Worth reading the score with that in mind.'],
  [45, 0, 'ns-lead', 'daniel', 'MergeFlow confirmed the batch fix for their 4 December release. If it holds, the web monorepo moves in week 49.'],
  [45, 1, 'lead-flaky', 'aiko', 'The two shared fixtures behind most of the new flakes are fixed. The rate should drop under 1.8% next week.'],
  [45, 1, 'ns-fresh', 'jun', 'Freshness is back on plan after the CDC incident. Schema-change alerts go live in week 44, which should stop a repeat.'],
];

/** Asks for an update: [week, day, goal, who asked, undone the same day?] */
export const UPDATE_ASKS: [week: number, day: number, goal: string, by: string, undo?: boolean][] = [
  [30, 1, 'lead-mq', 'wen'],
  [41, 2, 'devsat-docs', 'grace', true],
  [43, 1, 'cost-storage', 'amara'],
];

export const REVIEWS: Omit<Review, 'createdAt'>[] = [
  { id: 'weekly', name: 'Platform leadership weekly', everyWeeks: 1, weekday: 3, scope: { goals: [], trees: [], levels: ['north-star', 'svp'] as Level[] }, people: ['amara', 'daniel', 'bjorn', 'marisol', 'farah', 'jun', 'ingrid', 'wen', 'nadia', 'lucia'], createdBy: 'amara' },
  { id: 'qbr', name: 'Quarterly business review', everyWeeks: 13, weekday: 2, scope: { goals: [], trees: [], levels: ['north-star'] as Level[] }, people: ['amara', 'daniel', 'bjorn', 'marisol', 'farah', 'jun', 'ingrid', 'wen', 'lucia', 'grace'], createdBy: 'amara' },
  { id: 'security', name: 'Security monthly', everyWeeks: 4, weekday: 1, scope: { goals: ['dep-gates-sec', 'ai-approval'], trees: ['ns-vuln'], levels: [] }, people: ['farah', 'omar', 'leilani', 'yasmin', 'laila', 'amara'], createdBy: 'farah' },
  { id: 'devprod', name: 'Developer Productivity fortnightly', everyWeeks: 2, weekday: 1, scope: { goals: [], trees: ['ns-lead', 'ns-ci', 'ns-deploy'], levels: [] }, people: ['daniel', 'tariq', 'rhea', 'pavel', 'diego', 'nadia'], createdBy: 'daniel' },
  { id: 'reliability', name: 'Reliability weekly', everyWeeks: 1, weekday: 2, scope: { goals: [], trees: ['ns-mttr', 'ns-slo', 'ns-cfr'], levels: [] }, people: ['marisol', 'mateo', 'yuki', 'connor', 'chioma', 'akosua'], createdBy: 'marisol' },
  { id: 'dataml', name: 'Data & ML sync', everyWeeks: 1, weekday: 0, scope: { goals: [], trees: ['ns-fresh'], levels: [] }, people: ['jun', 'arjun', 'zara', 'santiago', 'ayesha'], createdBy: 'jun' },
];

/** Sessions where every goal was marked reviewed, by review: the weeks, written for week 45. */
export const HELD: Record<string, number[]> = {
  weekly: [37, 38, 39, 40, 41, 42, 43, 44],
  qbr: [13, 26, 39],
  security: [36, 40, 44],
  devprod: [40, 42, 44],
  reliability: [42, 43, 44],
  dataml: [42, 43, 44, 45],
};
/** This week's sessions already under way: how many goals have been marked reviewed so far. */
export const UNDER_WAY: Record<string, number> = { reliability: 9 };

/** What was said in reviews: [review, week, goal, kind, by, words, action for, due week] */
export type Said = [review: string, week: number, goal: string, kind: 'note' | 'ask' | 'action', by: string, text: string, assignee?: string, due?: number];

export const SAID: Said[] = [
  ['qbr', 13, 'ns-lead', 'note', 'amara', 'Good first quarter. The merge queue pilot is the thing to watch in Q2.'],
  ['qbr', 13, 'ns-ai', 'note', 'amara', 'Ahead already. Tariq, consider whether 60% is ambitious enough.'],
  ['qbr', 13, 'ns-cost', 'action', 'amara', 'Show GPU spend separately in the monthly cost report.', 'ethan', 18],
  ['weekly', 22, 'ns-lead', 'ask', 'amara', 'What’s the latest date for the merge queue pilot that still keeps lead time on plan this year?'],
  ['weekly', 24, 'ns-cost', 'note', 'amara', 'GPU spend is a choice we made; let’s not pretend it’s a miss. Re-plan it.'],
  ['qbr', 26, 'ns-lead', 'note', 'amara', 'Q2 missed on lead time. The merge queue slipped a quarter; the rest held.'],
  ['qbr', 26, 'ns-slo', 'action', 'marisol', 'Storage failover drill for the two services that went down in July.', 'anya', 34],
  ['qbr', 26, 'ns-devsat', 'action', 'ingrid', 'Publish the top five survey actions with owners.', 'julia', 30],
  ['reliability', 30, 'ns-mttr', 'note', 'marisol', 'The July outage is distorting the average. Keep reporting it, but say so each week.'],
  ['security', 36, 'vuln-containers', 'action', 'farah', 'Agree the rebuild trigger with CI/CD and raise it as a request.', 'yasmin', 37],
  ['security', 36, 'vuln-secrets', 'ask', 'farah', 'Do we know how the mobile repository keys got past push protection?'],
  ['weekly', 38, 'ns-cfr', 'action', 'amara', 'Config changes through the pipeline, not the console, for tier-1.', 'pavel', 44],
  ['weekly', 38, 'ns-cfr', 'note', 'daniel', 'Deploys are up 40% since spring and canary coverage hasn’t kept up. That’s the real cause.'],
  ['qbr', 39, 'ns-lead', 'note', 'amara', 'Off track for a second quarter. The critical path is the merge queue, then runners. Both have dates; neither is in Rhea’s hands.'],
  ['qbr', 39, 'ns-lead', 'action', 'amara', 'One-page case for the Q4 runner budget.', 'rhea', 43],
  ['qbr', 39, 'ns-vuln', 'action', 'amara', 'Fix-it week for container findings once the rebuild trigger is live.', 'farah', 46],
  ['qbr', 39, 'ns-ai', 'note', 'amara', 'Raising the target was the right call. Keep an eye on the regulated repositories.'],
  ['qbr', 39, 'ns-env', 'ask', 'amara', 'Is the 15-minute promise realistic for data-backed environments this year, or should we split the goal?'],
  ['weekly', 40, 'ns-env', 'note', 'ingrid', 'Two goals under this one have gone quiet. Camille is chasing.'],
  ['security', 40, 'ns-vuln', 'note', 'farah', 'The rebuild trigger is the single biggest lever. Nothing else will close the gap this quarter.'],
  ['security', 40, 'iam-jit', 'action', 'farah', 'Move the SRE break-glass accounts to just-in-time access.', 'leilani', 47],
  ['devprod', 40, 'lead-mq', 'ask', 'daniel', 'If MergeFlow slip again, can we run the web monorepo on the queue without batching?'],
  ['weekly', 41, 'slo-multiregion', 'note', 'marisol', 'Showing it off track rather than stretching it. Replication work goes into next year’s plan.'],
  ['weekly', 42, 'ns-lead', 'action', 'amara', 'Take the runner budget to the finance review.', 'amara', 46],
  ['devprod', 42, 'lead-flaky', 'action', 'daniel', 'Fix the two shared fixtures behind the new flakes.', 'aiko', 45],
  ['reliability', 42, 'cfr-halt', 'ask', 'marisol', 'How many of this month’s failed changes would the canary halt have caught?'],
  ['dataml', 42, 'fresh-kafka', 'action', 'jun', 'Cost both options: wait for the vendor or self-host the connector.', 'santiago', 44],
  ['weekly', 43, 'ns-devsat', 'note', 'amara', 'The pulse dip lines up with CI times. Nothing new to do; it’s the same critical path as lead time.'],
  ['weekly', 43, 'ns-cost', 'ask', 'amara', 'Storage lifecycle hasn’t been updated for three weeks. Is it still on?'],
  ['security', 44, 'ai-approval', 'note', 'farah', 'Approved for regulated repositories in week 33. Closing this out.'],
  ['security', 44, 'vuln-containers', 'ask', 'farah', 'Is the rebuild trigger live for every base image, or only the slim ones?'],
  ['weekly', 44, 'ns-lead', 'note', 'amara', 'Runner budget goes to finance on the 12th. If it’s approved, Rhea expects queue wait under five minutes by week 49.'],
  ['weekly', 44, 'ns-vuln', 'action', 'amara', 'Report container findings separately until the fix-it week is done.', 'farah', 48],
  ['weekly', 44, 'ns-env', 'action', 'ingrid', 'Decide whether to split data-backed environments into their own goal.', 'camille', 47],
  ['devprod', 44, 'dep-jenkins', 'ask', 'daniel', 'What’s left on Jenkins after the payments team moves?'],
  ['devprod', 44, 'lead-ci-time', 'ask', 'daniel', 'If the runner budget is approved on the 12th, how soon does queue wait drop under five minutes?'],
  // The next session opens with this (deep review P2): Tariq agreed it in week 44, due in week 46.
  ['devprod', 44, 'lead-review-rota', 'action', 'daniel', 'Name a review rota for the last repositories without one.', 'tariq', 46],
  ['reliability', 44, 'ns-slo', 'note', 'marisol', 'Clean month. 99.97% across tier-1.'],
  ['dataml', 44, 'ml-gpu', 'action', 'jun', 'Pilot queue-based scheduling with the assistant team’s training jobs.', 'obinna', 48],
  ['weekly', 44, 'cost-storage', 'ask', 'amara', 'No update since week 40. Is the lifecycle work paused, and if so, what does that do to cost per request?'],
  ['reliability', 45, 'ns-mttr', 'note', 'marisol', 'Back on plan now July is out of the average. Well done.'],
  ['reliability', 45, 'cfr-halt', 'ask', 'marisol', 'Is week 45 still right for the halt on tier-1, given the burn-rate signal arrived late?'],
];

/**
 * The questions answered and the actions marked done, by whoever must respond (the goal's owner; whoever does the
 * action): [goal, the start of what was said, week, the answer or the note it was marked done with]. Every other
 * question and action from a review is still open: one ask model, so a comment or a check-in doesn't close one.
 */
export const CLOSED: [goal: string, said: string, week: number, text: string][] = [
  ['ns-cost', 'Show GPU spend separately', 18, 'GPU spend has its own line in the monthly cost report from June.'],
  ['ns-lead', 'What’s the latest date for the merge queue pilot', 22, 'Week 38 for the web monorepo. Any later and lead time can’t make its plan this year.'],
  ['ns-slo', 'Storage failover drill', 33, 'Drill run on both services; failover took four minutes each.'],
  ['ns-devsat', 'Publish the top five survey actions', 30, 'Published on the portal, each with an owner.'],
  ['vuln-containers', 'Agree the rebuild trigger with CI/CD', 36, 'Raised as a request to Rhea.'],
  ['vuln-secrets', 'Do we know how the mobile repository keys', 37, 'A personal token pushed from a laptop with the local hook turned off. Push protection now runs on the server as well.'],
  ['ns-lead', 'One-page case for the Q4 runner budget', 43, 'Sent to Amara: 18% more CI spend for Q4, about six hours off lead time.'],
  ['ns-env', 'Is the 15-minute promise realistic', 40, 'Not with today’s snapshot restore. Pre-warmed snapshots get the top five under 15 minutes; the rest may need a goal of their own.'],
  ['lead-mq', 'If MergeFlow slip again', 41, 'Yes. Without batching it still halves the queue wait; we only lose the batch speed-up.'],
  ['lead-flaky', 'Fix the two shared fixtures', 45, 'Both fixtures fixed. The rate should drop under 1.8% next week.'],
  ['cfr-halt', 'How many of this month’s failed changes', 43, 'Two of the three. The third was a console config change, which no canary sees.'],
  ['fresh-kafka', 'Cost both options', 43, 'Both are in the doc: self-hosting is about two weeks’ work and £3k a month less, but we own its upgrades.'],
  ['ns-cost', 'Storage lifecycle hasn’t been updated', 43, 'Still on. Jonah is on the incident rota this month and will update it next week.'],
];

/** Who watches what: [person, kind, goal or level] */
export const WATCHES: [string, 'goal' | 'tree' | 'level', string][] = [
  ['amara', 'level', 'north-star'], ['amara', 'level', 'svp'],
  ['grace', 'level', 'north-star'], ['lucia', 'level', 'north-star'], ['wen', 'tree', 'ns-lead'], ['wen', 'tree', 'ns-env'], ['wen', 'goal', 'lead-mq'],
  ['nadia', 'tree', 'ns-lead'], ['nadia', 'tree', 'ns-slo'],
  ['daniel', 'tree', 'ns-ci'], ['daniel', 'tree', 'ns-deploy'], ['daniel', 'tree', 'ns-lead'],
  ['bjorn', 'tree', 'ns-cost'], ['bjorn', 'goal', 'slo-multiregion'],
  ['marisol', 'tree', 'ns-slo'], ['marisol', 'tree', 'ns-cfr'], ['marisol', 'tree', 'ns-mttr'],
  ['farah', 'tree', 'ns-vuln'], ['farah', 'goal', 'ai-approval'], ['farah', 'goal', 'dep-gates-sec'],
  ['jun', 'tree', 'ns-fresh'], ['ingrid', 'tree', 'ns-devsat'], ['ingrid', 'tree', 'ns-env'], ['ingrid', 'goal', 'ns-ai'],
  ['rhea', 'tree', 'ns-env'], ['rhea', 'goal', 'lead-review'], ['rhea', 'goal', 'vuln-containers'],
  ['tariq', 'tree', 'ns-devsat'], ['tariq', 'goal', 'lead-mq'],
  ['oskar', 'goal', 'ns-ai'], ['oskar', 'goal', 'lead-review'], ['oskar', 'goal', 'devsat-localdev'],
  ['mateo', 'tree', 'ns-slo'], ['pavel', 'tree', 'ns-cfr'], ['camille', 'goal', 'cost-idle'], ['ethan', 'goal', 'ml-gpu'],
  ['zara', 'goal', 'ns-cost'], ['arjun', 'goal', 'fresh-lakehouse'], ['akosua', 'goal', 'slo-failover'], ['omar', 'goal', 'vuln-containers'],
  ['yuki', 'tree', 'ns-mttr'], ['leilani', 'goal', 'vuln-secrets'],
];

/** Saved views: [person, name, params, pinned by an admin?] */
export const VIEWS: [string, string, string, boolean?][] = [
  ['grace', 'Division at a glance', 'show=levels&view=table', true],
  // The No recent update rule's own threshold (two weeks, RULES.staleDays), not a second one (demo review, 8 Nov, item 6).
  ['grace', 'No update for 2 weeks or more', 'quiet=2&sort=last', true],
  ['amara', 'North stars off track or at risk', 'level=north-star&status=off,risk'],
  ['amara', 'Waiting on a decision', 'needs=decision&sort=worst'],
  ['rhea', 'My goals by status', 'show=mine&view=board'],
  ['farah', 'Security and access', 'team=sec,iam&view=table'],
  ['jun', 'Data and ML map', 'feeds=ns-fresh&view=map'],
  ['tariq', 'Furthest from plan', 'sort=gap&view=table'],
  ['oskar', 'AI goals', 'q=AI'],
];
