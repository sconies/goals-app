/* Requirements for the internal app that Faro doesn't build (backlog 8r): spec/requirements/internal/. Faro is a model
   the company's internal team copies and plugs into its own platform, plus a demo that never holds real data. What that
   platform provides anyway (sign-in, single sign-on, time zones done properly, scale, backups) is written here as a
   requirement instead of being built: why, the rule, what Faro does today, worked examples, acceptance checks, and the
   nearest rebuild stage.

   Kept true two ways. R1's access table names the shared action that enforces each line, and src/spec/internal.test.ts
   fails when an action that says who may do something (src/domain/actions.ts, src/domain/removal.ts) isn't in it, or a
   function it names has gone. A worked example with `run` is run against Faro's code, by the same test and by the
   generator, which refuses to write one that isn't true. Pure apart from those imports: the caller writes the files. */
import { createToken, NotAllowed, renameWorkspace, saveRetro, savePerson, canDeleteWorkspace, startNextCycle, type ActionContext } from '../domain/actions';
import { canAnswer, canMarkDone, canWithdraw } from '../domain/asks';
import { currentWeek, daysSince } from '../domain/plan';
import { levelIds, levelName } from '../domain/levels';
import { sessionDate } from '../domain/review';
import type { Ask, Goal, Person, Review, Snapshot } from '../domain/types';
import { CYCLE } from './examples';
import { cell, link, table } from './md';
import { INTERNAL_PAGES } from './overview';

export interface InternalExample {
  given: string;
  /** What should happen. With `run`, exactly what `run` returns: what Faro's code gives today. */
  then: string;
  run?: () => string;
}

export interface InternalRequirement {
  id: string;
  /** The page under spec/requirements/internal/, without .md. */
  file: string;
  title: string;
  summary: string;
  why: string[];
  /** The rule, as Markdown. */
  rule: string;
  /** What Faro does today, and where (paths from the repository root). */
  today: string[];
  examples: InternalExample[];
  checks: string[];
  /** The nearest rebuild stage: its file under spec/rebuild/, its title, and what lands there. */
  stage: { file: string; title: string; why: string };
  /** Decided while writing it, for Lane to see. */
  decided: string[];
}

/* ---------- R1's access table: who may change what, read from the shared actions ---------- */

export interface Access {
  area: string;
  what: string;
  who: string;
  /** The functions that enforce it, as `file#function` from the repository root. */
  code: string[];
}

const A = 'src/domain/actions.ts#', R = 'src/domain/removal.ts#', C = 'src/domain/changeset.ts#planChanges', MX = 'src/modules/metrics/rules.ts#';

export const ACCESS: Access[] = [
  { area: 'Goals, plans and check-ins', what: 'Post or correct a check-in; change a goal or its plan (in a form, a spreadsheet, a bulk edit or through the AI)', who: 'The goal’s owner, or an admin', code: [C, 'src/domain/changeset.ts#postCheckIn'] },
  { area: 'Goals, plans and check-ins', what: 'Add a goal', who: 'Anyone, for a goal they own; an admin, for anyone', code: [C] },
  { area: 'Goals, plans and check-ins', what: 'Stop a goal that has check-ins (with a reason); delete one that has none', who: 'The goal’s owner, or an admin', code: [`${R}stopGoal`, `${R}deleteGoal`] },
  { area: 'Goals, plans and check-ins', what: 'Delete a goal’s latest check-in (after a newer one it can only be corrected)', who: 'Whoever posted it, or an admin', code: [`${R}deleteCheckIn`, `${R}canDeleteCheckIn`] },
  { area: 'Goals, plans and check-ins', what: 'Wrap up a goal at the end of the cycle', who: 'The goal’s owner, or an admin', code: [`${A}saveRetro`] },
  { area: 'Goals, plans and check-ins', what: 'Say which stages were already done when a goal was set up (before its first check-in)', who: 'The goal’s owner, or an admin', code: [`${A}recordStagesDone`] },
  { area: 'Goals, plans and check-ins', what: 'Undo an import or bulk edit', who: 'Whoever made it, or an admin', code: [`${R}undoImport`, `${R}canUndoImport`] },
  { area: 'Comments and asks', what: 'Comment on a goal; agree an action on it', who: 'Anyone in the workspace', code: [`${A}addNote`, `${A}addAction`] },
  { area: 'Comments and asks', what: 'Edit a comment', who: 'Whoever wrote it, only', code: [`${R}editComment`] },
  { area: 'Comments and asks', what: 'Remove a comment', who: 'Whoever wrote it, or an admin', code: [`${R}deleteComment`] },
  { area: 'Comments and asks', what: 'Ask a goal’s owner for an update, or a question', who: 'Anyone but the goal’s owner', code: [`${A}askForUpdate`, `${A}askQuestion`] },
  { area: 'Comments and asks', what: 'Take back an ask for an update', who: 'Whoever asked, or an admin', code: [`${A}undoUpdateAsk`] },
  { area: 'Comments and asks', what: 'Answer a decision or help, a question or an ask for an update', who: 'The person asked, or an admin; anyone, for an ask to no one in particular', code: [`${A}answerRequest`, 'src/domain/asks.ts#canAnswer'] },
  { area: 'Comments and asks', what: 'Mark an action done', who: 'Whoever does it, whoever asked for it, or an admin', code: [`${A}markActionDone`, 'src/domain/asks.ts#canMarkDone'] },
  { area: 'Comments and asks', what: 'Say a goal waits on another goal’s decision or help', who: 'The waiting goal’s owner, or an admin', code: [`${A}linkRequest`] },
  { area: 'Comments and asks', what: 'Withdraw an ask', who: 'Whoever asked, or an admin; for a decision or help, also the owner of the goal it was raised on', code: [`${A}withdrawRequest`, 'src/domain/asks.ts#canWithdraw'] },
  { area: 'Reviews', what: 'Set up a review', who: 'Anyone', code: [`${A}saveReview`] },
  { area: 'Reviews', what: 'Change a review', who: 'Someone in it, whoever set it up, or an admin', code: [`${A}saveReview`] },
  { area: 'Reviews', what: 'Say something about a goal in a review (seen, a note, a question, an action)', who: 'Anyone; a question or action on your own goal is a note instead', code: [`${A}reviewCall`] },
  { area: 'Reviews', what: 'Mark goals reviewed in a session; accept the risk on a goal behind, with a reason', who: 'Anyone', code: [`${A}markReviewed`, `${A}acceptRisk`] },
  { area: 'Reviews', what: 'Correct what was said in a review, or an ask’s words', who: 'Whoever said or asked it, or an admin', code: [`${A}editCall`] },
  { area: 'Reviews', what: 'Undo marking goals reviewed in a session', who: 'Whoever marked them, or an admin', code: [`${R}unmarkReviewed`] },
  { area: 'Reviews', what: 'Remove a note said in a review', who: 'Whoever said it, or an admin', code: [`${R}deleteNote`] },
  { area: 'Reviews', what: 'End a review, or delete one never held', who: 'Whoever set it up, or an admin', code: [`${R}endReview`, `${R}deleteReview`, `${R}reviewHeld`] },
  { area: 'Views and watching', what: 'Watch a goal, a tree or a level; stop watching', who: 'Anyone, for their own watches', code: [`${A}watch`, `${A}unwatch`] },
  { area: 'Views and watching', what: 'Save a view of the goals; change or delete one', who: 'Anyone saves; its owner or an admin changes or deletes it', code: [`${A}saveView`, `${A}saveTableView`, `${A}deleteView`] },
  { area: 'Views and watching', what: 'Pin a view for everyone', who: 'Admins', code: [`${A}pinView`] },
  { area: 'People, teams and the workspace', what: 'Add someone; change their name, job title, team or admin rights', who: 'Admins', code: [`${A}savePerson`, C] },
  { area: 'People, teams and the workspace', what: 'Mark someone as left (handing over their goals and asks); delete someone with no history', who: 'Admins; not themselves, and never the only admin', code: [`${R}markPersonLeft`, `${R}deletePerson`, `${R}leaving`] },
  { area: 'People, teams and the workspace', what: 'Leave the workspace yourself (handing over your goals and asks)', who: 'Anyone; never the only admin', code: [`${R}leaveWorkspace`] },
  { area: 'People, teams and the workspace', what: 'Add, rename, lead or remove a team', who: 'Admins', code: [`${A}saveTeam`, `${A}removeTeam`] },
  { area: 'People, teams and the workspace', what: 'Start the next cycle (from the day the wrap-up opens; once); undo the start while nobody has used it; delete a cycle no one has checked in to', who: 'Admins', code: [`${A}startNextCycle`, `${R}undoStart`, `${R}deleteCycle`] },
  { area: 'People, teams and the workspace', what: 'Rename the workspace; turn recording on or off; switch features on or off; delete the workspace', who: 'Admins', code: [`${A}renameWorkspace`, `${A}setRecording`, `${A}setModule`, `${A}canDeleteWorkspace`] },
  { area: 'People, teams and the workspace', what: 'Restore something removed, stopped or marked as left (within 30 days), and see it on Recently removed', who: 'An admin (everything), or whoever removed it (their own)', code: [`${R}restoreRemoved`, `${R}canRestore`] },
  { area: 'People, teams and the workspace', what: 'Make an MCP token for someone', who: 'Admins', code: [`${A}createToken`] },
  { area: 'People, teams and the workspace', what: 'Revoke an MCP token', who: 'An admin, or the token’s person', code: [`${A}revokeToken`] },
  { area: 'People, teams and the workspace', what: 'Send feedback about the app', who: 'Anyone', code: [`${A}sendFeedback`] },
  { area: 'Metrics', what: 'Add a metric to the library', who: 'Anyone; they own it unless they name another owner', code: [`${MX}saveMetric`] },
  { area: 'Metrics', what: 'Change or remove a metric', who: 'Its owner, or an admin', code: [`${MX}saveMetric`, `${MX}removeMetric`, `${MX}canEditMetric`] },
  { area: 'Metrics', what: 'Say which metric measures a goal, or stop', who: 'The goal’s owner, or an admin', code: [`${MX}linkGoalMetric`, `${MX}unlinkGoalMetric`, `${MX}canLinkGoal`] },
];

