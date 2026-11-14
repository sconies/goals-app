/* The platform requirements the handoff kit review found missing (gap 5, backlog KT): R5 (notifications, digests and the
   weekly habit), R7 (retention, privacy and erasure), R8 (audit), R9 (observability and service levels) and R10
   (accessibility). Like R1 to R4 (src/spec/internal.ts), each is written for the internal app, which gets the machinery
   from its own platform: why, the rule, what Faro does today, worked examples, acceptance checks and the nearest rebuild
   stage. The figures are proposals for the internal team to confirm, never measurements.

   An example with `run` is run against Faro's code by src/spec/internal.test.ts and by the generator. */
import { onTimeStreak, reviewDate } from '../domain/progress';
import type { CheckIn, Goal, Snapshot } from '../domain/types';
import { CYCLE } from './examples';
import type { InternalRequirement } from './internal';

const STAGE_2 = { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine' };
const STAGE_3 = { file: 'stage-3-core-screens.md', title: 'Stage 3: the core screens and journeys' };

/** Maya's on-time streak in week 6 when her one goal was checked in on the review day in weeks 1 to 5, except week
    `late`, when it came in the day after. What Faro's rule (`onTimeStreak`) gives today. */
function streakWithOneLateWeek(late: number): string {
  const goal = { id: 'g-1', ownerId: 'p-maya', createdAt: '2026-09-01T00:00:00Z' } as Goal;
  const day = (w: number) => (w === late ? `${reviewDate(CYCLE, w).slice(0, 8)}${String(Number(reviewDate(CYCLE, w).slice(8, 10)) + 1).padStart(2, '0')}` : reviewDate(CYCLE, w));
  const checkIns = [1, 2, 3, 4, 5].map((w) => ({ id: `c-${w}`, goalId: goal.id, authorId: 'p-maya', week: w, postedAt: `${day(w)}T09:00:00Z` }) as CheckIn);
  const n = onTimeStreak('p-maya', { goals: [goal], checkIns } as unknown as Snapshot, CYCLE, 6);
  return `${n} week${n === 1 ? '' : 's'} in a row`;
}

export const R5: InternalRequirement = {
  id: 'R5', file: 'r5-notifications-and-habits', title: 'R5. Notifications and the weekly habit',
  summary: 'Telling people things, through the company’s email, Slack, Teams and phones: asks at once, one reminder before the review, a weekly digest in set words, check-in from a notification, and the habit rules: never shame, streaks that forgive, one measure of the habit. Also one sign-in with a role per workspace, and feedback kept per workspace.',
  why: [
    'Faro sends nothing: no email, no chat message, no push. People find what is asked of them on Home. That suits a demo; in a company of 15,000 the weekly check-in only becomes a habit if the app reaches people where they already are, and the rules elsewhere assume it does: [R6b](r6b-delegates.md) says “the owner is told”, [R6c](r6c-planning-round.md) says “Priya is asked again”.',
    'Delivery is the platform’s (its mail service, its Slack and Teams apps, its phone app). What the rebuild can copy from Faro is the content and the tone: what is said, in what order, and what is never said. The product reviews of 8 and 12 Nov both asked for the same rule: reward honesty and early warnings, never shame.',
  ],
  rule: [
    '1. **Channels.** Notifications go by email, Slack or Microsoft Teams (whichever the company uses), and push to the phone app. Each person picks their channels and can turn each kind below off, except asks addressed to them. Nothing is sent outside 08:00 to 19:00 on a working day in the person’s own zone ([R3](r3-time-zones.md)); it waits until the next morning. Every message says which workspace it comes from.',
    '2. **What is sent, and when.**',
    '   - **At once:** an ask addressed to you (an ask for an update, a question, a decision or help); the answer to an ask you made; being named a delegate ([R6b](r6b-delegates.md)); a proposed goal you must agree ([R6c](r6c-planning-round.md)).',
    '   - **One reminder:** at 09:00 on the day before the review day, for each of your goals whose check-in is due this week and not yet posted. One message for all of them, never one per goal. No second reminder.',
    '   - **The weekly digest:** at 09:00 on the first working day of the week, one per person.',
    '   - Nothing else. A watched goal changing status goes in the digest, not in a message of its own.',
    '3. **The digest’s words.** Its title is “Your week in {workspace} (week {n})”. Then, in this order, leaving out any section with nothing in it: what is asked of you (oldest first, each with who asks and the goal); your check-ins due before the review (“{n} check-ins due before the review on {day date}”); the goals you watch whose status changed since the last digest, worst first by the status rule’s rank, each as “{goal} is {status} (was {status})”; and good news, goals that came back on track or reached their target (“{goal} is back On track”, “{goal} reached its target”). Status words are the status rule’s own ([the status rule](../../core/rules/status.md)), with their shape where the channel can show one. A digest with nothing in it is not sent.',
    '4. **Check in from a notification.** The reminder and the digest each carry, per goal, a way to check in: in the phone app and email it opens that goal’s check-in; in Slack and Teams a short form (the owner’s call and one line) posts the check-in there. Either way it is the same action as in the app (`postCheckIn`, [the actions](../../core/actions.md)), with the same rules and refusals, and its Via names the channel.',
    '4a. **Answer an ask from a notification** the same way: the answer goes through `answerRequest`.',
    '5. **Never shame.** No list, digest, count or screen ranks people, or names who hasn’t checked in, to anyone but themselves and the person who asked them. Lists rank goals by status and teams by counts. An ask for an update is between the asker and the owner. A goal off track is reported with what is being done about it (its decision or help, its review), never with words like “failed”, “overdue” or “missed”. Good news is said as plainly as bad.',
    '6. **Streaks forgive.** A person’s on-time streak counts weeks in a row in which every goal they own that was due was checked in by the review day. One late or missed week in any eight is forgiven: the streak pauses for that week and goes on, it doesn’t start again at 0. Weeks with a delegate in place ([R6b](r6b-delegates.md)) count when the delegate checked in on time. A streak is shown only to its own person.',
    '7. **The habit measure.** The one number the internal team watches for the habit: of the goals whose check-in was due in a week, the share checked in before that week’s review without a nudge. A nudge is the reminder (rule 2) or an ask for an update, sent for that goal that week before the check-in. Counted per workspace and per team, never per person, and shown to admins and team leads beside the week’s count.',
    '8. **One sign-in, a role per workspace.** A person signs in once ([R2](r2-single-sign-on.md)) and is the same person in every workspace they belong to; what can differ is their role there (member or admin). When switching workspace changes their role, the app says so once on landing (“You’re a member here.”). The switcher shows their role on each row.',
    '9. **Feedback per workspace.** Feedback about the app is kept per workspace: its people read it, and that workspace’s admins change its status (In hand, Fixed, Won’t fix, New again; [R1](r1-sign-in-and-access.md)). Markups to the app’s builders are the platform’s concern, not a workspace’s.',
  ].join('\n'),
  today: [
    'Faro sends nothing: no email, no chat, no push (“Faro doesn’t send email”, the set-up spec). Home shows what is asked of each person today. An ask for an update (`askForUpdate` in `src/domain/actions.ts`) is its only nudge, and it is shown, not sent.',
    'The on-time streak is `onTimeStreak` in `src/domain/progress.ts`, shown on Home and as “N weeks in a row on time” when a week’s last check-in is posted (`src/screens/CheckInFlow.tsx`). It counts only check-ins the owner posted by the review day, and a late week starts it again at 0: it doesn’t forgive yet (CF4 in the designs).',
    'Home ranks goals and teams, never people. No measure of the habit is built; the planned Home cell (HM7) counts goals checked in by the due day, which is the measure without “without a nudge”, since Faro sends none.',
    'Who you are is a pick kept per workspace in the browser (`src/adapters/local.ts`); the rebuild’s one sign-in replaces it ([R2](r2-single-sign-on.md)).',
    'Feedback is one inbox across every workspace and the demo; only admins change a status (`mayTriage` in `src/markup/model.ts`, Lane, 12 Nov). In Faro that check runs in the browser, on the person picked, which is accepted for Faro (Lane, 14 Nov); the rebuild enforces it on the server ([R1](r1-sign-in-and-access.md)).',
  ],
  examples: [
    { given: 'Monday of week 10, 09:00 in Maya’s zone. Priya asked her “Can we move the launch?” on Payments API last Thursday; two of her three goals are due before Wednesday’s review; Checkout latency, which she watches, went from On track to At risk; Onboarding came back on track.', then: 'One digest: “Your week in Platform (week 10)”; “1 ask for you: Priya Shah asks “Can we move the launch?” on Payments API”; “2 check-ins due before the review on Wednesday 11 Nov”; “Checkout latency is At risk (was On track)”; “Onboarding is back On track”.' },
    { given: 'Oskar has nothing asked of him, nothing due, and no watched goal changed.', then: 'No digest is sent.' },
    { given: 'Tuesday 09:00, the day before the review: Maya has posted one of her two due check-ins.', then: 'One reminder, for the one goal still due, with a way to check in on it. None on Wednesday.' },
    { given: 'Maya answers the reminder in Slack: On track, “Load test passed”.', then: 'The check-in is posted by `postCheckIn` as Maya, with Via Slack; the same refusals apply as in the app (a goal she doesn’t own is refused with the app’s words).' },
    { given: 'Priya asks for an update on Oskar’s goal at 21:00 on Friday.', then: 'Oskar is told at 08:00 on Monday, in his own zone.' },
    { given: 'A team lead opens the team’s week: 3 of 12 goals are not checked in.', then: 'They see the 3 goals and their owners’ goals as goals; no list of people who are late, and no ranking of the team’s people.' },
    { given: 'Maya checked in on the review day in weeks 1 to 5, except week 3, when she checked in the day after. It is week 6.', then: streakWithOneLateWeek(3), run: () => streakWithOneLateWeek(3) },
    { given: 'The same in the internal app.', then: 'Her streak is 5 weeks in a row, with week 3 forgiven: one late week in eight pauses it, it doesn’t start again.' },
    { given: 'Week 10: 118 goals were due. 98 were checked in before the review, 9 of them after a reminder or an ask for an update.', then: 'The habit measure for the week is 89 of 118, 75%.' },
    { given: 'Oskar is an admin in Platform and a member in Payments. He switches to Payments.', then: 'He is still Oskar Lind; the app says once “You’re a member here.”' },
  ],
  checks: [
    'Each kind of notification in rule 2 is sent on its trigger, once, in the person’s chosen channels, and nothing else is sent; nothing arrives outside 08:00 to 19:00 on a working day in the person’s zone.',
    'For a seeded week, the digest for each person in the demo workspace matches rule 3’s order and words, leaves out empty sections, and isn’t sent when empty.',
    'A check-in or an answer made from a notification goes through the same action as the app, records its channel as Via, and is refused with the app’s words when the app would refuse it.',
    'No screen, digest, export or AI tool ranks people or lists who hasn’t checked in to anyone but that person and whoever asked them (a check over every screen and message template).',
    'The streak forgives one late or missed week in any eight, counts a delegate’s on-time check-in, and is shown only to its person.',
    'The habit measure for a seeded week matches a count by hand, per workspace and per team, and is never shown per person.',
    'Switching to a workspace where the role differs says the new role once; the person’s identity never changes on switching.',
    'Feedback from one workspace is never shown in another, and only that workspace’s admins can change its status.',
  ],
  stage: { ...STAGE_3, why: 'notifications are screens in other places: they say the core rules’ results (asks, due check-ins, status) in set words, and act through the same actions. The habit measure and the forgiving streak are rules, so they also land in stage 1’s rules as the internal team adds them.' },
  decided: [
    'The habit measure (the 12 Nov evaluation’s decision 2, recommended answer): Faro sends no nudges, so its own measure, if built, counts by the due day; the rebuild, which does send them, measures “before the review, without a nudge” as rule 7 says.',
    'Digests are spec only (decision 3, recommended answer): the words and rules are here as worked examples; Faro builds no preview page and no Slack or Teams post.',
    'One reminder, the day before the review, and a weekly digest on Monday: proposals for the internal team to confirm, chosen as the least that keeps the habit without nagging.',
    'One forgiven week in eight is a proposal; the rule is that a streak pauses rather than resets.',
    'The rest of backlog R5 (view-only stakeholders and finer roles, Cmd-K search) is not written here: roles stay as R1 has them, and search is backlog 0a.',
  ],
};

export const R7: InternalRequirement = {
  id: 'R7', file: 'r7-retention-and-privacy', title: 'R7. Data retention, privacy and erasure',
  summary: 'What is personal data, how long each kind of record is kept, what a leaver’s record keeps, and how a person sees everything held about them or has it erased.',
  why: [
    'At company size the app holds 15 million change-log entries a year about named people, and words people wrote about their work. Without a retention rule it keeps everything forever; without an erasure route, a request under data protection law has no answer. The requirements say nothing is erased, while the schema deletes by cascade: the rebuild needs one rule.',
    'Faro never holds real data, so it has none of this. The internal app does from its first day.',
  ],
  rule: [
    '1. **What is personal.** A person’s record (name, email, job title, team, manager, sign-in id) is personal data. So is everything a person wrote: check-in notes, comments, asks and answers, review notes, wrap-ups, feedback. Goals, plans and numbers are the company’s internal information. Usage records carry ids, never what people wrote (as Faro’s do).',
    '2. **How long things are kept.**',
    '   - Goals, check-ins, asks, decisions, reviews and their change-log entries: while their cycle is live and for 3 years after it ends. Then the cycle is archived (read-only, out of search and every count) and deleted 7 years after it ends.',
    '   - Something removed, stopped or marked as left: restorable for 30 days (as in Faro), then deleted for good within 30 more days, unless it is a goal or a person with history, which stays as stopped or left under the rule above.',
    '   - Usage records: raw 90 days, daily totals 13 months.',
    '   - Backups: 30 days ([R4](r4-scale-and-safety.md)); anything deleted is gone from them when they age out.',
    '   - The audit trail: 7 years ([R8](r8-audit.md)).',
    '3. **Deletes are explicit.** A record is deleted only by a rule here or by an action a person takes, never by a database cascade: no foreign key deletes a goal’s check-ins, or a person’s goals, behind the rule’s back.',
    '4. **Leavers.** When someone leaves (by hand, or through the directory feed, [R6a](r6a-organisation.md)), their goals and open asks are handed over as Faro does, and at once their sign-in, tokens, watches, saved views and settings are removed. Their name stays on what they wrote and did, because that history is the company’s record. Their email and job title are removed after 90 days.',
    '5. **Seeing what is held.** A person may ask for everything held about them; an admin, or the company’s privacy team, exports it within 30 days: their record, everything they wrote, the asks to and from them, the change-log and audit entries about their actions, and usage records under their id, in the one spreadsheet format and as JSON. The export is itself recorded ([R8](r8-audit.md)).',
    '6. **Erasure.** On a valid request (decided by the company’s privacy team, not by the app), the person’s record is pseudonymised: their name becomes “Former colleague” with a number, their email, job title and sign-in id are removed, and the items the request names (a comment, a note) are deleted. Goals and numbers stay. The change log and the audit trail keep the person’s id, which now resolves to the pseudonym, so they are not rewritten.',
    '7. **Deleting a workspace** removes everything kept about it, its usage records included, as Faro does; its audit entries stay for their 7 years, pseudonymised.',
  ].join('\n'),
  today: [
    'Faro never holds real data, so it has no classification, no retention periods, no subject-access export and no erasure.',
    'Recently removed lists what was removed, stopped or marked as left in the last 30 days, and an admin or whoever removed it can restore it (`recentlyRemoved` and `restoreRemoved` in `src/domain/removal.ts`); after that it drops off the list, but the row stays for good.',
    'Marking someone as left hands over their goals and asks and keeps their record (`markPersonLeft` in `src/domain/removal.ts`); a person with no history can be deleted.',
    'Deleting a workspace removes everything kept about it, its usage records included; markups stay, as messages to the builders (migration 0032, `supabase/migrations/0032_delete_workspace_fully.sql`).',
    'Usage records keep raw rows 90 days, rolled up nightly into daily totals (migration 0022). They carry ids and an allow-list of attributes, never what a person typed (`src/telemetry/attributes.ts`).',
    'Any workspace can be exported whole in the one spreadsheet format ([the export format](../../core/export-format.md)), but not one person’s data on its own.',
  ],
  examples: [
    { given: 'The 2026 Q4 cycle ended on 6 Dec 2026.', then: 'It is live in search and counts until it is archived on 6 Dec 2029, read-only after that, and deleted on 6 Dec 2033.' },
    { given: 'Maya removes a comment on 1 Oct.', then: 'She or an admin can restore it until 31 Oct; it is deleted for good by 30 Nov, and gone from backups by 30 Dec.' },
    { given: 'Oskar leaves on 1 Oct.', then: 'That day his goals and asks are handed over and his sign-in, tokens, watches and views are removed; his check-ins still say Oskar Lind; his email and job title are removed on 30 Dec.' },
    { given: 'Oskar asks for everything held about him.', then: 'Within 30 days the privacy team sends one spreadsheet and one JSON file: his record, his check-in notes and comments, the asks to and from him, every change he made, and usage records under his id. The export is in the audit trail.' },
    { given: 'The privacy team grants Oskar’s erasure request, naming one comment.', then: 'His name shows as “Former colleague 14” everywhere; his email, title and sign-in id are gone; the named comment is deleted; his goals’ numbers and the change log stay, under the pseudonym.' },
    { given: 'An admin deletes a goal with no check-ins.', then: 'The goal goes; nothing else is deleted with it by a cascade, and the change log records the delete.' },
  ],
  checks: [
    'A nightly job archives cycles that ended 3 years ago and deletes those that ended 7 years ago, and records what it did; a seeded old cycle is gone from search and counts the morning after.',
    'Removed things are restorable for 30 days and gone within 60; a check over the database finds nothing removed more than 60 days ago.',
    'The schema has no cascading delete; every delete is made by a rule or an action and is in the change log.',
    'Marking someone as left removes their sign-in, tokens, watches, views and settings the same day, and their email and job title after 90 days.',
    'A subject-access export for a seeded person contains every record listed in rule 5 and nothing about anyone else.',
    'After an erasure, the person’s name, email, title and sign-in id appear nowhere (screens, exports, AI tools, search), and the change log and audit trail still read correctly.',
    'Deleting a workspace leaves none of its rows but its audit entries.',
  ],
  stage: { ...STAGE_2, why: 'retention, archiving, leavers and erasure are how records are stored, changed and removed.' },
  decided: [
    'The periods (3 years live, 7 years in all, 90 days for a leaver’s email, 13 months for daily usage totals) are proposals for the company’s privacy and legal teams to set.',
    'Names stay on what people wrote after they leave, because the record of who said what is the company’s; erasure pseudonymises instead of deleting history.',
    'Removed things are now deleted for good after the 30 days, where Faro keeps the row: the review of 12 Nov found no rule saying how long they are kept.',
  ],
};

export const R8: InternalRequirement = {
  id: 'R8', file: 'r8-audit', title: 'R8. Audit',
  summary: 'A record of who did what that no one can change, with admins’ exports and every AI token’s use in it, kept 7 years, and exported by those allowed to.',
  why: [
    'R1’s check 6 covers who changed what. A security review will also ask whether the record can be edited, whether admins’ reads and exports and every token’s use are in it, how long it is kept and who may take it away. Faro’s change log answers the first only: it is also where comments live, and comments can be edited and removed.',
    '[R1](r1-sign-in-and-access.md) lets an admin make a token for someone else and see its secret once. Until that changes, the audit trail is what shows who really made a change.',
  ],
  rule: [
    '1. **What is recorded.** Every change, as Faro’s change log records it: when, who, what, before and after, and by which route (the app, an import, a bulk edit, the AI through a token, a notification, a delegate acting for someone, the directory feed). Also: every export (a workspace, a view, a person’s data), every token made, used or revoked (each AI tool call, with its tool’s name and outcome, never its arguments), every change of someone’s role, every restore, and every admin change in Data’s tables. Sign-ins come from the identity provider’s own log ([R2](r2-single-sign-on.md)).',
    '2. **Who did it, truly.** An entry names the person whose rights were used and, when someone else acted, how: “by token {name}, made by {admin}”, “as delegate for {owner}”, “by the directory feed”.',
    '3. **No one can change it.** The trail is append-only: no role the app or its admins hold may update or delete an entry; a correction is a new entry. It is written to storage the app can’t rewrite (write-once, or chained by hash and checked daily). Comments and notes are records of their own, not audit entries; editing one adds an entry.',
    '4. **Kept 7 years**, beyond the cycle and the workspace ([R7](r7-retention-and-privacy.md)). Erasure doesn’t rewrite it: entries keep the person’s id.',
    '5. **Who may read and export it.** Everyone sees Activity, the everyday view of a workspace’s changes. A workspace’s admins can read and export its full trail, filtered by person, goal, route and dates, as CSV and JSON; each export is itself an entry. The company’s security team reads every workspace’s trail through the platform.',
  ].join('\n'),
  today: [
    'Every change is a change-log entry (`Change` in `src/domain/types.ts`, table `okr_changes`): when, who, the record, the action, a summary and the before and after of each field, plus the import or bulk edit it belonged to, so it can be undone. Activity shows it.',
    'Check-ins record the route they came by (Via), and an admin’s correction records the admin as author ([R1](r1-sign-in-and-access.md)).',
    'Comments are stored as change-log entries, and can be edited by whoever wrote them and removed by them or an admin (`editComment` and `deleteComment` in `src/domain/removal.ts`): the log is not append-only.',
    'Each MCP tool call is recorded as a span with the person’s and workspace’s ids, never its arguments (migration 0022), kept 90 days. Exports and reads are not recorded. Deleting a workspace deletes its change log (migration 0032).',
  ],
  examples: [
    { given: 'Priya makes a token for Oskar, and the AI posts a check-in with it.', then: 'The entry says the check-in was posted by Oskar Lind “by token Oskar’s assistant, made by Priya Shah”, with the tool’s name.' },
    { given: 'Maya edits her comment.', then: 'The comment changes; a new audit entry records the edit, before and after. The earlier entry is unchanged.' },
    { given: 'An admin tries to delete an audit entry through the database role the app uses.', then: 'Refused: the role has no update or delete on the trail.' },
    { given: 'Priya exports Payments’ goals view.', then: 'An entry records Priya, the view, the time and how many rows.' },
    { given: 'The security team asks for every change made by tokens in October.', then: 'An admin exports the trail filtered by route “token” and October, as CSV; that export is itself an entry.' },
  ],
  checks: [
    'Every action in [the actions](../../core/actions.md), by every route, writes an entry with its route; a test runs each action once by each route and finds its entry.',
    'Exports, token use, role changes, restores and admin corrections each write an entry.',
    'No database role the app or an admin holds can update or delete an entry; the daily integrity check fails when an entry is changed by hand.',
    'Entries older than 7 years are the only ones ever removed; deleting a workspace or erasing a person leaves the trail readable.',
    'An admin’s export, filtered, contains exactly the matching entries and is itself recorded.',
  ],
  stage: { ...STAGE_2, why: 'the trail is written by the change engine on every save, beside the records.' },
  decided: [
    'Activity stays as the everyday view for everyone; the full trail, with exports and token use, is for admins and the security team.',
    '7 years is a proposal for the company’s security and legal teams to set.',
    'Whether an admin may make a token for someone else at all is R1’s question (the review of 12 Nov recommends not); R8 makes it visible either way.',
  ],
};

export const R9: InternalRequirement = {
  id: 'R9', file: 'r9-observability', title: 'R9. Observability and service levels',
  summary: 'The signals the internal app must send to the company’s tools, the service levels it promises, and what wakes someone up.',
  why: [
    'Faro records a little about how it is used and checks itself after each deploy; its Observability page and alerts were dropped on 8 Nov for the company’s tooling to cover. The internal app is something people rely on every Monday morning: it needs promised service levels and a list of what is watched, or no one knows it is broken until a review stalls.',
  ],
  rule: [
    '1. **Signals, to the company’s tools** (OpenTelemetry, or what the platform uses): a trace for every request and every action, with the action’s name, the workspace’s id, the outcome (done, refused, failed) and how long it took; structured logs; errors with their stack. As in Faro, never what people wrote, and never a tool’s arguments.',
    '2. **Service levels**, measured monthly:',
    '   - available (a read and a save both work) 99.5% of the time on working days 07:00 to 20:00 in the home zone, 99% otherwise;',
    '   - reads within 500 ms and saves within 1 s at the 95th percentile ([R4](r4-scale-and-safety.md));',
    '   - fewer than 1 in 1,000 saves fail for a reason other than a rule’s refusal;',
    '   - the week’s turn ([R4](r4-scale-and-safety.md), rule 2) finished by 06:00 in the home zone; the directory feed ([R6a](r6a-organisation.md)) applied by 06:00 each day; digests ([R5](r5-notifications-and-habits.md)) sent by 09:30.',
    '3. **What pages the on-call person:** the availability budget burning more than 2% of the month in an hour; more than 1% of saves failing for 5 minutes; the week’s turn not finished by 06:00; the directory feed failing twice in a row; no backup in 24 hours; the check after a deploy failing. **What opens a ticket instead:** a page-load budget broken for a day, more than 1% of notifications not delivered, an error new since the last deploy.',
    '4. **After every deploy**, a check that the app reaches its database, its file store and its identity provider, as Faro’s does; a failure rolls the deploy back.',
    '5. **Recording off.** An admin’s switch turns off usage analytics for a workspace (as Faro’s does). The signals in rule 1, which carry no content, are how the service is run and stay on.',
    '6. **No page inside the app.** Dashboards and alerts live in the company’s own tools.',
  ].join('\n'),
  today: [
    'Each MCP tool call is recorded as a span, with the database reads and saves inside it, in `okr_telemetry_spans` (migration 0022); a W3C `traceparent` header joins a caller’s trace. Spans carry the tool’s name, the person’s and workspace’s ids and the class of any failure, never a tool’s arguments or answers (`docs/mcp.md`, “Telemetry”).',
    'An admin can turn recording off for a workspace (`setRecording`); then nothing is recorded or sent for it, from the app or the server.',
    'After every deploy, `GET /api/mcp?check` says whether the server reaches the database and can read pictures, and CI fails when something is missing (`.github/workflows/deploy-check.yml`).',
    'A markup carries the steps before it and the visit’s errors, so a builder sees what happened (the builder inbox).',
    'No service levels, no alerts, and no trace of the app’s own screens. Dropped on 8 Nov, for the company’s tooling to cover: an overlay in the app, an Observability page, a weekly review of the traces by Claude, and alerts of Faro’s own.',
  ],
  examples: [
    { given: 'Oskar posts a check-in.', then: 'One trace: postCheckIn, workspace id, done, 180 ms, with the database save inside it. No note text, no value.' },
    { given: 'Saves start failing at 08:40 on Monday: 3% for six minutes.', then: 'The on-call person is paged at 08:45.' },
    { given: 'The week’s turn is still running at 06:00 on Monday.', then: 'The on-call person is paged; screens keep showing last week’s summaries, marked as being worked out ([R4](r4-scale-and-safety.md)).' },
    { given: 'An admin turns recording off for Payments.', then: 'Usage analytics stop for Payments; traces of its requests are still sent, without content, and its saves still count toward the service levels.' },
    { given: 'A deploy can’t reach the identity provider.', then: 'The check after it fails and the deploy is rolled back.' },
  ],
  checks: [
    'Every action and every request leaves a trace with its name, workspace, outcome and duration; a check over a day’s traces finds no field holding what a person wrote.',
    'Each service level in rule 2 has a measure on the company’s dashboard, and each alert in rule 3 has fired in a rehearsal.',
    'The check after a deploy covers the database, the file store and the identity provider, and a failure rolls back.',
    'Turning recording off stops usage analytics for that workspace and no other signal.',
  ],
  stage: { ...STAGE_2, why: 'the signals are sent where actions run and records are saved; the service levels cover the core data first.' },
  decided: [
    'The figures (99.5%, 1 in 1,000, 06:00, 09:30, the alert thresholds) are proposals for the internal team and the platform’s on-call to set.',
    'This page replaces “Observability, as an idea”: what Faro records today is kept above, and the dropped ideas are listed as dropped.',
    'Operational signals stay on when recording is off, because they carry no content; Faro, which has no operators, turns everything off.',
  ],
};

export const R10: InternalRequirement = {
  id: 'R10', file: 'r10-accessibility', title: 'R10. Accessibility',
  summary: 'WCAG 2.2 at level AA on every screen, checked by machine and by hand: status as a shape and a word, the keyboard, screen readers, zoom and reflow.',
  why: [
    'Faro’s requirement (A11Y) is one sentence: no serious or critical axe-core violations, and status is a shape plus a word. A machine check finds about a third of real problems, and the kit named no standard, so the rebuild had nothing to be accepted against.',
  ],
  rule: [
    '1. **The standard:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/), level AA, on every screen and every notification ([R5](r5-notifications-and-habits.md)), in both themes, at 390 and 1440 pixels wide. If the company’s own policy asks for more (EN 301 549, say), that applies too.',
    '2. **Status is a shape and a word, never colour alone** ([the design rules](../../core/design-rules.md)): a status cell reads as its word to a screen reader.',
    '3. **The keyboard:** everything can be reached and done with the keyboard alone, in the order it reads; focus is always visible; nothing traps it; a dialog takes focus when it opens and gives it back when it closes; a skip link leads past the navigation.',
    '4. **Screen readers:** every control has a name; tables have headers; a save, a refusal or an error is announced where it happens; a chart has its numbers as a table beside it.',
    '5. **Zoom and motion:** text zoomed to 200% and a width of 320 pixels lose nothing and need no sideways scrolling; animation stops when the system asks for reduced motion.',
    '6. **Targets** are at least 24 by 24 pixels.',
  ].join('\n'),
  today: [
    'Requirement A11Y (`evals/requirements.json`): the evals run axe-core on every screen and fail on any serious or critical violation (`evals/journeys.cjs`); requirement PHONE checks every screen at 390 wide with no sideways scrolling.',
    'Status is always a shape plus a word ([the design rules](../../core/design-rules.md)), and design check P6 enforces it.',
    'No standard is named, and nothing checks the keyboard, screen readers, zoom or reduced motion.',
  ],
  examples: [
    { given: 'A goal is At risk in the Goals table.', then: 'It shows its shape and the words “At risk”; a screen reader reads “At risk”, not a colour.' },
    { given: 'Maya posts a check-in with the keyboard only.', then: 'She reaches the goal, picks her call, writes her note and saves without a mouse; focus is visible throughout, and “Saved” is announced.' },
    { given: 'Oskar opens a dialog to stop a goal, then closes it.', then: 'Focus moves into the dialog and back to the button that opened it.' },
    { given: 'Priya zooms to 200% on a laptop.', then: 'Every screen reflows to one column with nothing cut off and no sideways scrolling.' },
  ],
  checks: [
    'axe-core finds no serious or critical violation on any screen, in both themes, at both widths (as Faro’s evals do).',
    'Each core journey ([the journeys](../../core/journeys.md)) is done with the keyboard alone in CI, with focus visible at every step.',
    'Before each release, a person does the check-in, a review and the Goals table with NVDA and Firefox and with VoiceOver and Safari, and records what they found.',
    'Every screen at 200% zoom and at 320 pixels wide passes the PHONE check.',
    'An outside audit against WCAG 2.2 AA before the first company-wide launch, and yearly after.',
  ],
  stage: { ...STAGE_3, why: 'accessibility is built and checked with the screens; stage 1’s status words are what a screen reader reads.' },
  decided: [
    'WCAG 2.2 AA, as the current standard most companies and EN 301 549 are moving to; the company’s policy can raise it.',
    'Faro keeps its machine check; the keyboard and screen-reader checks are for the rebuild, which has real users.',
  ],
};