/* ---------- the people the examples use ---------- */

const MAYA: Person = { id: 'p-maya', name: 'Maya Patel', role: 'Engineering manager', initials: 'MP', teamId: 't', admin: false, email: 'maya.patel@example.com' };
const OSKAR: Person = { id: 'p-oskar', name: 'Oskar Lind', role: 'Staff engineer', initials: 'OL', teamId: 't', admin: false, email: 'oskar.lind@example.com' };
const PRIYA: Person = { id: 'p-priya', name: 'Priya Shah', role: 'Head of platform', initials: 'PS', teamId: 't', admin: true, email: 'priya.shah@example.com' };
const ctx = (actor: Person): ActionContext => ({
  snapshot: { people: [MAYA, OSKAR, PRIYA], teams: [{ id: 't', name: 'Platform' }] } as unknown as Snapshot,
  cycle: CYCLE, week: 3, actor, now: '2026-09-28T10:00:00Z', newId: (p) => `${p}_1`,
});
const ask = (kind: Ask['kind'], askedBy: string, recipientId: string | null): Ask => ({
  id: 'ask-1', kind, goalIds: ['g-1'], askedBy, recipientId, ask: 'Can we move the launch?', status: 'open', dueWeek: null, reviewId: null, week: null, checkInId: null,
  createdAt: '2026-09-21T10:00:00Z', updatedAt: '2026-09-21T10:00:00Z', answer: null, answeredBy: null, answeredAt: null,
});
const GOAL_OF_MAYA = { id: 'g-1', ownerId: MAYA.id } as Goal;
/** What an action says: "allowed", or the words it refuses with. */
const says = (f: () => unknown) => { try { f(); return 'allowed'; } catch (e) { if (e instanceof NotAllowed) return `refused: “${e.message}”`; throw e; } };
const yes = (b: boolean) => (b ? 'yes' : 'no');

/* ---------- the requirements ---------- */

export const INTERNAL: InternalRequirement[] = [
  {
    id: 'R1', file: 'r1-sign-in-and-access', title: 'R1. Sign-in and access',
    summary: 'Everyone signs in; the signed-in person is who acts; the server enforces who may see and change what, with the rules Faro’s shared actions already enforce in code.',
    why: [
      'Faro asks “Who are you?” once on each device and trusts the answer, and its public database key can still write to most tables (docs/mcp.md, “Until company sign-in arrives”). That is fine for a demo with made-up data and wrong for an app holding 15,000 people’s real goals: the change log must say who really did what, and a rule the browser checks can be skipped by anyone who calls the database directly.',
      'The rules about who may do what already exist, once, in the shared actions the app and the AI assistant both call. The rebuild doesn’t need new rules; it needs them enforced where the records are stored, against a person the server knows.',
    ],
    rule: [
      '1. **Everyone signs in** (through the company’s sign-in, [R2](r2-single-sign-on.md)). There is no “Who are you?” and no “View as someone else”: the signed-in person is the actor for every action, and nobody chooses who they act as.',
      '2. **Workspace membership is a person record.** A person belongs to a workspace when the workspace has a person record with their sign-in email (`Person.email`, lower case, one per workspace). Admins add people (Workspace or the People sheet); whoever creates a workspace is its first admin. Signing in with an email that matches no one: no workspace, and a message saying to ask an admin. Matching one: that workspace opens. Several: the person chooses. Marked as left (`leftAt`) or removed: no access to that workspace, and their MCP tokens stop working.',
      '3. **Reading is open inside a workspace.** Every member reads every goal, check-in, plan, ask, review, comment, person, team and the Activity log of their workspace, as in Faro today: nothing in Faro hides a goal from a member. The exceptions, as Faro has them: the list of MCP tokens (an admin sees all, anyone else their own), Recently removed (an admin sees all, anyone else what they removed), the workspace’s feedback (admins), and the builder inbox (builders, rule 6; Faro opens its own on purpose). Someone who isn’t a member reads nothing of a workspace, not even that it exists.',
      '4. **Changing follows the access table below**, which is what Faro’s shared actions enforce today. The server enforces it: a write the rules refuse is refused by the server (the database or the API), whatever sends it, with the same words the app shows. The browser’s own checks are only there to explain early. No key a browser holds can write.',
      '5. **MCP tokens are made on the server.** An admin makes one for a person; the secret is made by the server, shown once, and only its SHA-256 hash is kept. A token belongs to one person in one workspace and acts with exactly that person’s rights (the same access table); every change it makes is logged as that person, marked via MCP. The token’s person or an admin revokes it; it stops working when its person leaves. A token can’t create, switch or reset a workspace or choose who it acts as.',
      '6. **Builder tokens and the builder inbox.** Builders are the people who look after the app itself (in the internal app, a group in the company directory). Only builders read the builder inbox: the markups and feedback people send about the app, from every workspace. A builder makes a builder token for themselves; it reaches the inbox as well as their workspace, and stops counting as one the moment they leave the builders. Someone who sent a markup or feedback sees its status (New, In hand, Fixed, Won’t fix), not other people’s. **Faro differs on purpose:** it never holds real data, so its inbox is open to anyone (Lane, 8 Nov, backlog O); the internal app must not copy that.',
      '7. **Who may read a sent markup** (a markup about a goal sent to someone, backlog 3a). Its sender, the people it was sent to, and, when it was sent into a review, the people in that review. An admin of the workspace may remove one. Nobody else, watchers included. A markup is a picture of the sender’s screen, so it is only sent to people who can read everything on it: in the internal app, members of the same workspace. Its picture is kept private and read through a short-lived address the server makes for someone allowed to read it ([R4](r4-scale-and-safety.md), the master key).',
    ].join('\n'),
    today: [
      'The app asks “Who are you?” and remembers the answer on the device (Help, “Saying who you are”; `src/screens/Start.tsx`).',
      'Every rule in the access table is checked in `src/domain/actions.ts`, `src/domain/removal.ts`, `src/domain/asks.ts` and the change engine (`src/domain/changeset.ts`), by the app and the MCP server alike, before anything is saved. The database doesn’t check them.',
      'The public key can still write to most tables (not tokens; it can only add markups and feedback). Tokens are made in the database by `okr_token_create` and found by hash (`okr_token_find`, migration 0024).',
      'Every grant, row rule and `security definer` function the database has today is listed in one place, read from the database after every migration and each marked “demo access: replace”: [access today](../../rebuild/access-today.md). It ends with the two shapes that replace them: a membership rule on each table, and a definer function that checks who is calling before it does anything.',
      'Every workspace in the shared database is listed to anyone who opens the app (`SupabaseStore.workspaces` in `src/adapters/supabase/goalsStore.ts`).',
      'Faro’s inbox is open on purpose (backlog O, migration 0031): anyone, with no sign-in, reads every markup and piece of feedback and their pictures (a public-read bucket nobody can list), and changes a status through the one status rule, recorded as the person using the app and undoable; any token reaches it through MCP. There is no builder sign-in and no builder token in the app any more (the builders list and builder tokens from migrations 0024 and 0029 are left in the database, unused). The internal app keeps rule 6 as written.',
      'Markups today are reports about the app; sending one about a goal (3a) is not built yet.',
    ],
    examples: [
      { given: 'Maya, not an admin, makes an MCP token for herself.', then: 'refused: “Only admins can make tokens.”', run: () => says(() => createToken(ctx(MAYA), MAYA.id, 'Claude on my laptop')) },
      { given: 'Maya, not an admin, changes Oskar’s job title.', then: 'refused: “Only admins can add people or change them.”', run: () => says(() => savePerson(ctx(MAYA), { ...OSKAR, role: 'Principal engineer' }, OSKAR)) },
      { given: 'Oskar, not an admin, renames the workspace.', then: 'refused: “Only admins can rename the workspace.”', run: () => says(() => renameWorkspace(ctx(OSKAR), { id: 'ws', name: 'Platform' }, 'Platform Engineering')) },
      { given: 'Oskar, not an admin, deletes the workspace, giving its name exactly.', then: 'refused: “Only admins can delete the workspace.”', run: () => says(() => canDeleteWorkspace(OSKAR, 'own', 'Platform', 'Platform')) },
      { given: 'Oskar asked Maya for a decision. May Oskar, Maya and Priya (an admin) answer it?', then: 'Oskar no, Maya yes, Priya yes', run: () => { const r = ask('decision', OSKAR.id, MAYA.id); return `Oskar ${yes(canAnswer(r, OSKAR))}, Maya ${yes(canAnswer(r, MAYA))}, Priya ${yes(canAnswer(r, PRIYA))}`; } },
      { given: 'Priya asked Oskar to do an action. May Oskar, Priya and Maya mark it done?', then: 'Oskar yes, Priya yes, Maya no', run: () => { const r = ask('action', PRIYA.id, OSKAR.id); return `Oskar ${yes(canMarkDone(r, OSKAR))}, Priya ${yes(canMarkDone(r, PRIYA))}, Maya ${yes(canMarkDone(r, MAYA))}`; } },
      { given: 'Oskar raised a decision on Maya’s goal, and also asked her for an update on it. May Maya withdraw each?', then: 'the decision yes, the update no', run: () => `the decision ${yes(canWithdraw(ask('decision', OSKAR.id, PRIYA.id), MAYA, GOAL_OF_MAYA))}, the update ${yes(canWithdraw(ask('update', OSKAR.id, MAYA.id), MAYA, GOAL_OF_MAYA))}` },
      { given: 'Someone signs in as Maya.Patel@Example.com, and Maya’s person record has maya.patel@example.com.', then: 'They are Maya: emails are compared in lower case.' },
      { given: 'Oskar is marked as left in Platform, and still has a token.', then: 'He can’t open Platform, and his token is refused at once.' },
      { given: 'Maya sends a markup of her goal’s chart to Oskar.', then: 'Maya and Oskar can read it; Priya, an admin, can remove it but it isn’t in her list; someone watching the goal can’t see it.' },
      { given: 'A script with the browser’s public key writes a check-in to Maya’s goal.', then: 'The server refuses it: the public key can’t write.' },
    ],
    checks: [
      'For every line of the access table, someone outside its “who” is refused by the server, called directly with their own sign-in (not through the app), with the words the app shows. Someone inside it is allowed.',
      'Every table refuses a write made with the public key, and every read of a workspace by someone who isn’t a member returns nothing.',
      'Opening the app without signing in shows the sign-in, never a workspace or a list of workspaces.',
      'A person marked as left can’t open the workspace, and a request with their token is refused within a minute of their leaving.',
      'A token’s secret appears once, in the answer that made it, and nowhere stored: the database holds its SHA-256 hash.',
      'Every change in the change log names the signed-in person (or the token’s person, marked via MCP); no change names someone else.',
      'In the internal app: a builder token reads the builder inbox; an ordinary token, an admin’s included, is told it isn’t a builder token. Removing a builder from the builders stops their token reaching the inbox at once. (Faro’s open inbox fails this check on purpose.)',
      'A sent markup is readable by its sender, its recipients and (sent into a review) the review’s people, and by nobody else; its picture’s address stops working after it expires.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'access is enforced where the records are stored and changed. The rules themselves are the shared actions and the change engine; stage 3’s screens only explain them.' },
    decided: [
      'Reading stays open to every member of a workspace, as in Faro; private goals would be a new product rule, not in Faro.',
      'A sent markup is read by its sender, recipients and (in a review) the review’s people; not by watchers. Admins can remove one. This answers 3a’s open question on watchers for the internal app.',
      'Only admins make MCP tokens, as Faro’s code says today; anyone revokes their own.',
      'Faro opens its inbox to anyone (Lane, 8 Nov): it holds no real data, and Lane needs to read markups on any device. The internal app keeps the inbox to builders (rule 6).',
    ],
  },
  {
    id: 'R2', file: 'r2-single-sign-on', title: 'R2. Company single sign-on',
    summary: 'People sign in through the company’s identity provider, are matched to their person record by a stable id, and lose access the day they leave the company.',
    why: [
      'At 15,000 people, email links and passwords mean support tickets and shared accounts. The company directory already knows who works here, in which team, and who has left; the app should take that, not keep its own idea of it.',
      'Leavers are the risk: someone who has left must not keep reading or changing goals, through the app or a token.',
    ],
    rule: [
      '1. **Sign-in is the company’s identity provider** (Entra ID, Okta or Google Workspace, over OpenID Connect or SAML), with its own multi-factor rules. The internal app has no passwords and no email links of its own.',
      '2. **Matching a person.** The first sign-in matches the provider’s verified email, in lower case, to `Person.email` ([R1](r1-sign-in-and-access.md), rule 2), and keeps the provider’s stable subject id on the person. Later sign-ins match the subject id first, so a changed email or name doesn’t make a new person; the email is updated from the provider.',
      '3. **Leaving the company.** When the directory removes someone (deprovisioned, or disabled), they can’t sign in from that moment, their sessions end and their AI and builder tokens stop working. Their person record stays, with their goals and asks, until an admin marks them as left and hands their goals and asks over (Faro’s own rule: `markPersonLeft` needs someone to take each over). Until then Workspace lists them under “Left the company, still owns goals”.',
      '4. **Joining.** Being in the directory doesn’t make someone a member: an admin adds them, or a workspace may let anyone in a named directory group join as an ordinary member on first sign-in. Admin rights stay Faro’s own `admin` field, changed by admins, never taken from the directory.',
      '5. **Builders** ([R1](r1-sign-in-and-access.md), rule 6) are a directory group; leaving the group ends builder access at once.',
      '6. **Sessions** last as long as the company’s policy says, and end when the provider says so. The app never asks who someone is.',
    ].join('\n'),
    today: [
      'No company sign-in. The app asks “Who are you?” (`src/screens/Start.tsx`).',
      'Only the builder inbox signs in, with an email link from Supabase Auth (`src/markup/backend.ts`); its allowed sign-in addresses are set in Supabase (docs/handover.md).',
      'People are told apart by `Person.email`, lower case (`src/domain/types.ts`); there is no subject id.',
      'Leaving is an admin marking someone as left, with a handover (`markPersonLeft` in `src/domain/removal.ts`).',
    ],
    examples: [
      { given: 'Maya signs in for the first time; the provider says maya.patel@example.com, verified.', then: 'She is matched to Maya’s person record, and her subject id is kept on it.' },
      { given: 'Maya marries and her email becomes maya.lind@example.com.', then: 'She signs in as before (matched by subject id); her person record’s email changes; her goals and history stay hers.' },
      { given: 'Oskar leaves the company on Friday; the directory disables him at 17:00.', then: 'From 17:00 he can’t sign in and his token is refused. On Monday Workspace lists him under “Left the company, still owns goals” until an admin hands his 3 goals and 2 open asks over.' },
      { given: 'Someone in the directory, not in any workspace, signs in.', then: 'They see that they aren’t in a workspace yet, and who to ask (the admins of the workspaces their directory group may join, if any).' },
      { given: 'The directory puts Maya in an “Admins” group.', then: 'Nothing changes in the app: admin rights are given by an admin in the app.' },
    ],
    checks: [
      'Signing in goes through the identity provider; the app offers no other way in (no password, no email link, no “Who are you?”).',
      'A first sign-in with a verified email matches the person with that email, in any letter case; a sign-in with an unverified email is refused.',
      'After an email change in the directory, the same person signs in to the same record.',
      'Disabling someone in the directory ends their sessions and tokens within the time the company’s policy sets (and within an hour at most), without anyone in the app doing anything.',
      'A disabled person who still owns goals is listed for admins until they are marked as left with a handover.',
      'Removing someone from the builders group ends their builder access at once.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'single sign-on fills in who the actor is and changes person records (the subject id, the email, leaving); everything after sign-in is R1.' },
    decided: [
      'Admin rights are never taken from a directory group, so a directory change can’t make someone an admin.',
      'Leaving the company ends access at once but doesn’t mark the person as left: Faro’s handover rule stays, and admins get a list of who to hand over.',
    ],
  },
  {
    id: 'R3', file: 'r3-time-zones', title: 'R3. Time zones',
    summary: 'Store real moments, count weeks and days in the workspace’s home zone, show every time in the viewer’s own zone, and give reviews a time and a zone.',
    why: [
      'A company of 15,000 is spread over many zones. “This week”, “due before the review” and “no update for 14 days” must mean the same moment for everyone in a workspace, or two people looking at the same goal see different statuses for a few hours each week.',
      'A review is a meeting: people in London and New York need to know when it is in their own time, including in the weeks when only one of them has changed the clocks.',
    ],
    rule: [
      '1. **Real moments are stored.** Every timestamp (a check-in’s `postedAt`, `createdAt`, `answeredAt`, a change’s `at` and the rest) is a real instant, written by the server, in UTC with its zone (`2026-09-14T03:30:00Z`). Nothing is stored as someone’s local wall-clock time.',
      '2. **Each workspace has a home zone**, an IANA name such as `Europe/London`, set by an admin (Workspace, About), `UTC` until set. Every rule that counts calendar days or weeks counts them in the home zone: which week of the cycle it is, the week a check-in counts for, days without an update (stale after 14), when a review’s session falls, the 30 days something removed can be restored, and when each week’s turn makes goals stale. So everyone in a workspace is in the same week at the same moment, wherever they are.',
      '3. **Dates without a time stay dates**: a cycle’s start, a stage’s due week. They are read in the home zone.',
      '4. **Times are shown in the viewer’s own zone** (from their device, or their profile when set), with the zone named when it differs from the home zone: “Thu 14:00 London time (09:00 your time)”. A day heading (Activity) is the viewer’s day.',
      '5. **Reviews have a time and a zone**: held every so many weeks on a weekday at a time in a zone (the home zone unless chosen). Each session is a real moment worked out from those, so it stays at 14:00 London time across the clock change, and moves for someone in New York in the weeks between the two countries’ changes.',
      '6. **The AI assistant uses the same zones**: “this week” and “today” in the home zone; times it says to a person in that person’s zone, named.',
    ].join('\n'),
    today: [
      'The rules count calendar days and weeks in UTC: `daysBetween`, `currentWeek`, `daysSince` and `weekDate` in `src/domain/plan.ts`, and `sessionDate` in `src/domain/review.ts`.',
      'The app hands the rules the person’s own wall-clock time dressed up as UTC (`realNow` in `src/app/state.tsx`), so weeks turn over at each person’s own midnight on Sunday. Two people in different zones can be in different weeks for a few hours, and the MCP server, which uses the real time (`server/mcp.ts`), can disagree with the app near midnight.',
      'Timestamps are stored as real instants (ISO, UTC) by both the app and the server.',
      'The conformance data judges each week at its review day, noon UTC (`weekMoment` in `src/spec/conformance.ts`).',
      'A review has a weekday but no time or zone (`Review.everyWeeks`, `Review.weekday` in `src/domain/types.ts`). There is no zone on a workspace or a person.',
      'Dates are shown in UTC in some places (`dayText` in `src/domain/review.ts`, the cycle’s months in `src/domain/cycle.ts`) and in the device’s zone in others (Activity’s day headings, Home’s greeting by the hour).',
    ],
    examples: [
      { given: 'Faro today: a cycle starting Monday 7 September 2026. A check-in is posted at 2026-09-14T03:30Z, which is 23:30 on Sunday in New York. Which week is it, by the server’s clock?', then: '1', run: () => String(currentWeek(CYCLE, new Date('2026-09-14T03:30:00Z'))) },
      { given: 'Required: the same check-in, in a workspace whose home zone is America/New_York.', then: 'It is still Sunday in the home zone, so week 0: the check-in is on time for week 0.' },
      { given: 'Faro today: the last check-in was posted at 2026-09-13T23:30Z. How many days without an update at 2026-09-14T00:30Z?', then: '1', run: () => String(daysSince('2026-09-13T23:30:00Z', new Date('2026-09-14T00:30:00Z'))) },
      { given: 'Required: the same two moments in a workspace whose home zone is Europe/London (summer time, UTC+1).', then: '0: both are 14 September in London.' },
      { given: 'Faro today: a weekly review on Thursdays. When is its session in week 1?', then: '2026-09-17, a date with no time', run: () => `${sessionDate({ everyWeeks: 1, weekday: 3 } as Review, CYCLE, 1)}, a date with no time` },
      { given: 'Required: a review on Thursdays at 14:00 Europe/London. Its sessions on 22 and 29 October 2026, seen from New York.', then: '22 Oct: 13:00Z, 09:00 in New York. 29 Oct (London’s clocks went back on 25 Oct, New York’s go back on 1 Nov): 14:00Z, 10:00 in New York. Both show as 14:00 London time.' },
      { given: 'Required: Oskar, in Singapore, reads a check-in Maya posted at 2026-09-14T09:00Z in a London workspace.', then: 'He sees “Mon 14 Sep, 17:00”; the week it counts for is London’s week.' },
    ],
    checks: [
      'Every stored timestamp is a UTC instant written by the server; none is a local time.',
      'A workspace has a home zone, UTC until an admin sets one, and changing it is logged.',
      'With the home zone UTC, a rebuild of the rules passes stage 1’s conformance data unchanged (the data is judged at noon UTC).',
      'Two people in different zones, at the same moment, see the same week, the same statuses and the same days without an update, in the app and through the AI assistant.',
      'A check-in posted just before midnight in the home zone counts for that day’s week, wherever its author is.',
      'A review session keeps its time in its own zone across a clock change, and each person sees it in their own zone, with the zone named when it differs.',
      'Times shown to a person are in their zone; a time shown in another zone names it.',
    ],
    stage: { file: 'stage-1-core-rules.md', title: 'Stage 1: the core rules', why: 'the rules that count weeks and days take the home zone. Stage 1’s conformance data is judged at noon UTC, so a rebuild with a home zone of UTC must still match it; showing times in the viewer’s zone is stage 3.' },
    decided: [
      'Weeks and days are counted in one home zone per workspace, not each viewer’s own, so everyone agrees on statuses. A team spread across the world may still prefer its own workspace and zone.',
      'A workspace’s home zone defaults to UTC, which keeps today’s conformance data true.',
    ],
  },
  {
    id: 'R4', file: 'r4-scale-and-safety', title: 'R4. Scale and safety',
    summary: '15,000 people: the rules’ results kept as summary rows on the server, every growing list paged, page-load budgets checked in CI, backups that are restored for real, migrations rehearsed, and the master key used only where nothing else will do.',
    why: [
      'Faro loads a whole workspace into the browser and works out every goal’s status there, on every screen. That is quick for the demo’s 126 goals and won’t work for a company: 15,000 people at two goals each and a weekly check-in is about 30,000 goals and 1.5 million check-ins a year, and the change log is larger still.',
      'Real goals are worth keeping safe. A backup that has never been restored, or a migration first run on production, is a risk no one sees until the day it matters.',
    ],
    rule: [
      '1. **Design for** 15,000 people, 1,500 teams, 30,000 goals in a cycle, 1.5 million check-ins and 15 million change-log entries a year, in one workspace, with 2,000 people using it in the busiest hour (Monday morning, before reviews). These are working figures, not measured ones.',
      '2. **Summary rows on the server.** For each live goal, the server keeps one summary row: its official status and what the numbers say, its flags, whether it needs attention and how it is being handled, the projection and the scorecard, worked out by the stage 1 rules (the same code, or a rebuild that passes stage 1’s drill). A summary is worked out again when anything it reads changes (a check-in, the plan, an ask, a decision, a review mark) and when the week turns (goals go stale by time alone, [R3](r3-time-zones.md)). Screens, lists, counts and the AI assistant read summaries; only a goal’s own page reads its check-ins. The rules stay in one place: a summary is never worked out a second way.',
      '3. **Paging, on the server.** Every list that can grow (goals, people, teams, Activity, asks, reviews’ agendas, Recently removed, the builder inbox) is filtered, sorted and paged by the server, 50 rows at a time, with keyset paging (the next page starts after the last row’s key), so a row added or changed while someone reads can’t be skipped or shown twice. Search is on the server too: it is the search function behind find-and-pick (backlog 0a). Nothing loads a whole workspace.',
      '4. **Page-load budgets**, measured at the 75th percentile on a company laptop on the office network and on a mid-range phone on 4G: the first screen (Home) usable within 2 s on a laptop and 3 s on a phone; any later screen within 1 s; a check-in saved within 1 s; any read of the API within 500 ms at the 95th percentile. The first screen’s JavaScript is at most 300 KB compressed (code split by screen), and a long table draws only the rows in view. CI checks them against a seeded workspace of 15,000 people and fails a change that breaks one.',
      '5. **Backups, and restores that have been done.** The database is backed up continuously (point-in-time recovery), kept at least 30 days, and so are stored files (markup pictures). A restore into a separate environment is rehearsed every quarter and timed: at most 5 minutes of changes lost, and the app back within 4 hours. Any workspace can be exported whole, at any time, in the one spreadsheet format. Undo and the 30-day restore of removed things are for people’s mistakes, not instead of backups.',
      '6. **Rehearsed migrations.** Every migration is safe to run twice (as in Faro), is run first on a copy of production restored from a backup and timed there, and has its way back written down. A change that would lock a large table is split into steps (add the new, copy, switch, remove the old) so the app keeps working throughout. CI applies migrations on merge, as Faro does.',
      '7. **The master key only where needed.** The key that passes every access rule (in Supabase, the service role key) lives only on the server and is used only for what nothing else can do: in the internal app, making the short-lived addresses for markup pictures (Faro’s pictures are public-read on purpose, R1 rule 6). Every other read and write, the AI assistant’s included, goes through the signed-in person’s or token’s own rights ([R1](r1-sign-in-and-access.md)). It is never in a browser or a log, and it is rotated when anyone who held it leaves.',
    ].join('\n'),
    today: [
      'The app loads every record of a workspace into the browser, 900 rows at a time with keyset paging (`SupabaseStore.load` in `src/adapters/supabase/goalsStore.ts`), and runs the rules there for every screen.',
      'There are no summary rows; lists, counts and Home are worked out in the browser from every goal and check-in.',
      'The demo workspace has 126 goals; nothing tests a workspace of 15,000 people yet (backlog 0a adds an eval with one for the pickers).',
      'Backups are Supabase’s own; no restore has been rehearsed. Migrations are safe to run twice and CI applies them on merge (`scripts/migrate.mjs`), but they aren’t rehearsed on a copy first. Faro never holds real data, so these are left to the internal app (backlog 0c).',
      'The MCP server reads and writes with the app’s public key only, never the service role key (backlog 0c): markup pictures are in a public-read bucket since the open inbox (migration 0031).',
      'Faro shares a Supabase project with another app (family-hq). Its tables and functions live in their own schema, `faro`, owned by a Faro-only role that can’t read or write anything else; CI’s migrations run as that role and check the fence first (migration 0035, `scripts/check-fence.mjs`). The internal app gets a database of its own.',
    ],
    examples: [
      { given: 'Maya owns 3 goals in a cycle of 30,000. She opens Home.', then: 'The server returns her 3 goals’ summary rows, her open asks and her reviews; no other goal’s check-ins are read.' },
      { given: 'Priya filters Goals to Off track: 1,240 goals.', then: 'She sees the first 50, sorted by the server, with the count from the summaries; the next page starts after the 50th goal’s key, and a goal that turns off track while she reads is neither skipped nor shown twice.' },
      { given: 'Oskar posts a check-in that puts his goal behind plan.', then: 'His goal’s summary row is worked out again in the same save: the goal is At risk on every screen and to the AI assistant straight away.' },
      { given: 'Week 9 turns over at midnight in the home zone; 400 goals had their last check-in 14 days ago.', then: 'Their summaries are worked out again at the turn: they show No recent update without anyone checking in.' },
      { given: 'A migration adds a column to the check-ins table with 1.5 million rows.', then: 'It is run first on last night’s copy and timed; it adds the column without a lock that stops check-ins, and runs again harmlessly.' },
      { given: 'The quarterly restore drill.', then: 'Yesterday’s 14:00 is restored into a separate environment, the app starts against it, and the time it took is written down.' },
      { given: 'The AI assistant reads Maya’s goals.', then: 'It reads as Maya’s token, under R1’s rules, not with the master key.' },
    ],
    checks: [
      'For the demo workspace, the summary rows match `spec/conformance/` (status, flags, projection and scorecard) in every week.',
      'Changing a check-in, a plan, an ask, a decision or a review mark updates its goal’s summary in the same save; the week’s turn updates the goals that go stale.',
      'No screen or AI tool reads more than one page of a growing list at once, or any goal’s check-ins but the goal being shown.',
      'Keyset paging: adding or changing rows while someone pages through a list never skips or repeats one.',
      'CI loads a seeded workspace of 15,000 people and 30,000 goals and fails a change that breaks a page-load budget.',
      'A restore drill has been done in the last quarter, timed, within 5 minutes of changes lost and 4 hours back.',
      'Every migration has run twice on a copy of production before it runs on production.',
      'The master key is used by one function only (signing picture addresses); a check fails a change that uses it anywhere else, and it appears in no browser bundle or log.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'summary rows, paging, backups and migrations are how the records are stored and changed. The summaries are stage 1’s rules run on the server, so stage 1’s conformance data proves them.' },
    decided: [
      'The working figures (30,000 goals a cycle, 2,000 people in the busiest hour) and the budgets (2 s, 1 s, 500 ms, 300 KB; 5 minutes and 4 hours for a restore) are proposals for the internal team to confirm, not measurements.',
      'Pages of 50 rows, with keyset paging, as Faro already pages its loads.',
      'Faro shows the pattern at its own size (backlog AX4): CI fails a change when the first download (the entry script and every file the page preloads with it) passes a stated size (`scripts/check-bundle.mjs`, 370 KB compressed; 369 KB today, over R4’s 300, so it only goes down; the guide and What’s new load when Help is opened, and the first download carries only their index of titles, routes and release ids), or when the real app’s, which also waits for the Supabase store and client before it draws, passes 430 KB (428 today), or when the demo workspace made ten times bigger passes a stated weight or time to summarise every goal (`src/spec/scale.test.ts`). The limits start at today’s figures and only go down.',
    ],
  },
  {
    id: 'R6a', file: 'r6a-organisation', title: 'R6a. The organisation',
    summary: 'Teams form a tree fed from the company directory, people have managers, goal levels are set per workspace, and every list, count, Home and review can be scoped to a part of the company.',
    why: [
      'Faro’s workspace is flat: a team is a name, a lead and an objective, a person has one team, and goal levels are a fixed three, one of them a job title (SVP). At 15,000 people and 1,500 teams, “By team” is 1,500 groups in a row, “my division” can’t be asked, and a leader’s Home can’t be narrowed to the part of the company they run. A three-level tree fits few companies.',
      'It is the first thing a leader looks for in week one (the deep review of 10 Nov, “What a leader would expect in week one”), and every later screen that counts goals needs it.',
    ],
    rule: [
      '1. **Teams form a tree.** Each team has at most one parent team; a team with none is a root, and there may be several. A team is never its own ancestor. The tree comes from the company directory, refreshed at least daily: admins don’t retype it. An admin may add a team the directory doesn’t know (a project team), under a team it does.',
      '2. **People have a manager and a home team**, both from the directory. A person’s chain is their manager, their manager’s manager, and so on to the top. Someone may also be in project teams; their home team is the one they are counted in.',
      '3. **A team includes the teams under it.** A team’s people are its own and those of every team under it; its goals are the goals whose team is it or any team under it. A team’s lead is the manager the directory names for it, unless an admin names someone else.',
      '4. **Levels are set per workspace**: an ordered list of two to six names, most important first (Company, Division, Department, Team, say), each optionally tied to a depth of the team tree. A goal has one of them. Faro’s three (North star, SVP, Team) are one such list and the default. Renaming a level changes no goal; a level can be removed only once no goal has it. A level says how important a goal is for reporting; it stays separate from which goal it feeds.',
      '5. **Scope.** Every list and count (Home, Goals, Activity, Needs attention, the review agendas, the AI tools) takes an optional scope: a team and everything under it, or a person’s reports (direct, or their whole chain). A leader’s Home starts scoped to the team they lead. Counts in a scope come from the summary rows ([R4](r4-scale-and-safety.md)), never from loading the scope’s goals.',
      '6. **Moves are history.** When a team moves in the tree or a person changes manager or team, the change is logged. A goal keeps its team unless someone changes it; past check-ins and statuses stay as they were. Counts for a scope are worked out from the tree as it stands now.',
      '7. **Scope narrows what you see first, never what you may see.** Reading stays open to every member of the workspace ([R1](r1-sign-in-and-access.md), rule 3).',
    ].join('\n'),
    today: [
      'A `Team` is a name, a lead and an objective, with no parent; a `Person` has one team and an `admin` flag, with no manager (`src/domain/types.ts`).',
      'Goal levels are a fixed three, North star, SVP and Team (`DEFAULT_LEVELS` in `src/domain/levels.ts`), read from that one place by the rules, screens, spreadsheets and tools; a cycle can hold its own (`Cycle.levels`) but nothing sets them yet.',
      'One workspace is the whole company. Goals’ “By team” groups goals by team in a flat list. “In the tree of” scopes by the goal tree (what a goal feeds), not by the organisation.',
      'Teams and who is in them are typed in by admins, in Workspace or the People sheet; nothing reads a directory.',
    ],
    examples: [
      { given: 'Faro today: the levels a goal may have.', then: 'North star, SVP, Team', run: () => levelIds(null).map((l) => levelName(null, l)).join(', ') },
      { given: 'Required: Platform and Developer Experience sit under Engineering, which sits under the company. Amara leads Engineering; Rhea leads Platform. Each opens Home.', then: 'Amara’s counts cover Engineering, Platform and Developer Experience; Rhea’s cover Platform. Either can widen or narrow the scope.' },
      { given: 'Required: Oskar’s manager is Maya, and Maya’s is Priya. Priya scopes Goals to her whole chain.', then: 'Oskar’s goals are in it, as are Maya’s and those of everyone else under Priya.' },
      { given: 'Required: a workspace’s levels are Company, Division, Team. An admin renames Division to Group.', then: 'Every goal at Division is now at Group; no goal is changed or logged as changed, and the rename is logged once.' },
      { given: 'Required: on 1 October the directory moves Platform from Engineering to Infrastructure.', then: 'From then on Engineering’s counts leave Platform’s goals out and Infrastructure’s include them. Platform’s goals and their history are unchanged, and Activity shows the move.' },
      { given: 'Required: the directory says A’s parent is B and B’s parent is A.', then: 'The refresh is refused, the tree stays as it was, and admins are told which teams loop.' },
    ],
    checks: [
      'The team tree, managers and home teams match the directory within a day of a change, with no admin typing.',
      'No team is its own ancestor; a refresh that would make a loop changes nothing and says why.',
      'A team’s count of goals by status equals the sum over it and the teams under it, each goal counted once.',
      'A workspace’s levels can be renamed, reordered, added and (when unused) removed by an admin; Faro’s three are the default.',
      'Home, Goals, Activity, Needs attention, review agendas and the AI tools all accept a scope, and give the same counts for the same scope.',
      'A scope’s counts come from summary rows: opening a division of 3,000 goals reads no check-ins.',
      'Scoping never hides a goal from a member who asks for it outside the scope.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'the tree, managers and levels are records, and scope is a filter on the summary rows. The screens that offer a scope are stage 3.' },
    decided: [
      'The tree comes from the directory; Faro’s own team editing stays only for teams the directory doesn’t know.',
      'Levels are a list each workspace names, not job titles; Faro’s three become the default list.',
      'Scope is a starting view, not access: reading stays open (R1).',
    ],
  },
  {
    id: 'R6b', file: 'r6b-delegates', title: 'R6b. Delegates',
    summary: 'An owner, their manager or an admin names a delegate who checks in and answers asks for the owner’s goals while they are away; it is recorded as the delegate acting for the owner, and the owner stays the owner.',
    why: [
      'In Faro only a goal’s owner or an admin may check in on it. When the owner is on leave the goal goes quiet: after 14 days it shows No recent update, asks for an update wait, and the leader’s count fills with goals nobody is reporting on. An admin can check in instead, but the change log then says the admin did it, with nothing to say for whom or why.',
      'A delegate keeps the weekly loop going without moving the goal: the owner is still accountable, and the record says who reported.',
    ],
    rule: [
      '1. **Naming a delegate.** A goal’s owner names one or more people in the workspace as delegates, for all their goals or some, from a date and, optionally, until a date. The owner’s manager ([R6a](r6a-organisation.md)) or an admin may name one for them when they are away without warning.',
      '2. **A delegate reports; they don’t own.** For those goals a delegate may post and correct check-ins (with the owner’s call on the status made by the delegate), answer asks sent to the owner, and agree actions. They may not change the goal, its target or plan, its owner or what it feeds; stop, delete or wrap it up; or name further delegates.',
      '3. **Recorded as acting for the owner.** A check-in or answer from a delegate keeps the delegate as its author and the owner it was for; the change log says “Oskar Lind, for Maya Patel”. The owner is told, and may correct a check-in when back.',
      '4. **The same rules.** What a check-in must say is unchanged: behind plan still needs a cause and a way back.',
      '5. **The owner stays the owner.** The goal stays in the owner’s Mine, Home and counts, and in reviews under the owner’s name. The delegate sees “Checking in for Maya Patel · 3 goals” in their own check-in queue.',
      '6. **It ends** at its end date, when whoever named it ends it, or when either person leaves ([R2](r2-single-sign-on.md)). What the delegate posted stays.',
      '7. **The server enforces it**, as one more line of [R1’s access table](r1-sign-in-and-access.md#who-may-change-what).',
    ].join('\n'),
    today: [
      'Only a goal’s owner or an admin may post or correct a check-in, or change the goal (the change engine, `planChanges` in `src/domain/changeset.ts`; R1’s access table). There is no delegate and no co-owner.',
      'An admin who checks in for someone is logged as the admin, with nothing saying for whom.',
      'A goal whose owner is away shows No recent update after 14 days; an ask for an update waits for the owner.',
      'Goals change hands only for good: when someone leaves, an admin hands each goal over (`markPersonLeft` in `src/domain/removal.ts`).',
    ],
    examples: [
      { given: 'Faro today: Oskar, not an admin, wraps up Maya’s goal while she is away.', then: 'refused: “Only the goal’s owner or an admin can wrap it up.”', run: () => says(() => saveRetro(ctx(OSKAR), GOAL_OF_MAYA, { result: 'hit', learned: '', next: 'stop' })) },
      { given: 'Required: Maya names Oskar her delegate for her three goals, 12 to 23 October. On 15 October Oskar posts week 6’s check-in on one of them.', then: 'It is saved, with Oskar as author for Maya; the change log says “Oskar Lind, for Maya Patel”; Maya is told; the goal stays in Maya’s Mine.' },
      { given: 'Required: Oskar, as Maya’s delegate, changes her goal’s target.', then: 'Refused: a delegate checks in and answers; only Maya or an admin changes the goal.' },
      { given: 'Required: on 24 October Oskar posts on Maya’s goal.', then: 'Refused: his time as her delegate ended on 23 October.' },
      { given: 'Required: during Maya’s leave Daniel asks her a question on her goal, and Oskar answers it.', then: 'It is answered, by Oskar for Maya; Maya can add to the answer when back.' },
      { given: 'Required: Maya is off sick without warning. Priya, her manager, names Oskar her delegate.', then: 'Allowed; Maya is told, and can end it when back.' },
    ],
    checks: [
      'A delegate can post and correct check-ins and answer asks on the goals and dates named, and nothing more; the server refuses the rest with words saying why.',
      'Every change a delegate makes names them and the owner they acted for, in the change log, on the goal page and through the AI tools.',
      'A delegate’s check-in meets the same check-in rules as the owner’s.',
      'The goal stays the owner’s on every screen and count.',
      'A delegation stops working at its end date, when ended, or when either person leaves, within a minute.',
      'Only the owner, the owner’s manager or an admin can name or end a delegate.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'who may change a goal is enforced where records change, and the delegation is a record. The check-in queue’s “Checking in for” is stage 3.' },
    decided: [
      'A delegate reports and doesn’t own: no changes to the goal, its target, plan or owner.',
      'No co-owners: one owner per goal keeps accountability with one person; delegates cover absence.',
      'A manager may name a delegate for a report, which needs R6a’s manager chain.',
    ],
  },
  {
    id: 'R6c', file: 'r6c-planning-round', title: 'R6c. The planning round',
    summary: 'Next cycle’s goals are drafted, proposed and agreed in a planning round before the cycle starts; a goal counts nowhere until it is agreed, and the cycle starts with the agreed set.',
    why: [
      'In Faro a goal is live the moment it is saved, and the next cycle starts by carrying every goal marked “carry on” straight into it. A company sets next quarter’s goals together: teams draft, the owners of the goals they feed see and agree them, and the quarter starts on one agreed set. Without that, goals change under people in the first weeks, and early statuses mean little.',
      'It is the one part of the yearly rhythm Faro doesn’t model, and a leader will ask for it before the first quarter ends.',
    ],
    rule: [
      '1. **An admin opens a round** for the next cycle, with three dates: drafting opens, agree by, and the cycle starts. It may open any time before the current cycle ends.',
      '2. **A goal in a round is Draft, Proposed, Agreed or Sent back.** Its owner drafts it and proposes it. The owner of the goal it feeds agrees it or sends it back with a reason; a goal that feeds nothing is agreed by the lead of the team above its team ([R6a](r6a-organisation.md)), or an admin at the top. Changing an agreed goal’s target, plan or what it feeds puts it back to Proposed.',
      '3. **Carried goals start as drafts.** A goal wrapped up as “carry on” comes into the round as a draft, its plan proposed from where it ends; the owner changes it or proposes it as it is.',
      '4. **Nothing in a round counts.** Drafts and proposals have no status or flags, and are left out of Home, Goals, reviews, Needs attention and the AI tools’ answers about the current cycle. A planning screen shows them by scope, with what is missing: a goal with nothing proposed under it, a team with nothing proposed at all.',
      '5. **The cycle starts with what is agreed.** On the start date the agreed goals go live at week 0. Goals still Draft or Proposed stay out and are listed for their owners and admins; an admin may move the agree-by date, or agree what is left.',
      '6. **Every step is logged**: drafted, proposed, agreed, sent back (with its reason), and who did it. Reading stays open ([R1](r1-sign-in-and-access.md), rule 3): every member can see the round.',
    ].join('\n'),
    today: [
      'An admin sets up the next cycle from the day the current one’s wrap-up opens (`startNextCycle` in `src/domain/actions.ts`), after a read-back of what carries on, finishes and stops (`startReadBack` in `src/domain/carry.ts`); the goals that carry on are copied into it (`nextCycle` in `src/domain/cycle.ts`). Nobody moves into it until its week 1’s Monday (`currentCycle`), and an admin can undo it until someone uses it (`undoStart` in `src/domain/removal.ts`).',
      'A goal is live the moment it is saved: there is no draft, propose or agree step, and no one but its owner (or an admin) is asked.',
      'Set-up asks for an outcome and goals for the first cycle only.',
    ],
    examples: [
      { given: 'Faro today: Maya, not an admin, starts the next cycle.', then: 'refused: “Only admins can start the next cycle.”', run: () => says(() => startNextCycle(ctx(MAYA))) },
      { given: 'Faro today: Priya, an admin, starts the next cycle in week 3 of 13.', then: 'refused: “Dec 2026–Mar 2027 can be started from Mon 30 Nov 2026, when Q4’s wrap-up opens.”', run: () => says(() => startNextCycle(ctx(PRIYA))) },
      { given: 'Required: a round opens 23 November, agree by 11 December, Q1 starts 4 January. Maya drafts “p95 build time under 8 minutes”, feeding Priya’s goal, and proposes it; Priya agrees it on 2 December.', then: 'It is Agreed. It appears on the planning screen and nowhere in Q4’s counts.' },
      { given: 'Required: Priya sends Maya’s proposal back: “too easy, we were at 9 in October”.', then: 'It is Sent back, with the reason, and is at the top of Maya’s planning list.' },
      { given: 'Required: after it is agreed, Maya changes the target from 8 to 10 minutes.', then: 'It goes back to Proposed and Priya is asked again.' },
      { given: 'Required: on 4 January two of Oskar’s goals are still Proposed.', then: 'Q1 starts with every agreed goal at week 0. Oskar’s two are listed for him and the admins, and count nowhere until agreed.' },
    ],
    checks: [
      'A goal in a round has no status or flags and is in no count, list or AI answer about the current cycle.',
      'Only the owner of the goal it feeds (or the lead of the team above, or an admin at the top) can agree or send back a proposal, and sending back needs a reason.',
      'Changing an agreed goal’s target, plan or parent puts it back to Proposed.',
      'Goals wrapped up as “carry on” arrive in the round as drafts.',
      'On the start date exactly the agreed goals go live at week 0; the rest are listed.',
      'Every step of the round is in the change log, with who and when.',
    ],
    stage: { file: 'stage-2-core-data.md', title: 'Stage 2: the core data and the change engine', why: 'a goal’s round state is a record, and “counts nowhere until agreed” is a rule on which goals the stage 1 rules see. The planning screen is stage 3.' },
    decided: [
      'Agreement follows the goal tree (the owner of the goal it feeds), not a central queue for admins.',
      'Drafts are readable by every member, as everything else is, but never counted.',
      'Faro’s “carry on” wrap-up becomes the round’s starting drafts.',
    ],
  },
];

/** The note on observability: an idea, not a requirement (backlog 8r; release 5 was dropped on 8 Nov). */
export const OBSERVABILITY = {
  title: 'Observability, as an idea',
  summary: 'Not a requirement. What Faro records about how it is used today, and what the internal app might take from it; the company’s own tooling does the rest.',
  today: [
    'Each MCP tool call is recorded as a span, with the database reads and saves inside it, in `okr_telemetry_spans` (migration 0022); a W3C `traceparent` header joins a caller’s trace. Spans carry the tool’s name, the person’s and workspace’s ids and the class of any failure, never a tool’s arguments or answers (docs/mcp.md, “Telemetry”).',
    'An admin can turn recording off for a workspace (`setRecording`); then nothing is recorded or sent for it, from the app or the server.',
    'After every deploy, `GET /api/mcp?check` says whether the server reaches the database and can read pictures, and CI fails when something is missing (`.github/workflows/deploy-check.yml`).',
    'A markup carries the steps before it and the visit’s errors, so a builder sees what happened (the builder inbox).',
  ],
  idea: [
    'Send traces, logs and errors to the company’s own tools (OpenTelemetry), not a page inside the app.',
    'Keep Faro’s privacy rule: record what happened and how long it took, never what people wrote; recording off means nothing is sent.',
    'Keep the check after each deploy, and alert on the page-load budgets of [R4](r4-scale-and-safety.md) and on failed saves.',
    'Dropped on 8 Nov, for the company’s tooling to cover if wanted: an overlay in the app, an Observability page, a weekly review of the traces by Claude, and alerts of Faro’s own.',
  ],
};

/* ---------- the pages ---------- */

const GENERATED = '<!-- Generated by npm run spec from src/spec/internal.ts. Edit the code, not this file. -->\n\n';
const titleOf = (file: string) => INTERNAL_PAGES.find(([f]) => f === file)?.[1] ?? file;

/** `src/domain/actions.ts#savePerson` as a link to the file, with the function named. */
const codeLink = (ref: string) => { const [file, fn] = ref.split('#'); return `${link(3, file!, fn ? `\`${fn}\`` : `\`${file}\``)}`; };

function accessTable(): string {
  const out: string[] = [];
  for (const area of [...new Set(ACCESS.map((a) => a.area))]) {
    out.push(`### ${area}`, '', table(['What', 'Who may', 'Enforced today by'], ACCESS.filter((a) => a.area === area).map((a) => [cell(a.what), cell(a.who), a.code.map(codeLink).join(', ')])), '');
  }
  return out.join('\n');
}

function page(q: InternalRequirement): string {
  return GENERATED + [
    `# ${q.title}`,
    '',
    q.summary,
    '',
    '**Spec only.** Faro doesn’t build this: the internal app’s own platform provides the machinery, and this page says what it must do. It is part of the rebuild kit, not of Faro’s own requirements (`evals/requirements.json`).',
    '',
    '## Why',
    '',
    ...q.why.flatMap((w) => [w, '']),
    '## The rule',
    '',
    q.rule,
    '',
    ...(q.id === 'R1' ? ['## Who may change what', '', 'Read from Faro’s shared actions: each line names the function that enforces it today, in the app and the AI assistant alike. `src/spec/internal.test.ts` fails when an action that says who may do something isn’t listed here. Anything not listed, any member may do.', '', accessTable()] : []),
    '## What Faro does today',
    '',
    ...q.today.map((t) => `- ${t}`),
    '',
    '## Worked examples',
    '',
    'An example marked **Faro today** is run against Faro’s code by `src/spec/internal.test.ts`: the result is what the code gives now. The others say what the internal app must do.',
    '',
    table(['Given', 'Then', 'Kind'], q.examples.map((e) => [cell(e.given), cell(e.then), e.run ? '**Faro today**' : 'Required'])),
    '',
    '## Acceptance checks',
    '',
    ...q.checks.map((c, i) => `${i + 1}. ${c}`),
    '',
    '## Nearest rebuild stage',
    '',
    `[${q.stage.title}](../../rebuild/${q.stage.file}): ${q.stage.why}`,
    '',
    '## Decided while writing it',
    '',
    ...q.decided.map((d) => `- ${d}`),
    '',
  ].join('\n');
}

function observability(): string {
  const o = OBSERVABILITY;
  return GENERATED + [
    `# ${o.title}`,
    '',
    o.summary,
    '',
    '## What Faro records today',
    '',
    ...o.today.map((t) => `- ${t}`),
    '',
    '## The idea',
    '',
    ...o.idea.map((t) => `- ${t}`),
    '',
  ].join('\n');
}

function index(): string {
  return GENERATED + [
    '# Requirements for the internal app',
    '',
    'Faro is a model for the company’s internal goals app, plus a demo; it never holds real data. The internal team copies its code and plugs in their own platform. Some things that app must do, Faro doesn’t build: because that platform provides the machinery (sign-in, single sign-on, time zones done properly, the scale and safety of real data), or because they only matter in a company the size of the real one (its organisation, delegates, a planning round). Each is written here instead, so the rebuild has the rule even though Faro has no code for it.',
    '',
    'Each page says why, the rule, what Faro does today (and where it falls short), worked examples (those marked **Faro today** are run against Faro’s code), acceptance checks, and the nearest stage of [the rebuild kit](../../rebuild/README.md).',
    '',
    table(['Requirement', 'What it says', 'Nearest stage'], INTERNAL.map((q) => [`[${q.title}](${q.file}.md)`, cell(q.summary), `[${q.stage.title}](../../rebuild/${q.stage.file})`])),
    '',
    `And a short note, not a requirement: [${titleOf('observability')}](observability.md), what Faro records about how it is used today and what the internal app might take from it.`,
    '',
    '## How they fit the rest of the spec',
    '',
    '- The rules about who may do what, the status rules and the change engine are Faro’s own and live once, in the code ([the core rules](../../core/rules/README.md)). These pages don’t restate them; they say where the internal app must enforce them, and how.',
    '- Faro’s own requirements, with their tests and journeys, are in [the core requirements](../../core/requirements.md). These have acceptance checks instead, for the internal team to automate on their platform.',
    '',
  ].join('\n');
}

/** Every worked example that is run against the code and doesn't give what it says. */
export function wrongInternalExamples(): string[] {
  const out: string[] = [];
  for (const q of INTERNAL) for (const e of q.examples) {
    if (!e.run) continue;
    let got: string;
    try { got = e.run(); } catch (err) { got = `threw ${String(err)}`; }
    if (got !== e.then) out.push(`${q.id}: “${e.given}” gives “${got}”, not “${e.then}”`);
  }
  return out;
}

/** Every file under spec/requirements/internal/, by path from the repository root. */
export function internalFiles(): Record<string, string> {
  const out: Record<string, string> = { 'spec/requirements/internal/README.md': index(), 'spec/requirements/internal/observability.md': observability() };
  for (const q of INTERNAL) out[`spec/requirements/internal/${q.file}.md`] = page(q);
  return out;
}
