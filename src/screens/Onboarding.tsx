/* Setting up a workspace: from nothing to an outcome, the goals feeding it and the people who own them,
   one question per screen, in about three minutes. A template fills it in so it's never blank. */
import { isTop, levelName } from '../domain/levels';
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMaybeApp, useSetup } from '../app/state';
import { useDraft } from '../app/drafts';
import { searchOver, usePrefs } from '../app/search';
import { setupSteps, type SetupStep } from '../domain/dayOne';
import { SETUP_STEP_NAMES } from '../domain/arrival';
import { readChanges, templateSheets } from '../app/spreadsheet';
import { tooLarge } from '../domain/importLimits';
import { saveAndSay } from '../app/files';
import { buildWorkspace, ownerToAdd, parseTable, setupDefaults, type ImportIssue } from '../domain/importer';
import type { Answer } from '../domain/problemLevels';
import { codeOf, GOAL_ACTION_WORDS, PERSON_ACTION_WORDS } from '../domain/columns';
import type { Rec, Tables } from '../domain/sheets';
import { isEmail, mergePeople, normalEmail } from '../domain/people';
import type { Cycle } from '../domain/types';
import { MONTH_NAMES, startMonth, yearStartFor, yearWeeks } from '../domain/year';
import { yearName } from '../domain/yearName';
import { stagesFromNow, TEMPLATES, type TemplateGoal } from '../domain/templates';
import { currentWeek } from '../domain/plan';
import { firstReview, WEEKDAY } from '../domain/progress';
import { dayText } from '../domain/review';
import { nameLength, nameProblem } from '../domain/thresholds';
import { fmt } from '../domain/format';
import { closeTeam } from '../domain/people';
import { Steps } from '../ui/bits';
import { blankGoal as blankDraft, type GoalDraft } from '../domain/goal';
import { goalChecks, goalMustFix, unanswered, type GoalAnswers, type GoalCheck } from '../domain/goalEntry';
import { targetText } from '../domain/format';
import { Icon } from '../ui/Icon';
import { FormClose } from '../ui/FormClose';
import { focusQuestion } from '../ui/questionInView';
import type { Mark } from '../help/flows';
import { telemetry } from '../telemetry';
import { useMark } from '../telemetry/react';
import { isOffline, isStaleCodeError, recoverFromStaleCode } from '../telemetry/staleCode';
import { Questions, StageFields } from '../ui/GoalFields';
import { PickOne, type PickSource } from '../ui/Pick';

interface PersonRow { name: string; email: string; title: string; team: string; admin: boolean }
interface GoalRow extends TemplateGoal { owner: string; /** The picked owner's email, which tells two people of one name apart (FS1 review). */ ownerEmail?: string; /** How it's measured: optional, one line (setup review, 8 Nov). */ definition?: string; /** Answers to the card's questions (goal entry, rule 3), by slot. */ answers?: GoalAnswers }
/** Set-up's owner picker: a search over the draft's people, and the names a goal row keeps. */
interface OwnerPick { source: PickSource; idOf: (g: Pick<GoalRow, 'owner' | 'ownerEmail'>) => string | null; rowOf: (id: string | null) => Pick<GoalRow, 'owner' | 'ownerEmail'> }

interface SetupDraft {
  step: number;
  name: string;
  startDate: string;
  reviewDay: number;
  me: PersonRow;
  people: PersonRow[];
  objectives: Record<string, string>;
  template: string;
  outcome: GoalRow;
  goals: GoalRow[];
  /** The Goals, Plan and Check-ins sheets of an uploaded spreadsheet (the template, or a workbook exported from another
      workspace), used instead of the outcome and goals steps. */
  fileTables?: Tables;
  /** Team names typed on purpose although they look like another team's (“It’s a new team”). */
  newTeams?: string[];
  /** Whether the workspace records how the app is used: off unless chosen here (backlog WS, Lane 9 Nov). */
  recording?: boolean;
  /** The uploaded spreadsheet's name, and the answers to its preview's questions (IM8): by group id, with the words its
      closed line says, and the groups set-up has given its default answer once ("Count them from this week"). */
  fileName?: string;
  fileAnswers?: Record<string, Answer>;
  fileSaid?: Record<string, { title: string; label: string; level: 'must' | 'check' }>;
  fileDefaults?: string[];
  /** The people "Add {person}" added from the file's answers (by email, else name): gone again when another file
      replaces it (#336 review). */
  fileAdded?: string[];
  /** When it was last changed, for Welcome's "Stopped at step 3 of 7, … on 9 Nov." */
  savedAt?: string;
}

const blankPerson = (): PersonRow => ({ name: '', email: '', title: '', team: '', admin: false });
const blankGoal = (owner = ''): GoalRow => ({ title: '', kind: 'metric', unit: '', start: '', target: '', owner });
const YES = /^(y|yes|true|1|admin|sponsor|coach|goals coach)$/i;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SETUP_STEPS: SetupStep[] = ['workspace', 'you', 'team', 'start', 'outcome', 'goals', 'check'];
const STEP_LABELS = SETUP_STEPS.map((x) => SETUP_STEP_NAMES[x]);
/** Each step, for the named flow (src/help/flows.ts). */
const STEP_MARKS: Mark[] = ['setUp.step-1', 'setUp.step-2', 'setUp.step-3', 'setUp.step-4', 'setUp.step-5', 'setUp.step-6', 'setUp.step-7'];

/** Most goal cards set-up takes: the step asks for two to four (UX report, 8 Nov). */
const MAX_GOALS = 4;
/** How a person added by "Add {person}" is known again: their email, else their name. */
const addedKey = (p: { name: string; email?: string }) => normalEmail(p.email ?? '') || p.name.trim().toLowerCase();

/** What stands in the way of Create at set-up's last step, in the preview's words: problems to fix, questions to
    answer, or both (#336 review: "Settle the 5 questions" when all five were Must fix). */
export function settleLine(groups: readonly { level: string }[], file: string): string {
  const must = groups.filter((g) => g.level === 'must').length, checks = groups.length - must;
  const k = (n: number, one: string, many: string) => (n === 1 ? `the ${one}` : `the ${n} ${many}`);
  if (!checks) return `Fix ${k(must, 'problem', 'problems')} with ${file} above.`;
  if (!must) return `Answer ${k(checks, 'question', 'questions')} about ${file} above.`;
  return `Fix ${k(must, 'problem', 'problems')} and answer ${k(checks, 'question', 'questions')} about ${file} above.`;
}

/** Set-up's preview of a spreadsheet, loaded only when one is read (IM8). Made again on "Try again": a lazy piece that
    failed to load keeps its failure. */
const loadPreview = () => lazy(() => import('../ui/SetupFilePreview').then((m) => ({ default: m.SetupFilePreview })));

/** If the preview's piece can't be loaded, set-up says so and offers to try again, instead of going blank (#336 review).
    The draft and its answers are kept. */
class PreviewBoundary extends Component<{ name: string; onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    try { telemetry.exception(error, 'react'); } catch { /* never in the way */ }
    // A piece of an older build gone since a deploy reloads the page once, as everywhere else (staleCode.ts).
    if (isStaleCodeError(error) && !isOffline()) recoverFromStaleCode(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="stack setup-file" role="alert">
        <p>Couldn’t show what {this.props.name} would add: part of Faro didn’t load. Check your connection and try again. Nothing is lost.</p>
        <div className="row"><button type="button" className="btn" onClick={() => { this.setState({ failed: false }); this.props.onRetry(); }}>Try again</button></div>
      </section>
    );
  }
}

/** After an answer at set-up, the focus goes on as on Import (#336 review): to the next open question, else to the line
    just answered, else to Create workspace; never to the page itself. */
const focusAfterAnswer = (id: string | null, tries = 4) => requestAnimationFrame(() => {
  // An answer can re-render set-up more than once ("Add {person}" adds them, then a default answer follows), so a focus
  // that fell to the page is tried again for a few frames.
  const fell = !document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected;
  if (fell || document.activeElement?.closest('.setup-file')) {
    const next = document.querySelector<HTMLElement>('.setup-file .import-group input[type=radio]');
    (next ?? (id ? document.getElementById(`answered-${id}`) : null) ?? document.querySelector<HTMLElement>('form button[type=submit]'))?.focus();
  }
  if (tries > 1) requestAnimationFrame(() => { if (!document.activeElement || document.activeElement === document.body) focusAfterAnswer(id, tries - 1); });
});

/** Rows of a pasted or uploaded people table, matched to our columns by header when there is one. */
export function peopleFromTable(tsv: string): { rows: PersonRow[]; objectives: Record<string, string> } {
  const table = parseTable(tsv);
  const first = (table[0] ?? []).map((h) => h.toLowerCase());
  const hasHeader = first.includes('name');
  const col = (names: string[], fallback: number) => (hasHeader ? first.findIndex((h) => names.includes(h)) : fallback);
  const ci = { name: col(['name'], 0), team: col(['team'], 1), admin: col(['admin', 'profile', 'role'], 2), title: col(['job title', 'title'], -1), objective: col(['team objective', 'objective'], -1), email: col(['email', 'e-mail', 'email address'], -1) };
  const recs = (hasHeader ? table.slice(1) : table).map((r) => {
    const get = (i: number) => (i >= 0 ? r[i] ?? '' : '');
    return { name: get(ci.name), team: get(ci.team), 'job title': get(ci.title), admin: get(ci.admin), 'team objective': get(ci.objective), email: get(ci.email) } as Rec;
  });
  return peopleFromRecords(recs);
}

/** A People sheet's rows (the one format's columns) as the set-up step's rows. Its Action column is read as Import
    reads it (#336 review): an Example row is the template's and is skipped, and someone marked Left isn't added (a goal
    they own then asks who has it). `skipped` counts each, for the upload's note. */
export function peopleFromRecords(recs: Rec[]): { rows: PersonRow[]; objectives: Record<string, string>; skipped: { example: number; left: number } } {
  const objectives: Record<string, string> = {};
  const skipped = { example: 0, left: 0 };
  const rows = recs.flatMap((r) => {
    const get = (k: string) => (r[k] ?? '').trim();
    const action = codeOf(PERSON_ACTION_WORDS, get('action'));
    if (action === 'example' || action === 'left') { if (get('name') || get('email')) skipped[action]++; return []; }
    if (get('team objective') && get('team')) objectives[get('team')] = get('team objective');
    return [{ name: get('name'), email: normalEmail(get('email')), team: get('team'), title: get('job title'), admin: YES.test(get('admin') || get('profile')) }];
  }).filter((r) => r.name || r.team || r.email);
  return { rows, objectives, skipped };
}

/** The people as the one format's People sheet: you first, then everyone else (a row with no team takes yours). */
function peopleTsv(me: PersonRow, rows: PersonRow[], objectives: Record<string, string>) {
  const all = [me, ...rows.filter((r) => r.name.trim() || r.team.trim() || r.email.trim()).map((r) => ({ ...r, team: r.team.trim() || me.team }))];
  const clean = (v: string) => v.replace(/[\t\n]+/g, ' ');
  return ['Name\tEmail\tJob title\tTeam\tAdmin\tTeam objective', ...all.map((r) => [r.name, r.email, r.title, r.team, r.admin ? 'yes' : '', objectives[r.team] ?? ''].map(clean).join('\t'))].join('\n');
}

function goalsTsv(d: SetupDraft) {
  if (d.template === 'file' || d.template === 'later') return '';
  const people = [d.me, ...d.people];
  // A goal with no owner chosen is made owned by whoever sets up (OB3); Home asks them to give it an owner.
  const byName = (owner: string) => people.find((p) => p.name.trim().toLowerCase() === (owner.trim() || d.me.name.trim()).toLowerCase());
  // The email picked, when there is one: two people of one name are told apart by it (FS1 review).
  const person = (owner: string, email?: string) => (email ? people.find((p) => normalEmail(p.email) === normalEmail(email)) : undefined) ?? byName(owner);
  // The owner by email, as the format matches people, with their name beside it.
  const row = (g: GoalRow, headline: boolean) => [
    g.title, person(g.owner, g.ownerEmail)?.team.trim() || d.me.team, person(g.owner, g.ownerEmail)?.email ?? '', g.owner.trim() || d.me.name.trim(), g.kind, g.kind === 'milestone' ? '' : g.unit, g.kind === 'metric' ? g.start : '', g.kind === 'metric' ? g.target : '',
    g.plan ?? 'straight', g.kind === 'range' ? g.limit ?? '' : '', g.kind === 'range' ? g.bound ?? 'at most' : '', g.kind === 'range' ? g.margin ?? '' : '', g.kind === 'milestone' ? g.stages ?? '' : '', headline ? '' : d.outcome.title, headline ? 'north star' : 'team', '', '', g.kind === 'milestone' ? '' : g.definition ?? '',
  ].map((v) => v.replace(/[\t\n]+/g, ' ')).join('\t');
  const goals = d.goals.filter((g) => g.title.trim());
  return ['Goal\tTeam\tOwner email\tOwner\tType\tUnit\tStart\tTarget\tPlan\tLimit\tMust stay\tMargin\tStages\tFeeds into\tLevel\tEffect\tSource\tDefinition', row(d.outcome, true), ...goals.map((g) => row(g, false))].join('\n');
}

/** Setting up a workspace, one question per screen. */
export function Onboarding({ onClose }: { onClose?: () => void }) {
  const setup = useSetup();
  const app = useMaybeApp();
  const nav = useNavigate();
  // Set up from inside the app, "Who are you?" starts as the person you are now (backlog WS); change anything.
  const viewer = app?.viewerChosen ? app.viewer : undefined; // No one chosen yet (from an invitation's arrival): nothing to fill in.
  const [d, setDraft, clear, restored] = useDraft<SetupDraft>(`setup:${setup.mode}`, () => ({
    step: 0, name: '', startDate: yearStartFor(setup.today, 0), reviewDay: 3,
    me: viewer ? { name: viewer.name, email: viewer.email ?? '', title: viewer.role ?? '', team: app?.team(viewer.teamId ?? '')?.name ?? '', admin: true } : { name: '', email: '', title: '', team: '', admin: true }, people: [blankPerson(), blankPerson()], objectives: {},
    template: '', outcome: blankGoal(), goals: [],
  }));
  // Each change says when, so Welcome can say where a set-up was left (set-up spec 2.1).
  const set = (patch: Partial<SetupDraft>) => setDraft({ ...patch, savedAt: setup.today.toISOString() });
  // Ids are global in the database, so the suffix is long enough that two workspaces never share one.
  const [suffix] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join(''));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileNote, setFileNote] = useState('');
  // The people as they were before the last upload, for its Undo.
  const [undoUpload, setUndoUpload] = useState<Pick<SetupDraft, 'people' | 'objectives'> | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [Preview, setPreview] = useState(() => loadPreview());

  // A draft kept from before people had emails still opens.
  const me = { ...d.me, email: d.me.email ?? '' };
  const rowsOf = d.people.map((r) => ({ ...r, email: r.email ?? '' }));
  // Goals from a spreadsheet go through the import's preview in create mode (IM8): its questions are answered on Check,
  // and a goal's stages already due are counted from this week unless that answer is changed.
  const fromFile = d.template === 'file' && !!d.fileTables;
  // Worked out again only when what it reads changes, not on every render (#336 review: 1.3 s a render at 6,000 rows).
  const result = useMemo(
    () => buildWorkspace({ name: d.name, startDate: d.startDate, reviewDay: d.reviewDay, people: peopleTsv(me, rowsOf, d.objectives), goals: goalsTsv(d), ...(fromFile ? { tables: d.fileTables!, answers: d.fileAnswers ?? {} } : {}), now: setup.today, idSuffix: suffix }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.name, d.startDate, d.reviewDay, d.me, d.people, d.objectives, d.template, d.outcome, d.goals, d.fileTables, d.fileAnswers, setup.today, suffix],
  );
  const fileGroups = fromFile ? result.groups.filter((g) => g.level !== 'note') : [];
  // Set-up's default answers, given once per question so "Change" leaves it open (setupDefaults).
  const defaults = fromFile ? setupDefaults(result.groups, d.fileDefaults ?? []) : [];
  useEffect(() => {
    if (!defaults.length) return;
    set({
      fileAnswers: { ...d.fileAnswers, ...Object.fromEntries(defaults.map((x) => [x.id, x.answer])) },
      fileSaid: { ...d.fileSaid, ...Object.fromEntries(defaults.map((x) => [x.id, { title: x.title, label: x.label, level: 'check' as const }])) },
      fileDefaults: [...(d.fileDefaults ?? []), ...defaults.map((x) => x.id)],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.map((x) => x.id).join()]);
  const issues = (t: ImportIssue['table']) => result.issues.filter((i) => (t === 'Goals' ? i.table !== 'People' : i.table === t));
  // peopleTsv drops empty rows, so map each table row to its line in the sheet: header 1, you 2, then the rest.
  const filled = rowsOf.map((r, k) => (r.name.trim() || r.team.trim() || r.email.trim() ? k : -1)).filter((k) => k >= 0);
  const personIssue = (i: number) => { const at = filled.indexOf(i); return at < 0 ? undefined : issues('People').find((x) => x.row === at + 3)?.message; };
  const goalIssue = (row: number) => issues('Goals').find((x) => x.table === 'Goals' && x.row === row)?.message;
  const meIssue = issues('People').find((x) => x.row === 2)?.message;
  // Said on the row and never blocking: a name someone else here also has (the email tells them apart, backlog N).
  const personNote = (i: number) => { const at = filled.indexOf(i); return at < 0 ? undefined : (result.notes ?? []).find((x) => x.table === 'People' && x.row === at + 3)?.message; };
  const meEmail = normalEmail(me.email);
  // Owners are found and picked from the people typed or uploaded so far (find spec 2.3, move 15's set-up), by name: the
  // workspace doesn't exist yet, so the picker asks a search over the draft's people.
  const draftPeople = result.snapshot.people;
  const peopleKey = draftPeople.map((p) => `${p.id}\t${p.name}\t${p.role}\t${p.teamId}`).join('\n') + '\n' + result.snapshot.goals.map((g) => `${g.id}\t${g.key ?? ''}\t${g.title}`).join('\n');
  // The file's goals too, for a check-in row's "Choose a goal" (#336 review).
  const draftCycle = result.snapshot.cycles[0]!;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ownerSearch = useMemo(() => searchOver(result.snapshot, { cycle: draftCycle, today: setup.today, week: Math.max(0, currentWeek(draftCycle, setup.today)) }), [peopleKey]);
  const owners: OwnerPick = {
    source: { search: ownerSearch, viewerId: draftPeople.find((p) => normalEmail(p.email ?? '') === meEmail)?.id ?? draftPeople[0]?.id ?? '', ws: 'setup' },
    // By email first: with two people of one name, the one picked is the one kept.
    idOf: (g) => (g.ownerEmail ? draftPeople.find((p) => normalEmail(p.email ?? '') === normalEmail(g.ownerEmail!)) : undefined)?.id ?? draftPeople.find((p) => p.name === g.owner.trim())?.id ?? null,
    rowOf: (id) => { const p = id ? draftPeople.find((x) => x.id === id) : undefined; return { owner: p?.name ?? '', ownerEmail: p?.email ?? undefined }; },
  };
  const unownedTitles = new Set(d.template === 'file' || d.template === 'later' ? [] : d.goals.filter((g) => g.title.trim() && !g.owner.trim()).map((g) => g.title.trim()));
  const prefs = usePrefs();
  const skipGoalSteps = d.template === 'file' || d.template === 'later';

  // Each field says its own problem (setup review, 8 Nov): a name of at least MIN_NAME characters, and the numbers a goal needs.
  const nameIssue = nameProblem(d.name, 'workspace');
  const meErr = {
    name: !d.me.name.trim() ? 'Add your name.' : null,
    email: !meEmail ? 'Add your email.' : !isEmail(meEmail) ? `“${me.email}” doesn’t look like an email.` : null,
    team: !d.me.team.trim() ? 'Add your team.' : null,
  };
  // A team typed close to another one (“Suport” beside “Support”) is asked about before it makes a second team.
  const teamOf = (r: PersonRow) => r.team.trim() || d.me.team.trim();
  const typed = [d.me.team.trim(), d.me.team.trim(), ...rowsOf.filter((r) => r.name.trim() || r.email.trim() || r.team.trim()).map(teamOf)].filter(Boolean);
  const teamTypo = (r: PersonRow) => (r.team.trim() && !(d.newTeams ?? []).includes(r.team.trim()) ? closeTeam(r.team, typed) : null);
  // A card's Must fix is goal entry's rule 2 (door 'setup'), in the same words as New goal, a file and the AI tools. The
  // owner, team and level are the step's to fix (2.10), so only the card's own fields are said here.
  const goalErr = (g: GoalRow, headline = false) => {
    const fix = goalMustFix(cardDraft(g), { cycleWeeks: 53, week: 0, existing: null, door: 'setup', noun: headline ? 'outcome' : 'goal' });
    const said = (f: 'title' | 'start' | 'target' | 'limit') => fix.find((x) => x.field === f)?.text ?? null;
    return { title: said('title'), start: said('start'), target: said('target'), limit: said('limit') };
  };
  // A card's questions wait for their answers before Next (2.10), as the form's do.
  const clean = (e: ReturnType<typeof goalErr>, g?: GoalRow) => !e.title && !e.start && !e.target && !e.limit && !(g && unanswered(cardChecks(g), g.answers).length);
  const ok = [
    !nameIssue && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate),
    !meErr.name && !meErr.email && !meErr.team,
    !issues('People').length && !rowsOf.some(teamTypo),
    !!d.template,
    clean(goalErr(d.outcome, true), d.outcome) && !goalIssue(2),
    d.goals.every((g) => !g.title.trim() || clean(goalErr(g), g)) && !issues('Goals').length,
    !result.issues.length && !fileGroups.some((g) => g.level === 'check'),
  ];
  const problem = [
    nameIssue ?? 'Pick the month the goal year starts.',
    '',
    'Fix the rows marked in red, or clear them.',
    'Pick a starting point.',
    goalIssue(2) ?? (unanswered(cardChecks(d.outcome), d.outcome.answers).length ? 'Answer the question above.' : ''),
    d.goals.some((g) => g.title.trim() && clean(goalErr(g)) && unanswered(cardChecks(g), g.answers).length) && d.goals.every((g) => !g.title.trim() || clean(goalErr(g))) ? 'Answer the questions above.' : 'Fix the goals marked in red, or remove them.',
    fileGroups.length ? settleLine(fileGroups, d.fileName ?? 'your spreadsheet') : result.issues[0]?.message ?? '',
  ];
  const fieldErr = (text: string | null | undefined) => (tried && text ? <span className="hint tone-off field-error" role="alert">{text}</span> : null);
  // When the first check-ins are due: the first review on or after today (domain/progress firstReview).
  const cycleNow = { startDate: d.startDate, weeks: yearWeeks(d.startDate), reviewDay: d.reviewDay } as Cycle;
  const first = firstReview(cycleNow, setup.today);
  const firstText = `${WEEKDAY[d.reviewDay]} ${dayText(first.date).slice(4)}`;
  const [removed, setRemoved] = useState<{ goal: GoalRow; at: number } | null>(null);
  const go = (step: number) => { setTried(false); setRemoved(null); setUndoUpload(null); set({ step }); };
  // A problem is said under the field it's about, and that field takes the focus.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!tried) return;
    const el = form.current?.querySelector<HTMLElement>('.qsection .invalid, .qsection [aria-invalid="true"]') ?? form.current?.querySelector<HTMLElement>('.qsection [role="radio"]');
    // A goal card's open question, as New goal and the edit page do it (U93): focus on it, in view.
    const slot = el ? null : form.current?.querySelector<HTMLElement>('.qsection [data-check]')?.dataset.check;
    if (slot) focusQuestion(form.current, slot); else el?.focus();
  }, [tried, d.step]);
  const err = (show = true) => (tried && !ok[d.step] && show ? <span className="hint tone-off field-error" role="alert">{problem[d.step]}</span> : null);
  const next = () => {
    if (!ok[d.step]) { setTried(true); return; }
    if (d.step === 3 && skipGoalSteps) return go(6);
    if (d.step < 6) return go(d.step + 1);
    void create();
  };
  const back = () => go(d.step === 6 && skipGoalSteps ? 3 : Math.max(0, d.step - 1));

  const pickTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    // Stage weeks in a template count from now, so a mid-year setup doesn't start with stages already overdue.
    const now = currentWeek({ startDate: d.startDate, weeks: yearWeeks(d.startDate) } as Cycle, setup.today);
    if (t) set({ template: id, outcome: { ...t.outcome, owner: d.me.name.trim() }, goals: t.goals.map((g) => ({ ...g, owner: '', ...(g.stages ? { stages: stagesFromNow(g.stages, now, yearWeeks(d.startDate)) } : {}) })) });
    else if (id === 'blank') set({ template: id, outcome: blankGoal(d.me.name.trim()), goals: [blankGoal(d.me.name.trim())] });
    else set({ template: id });
  };

  const upload = async (file: File) => {
    try {
      // The size limits Import keeps (domain/importLimits), kept here too: the file's bytes first, then its rows.
      const big = tooLarge(file.name, { bytes: file.size });
      if (big) { setFileNote(big); return; }
      const got = await readChanges(file);
      const tooMany = tooLarge(file.name, { rows: got.rowCount });
      if (tooMany) { setFileNote(tooMany); return; }
      const patch: Partial<SetupDraft> = {};
      const t = got.tables;
      const r = t.people ? peopleFromRecords(t.people) : null;
      // You're already on the first row: the file's row for you (by email, or name) isn't added twice.
      const others = r ? r.rows.filter((x) => !(meEmail && x.email === meEmail) && x.name.trim().toLowerCase() !== d.me.name.trim().toLowerCase()) : [];
      // The people already typed stay: the file's are added after them, and anyone already there isn't added twice
      // (deep review U5: an upload once replaced them without a word).
      // A new goals file drops the people the last one's answers added (they were its owners, not the step's).
      const replacing = !!t.goals?.length && !!d.fileAdded?.length;
      const typed = rowsOf.filter((x) => (x.name.trim() || x.email.trim() || x.team.trim()) && !(replacing && d.fileAdded!.includes(addedKey(x))));
      const merged = mergePeople(typed, others);
      const added = merged.slice(typed.length);
      if (r?.rows.length || replacing) {
        setUndoUpload({ people: d.people, objectives: d.objectives });
        patch.people = merged.length ? merged : [blankPerson()];
        patch.objectives = { ...d.objectives, ...(r?.objectives ?? {}) };
      }
      // The goals with their plans and past check-ins, for "Goals from your spreadsheet".
      // A new file's questions are its own: answers given to the last one are dropped.
      // A file with no goals sheet keeps the goals of the one before it, and says so (#336 review).
      const kept = !t.goals?.length && d.fileTables?.goals?.length ? d.fileName ?? 'your last spreadsheet' : null;
      if (!kept) { patch.fileName = file.name; patch.fileAnswers = {}; patch.fileSaid = {}; patch.fileDefaults = []; patch.fileAdded = []; }
      if (t.goals?.length) patch.fileTables = { goals: t.goals, ...(t.plan ? { plan: t.plan } : {}), ...(t.checkIns ? { checkIns: t.checkIns } : {}) };
      else if (!kept) patch.fileTables = undefined;
      set(patch);
      const n = r?.rows.length ?? 0;
      const extra = [t.plan?.length ? 'plan numbers' : '', t.checkIns?.length ? `${t.checkIns.length} check-ins` : ''].filter(Boolean).join(' and ');
      const there = others.length - added.length;
      const plural = (k: number) => `${k} ${k === 1 ? 'person' : 'people'}`;
      const people = !n ? 'no people sheet'
        : `${added.length ? `added ${plural(added.length)}` : 'no one new to add'}${typed.length ? ` after the ${typed.length} you’d typed` : ''}${there ? `; ${there} in the file ${there === 1 ? 'was' : 'were'} already there` : ''}`;
      const skips = r ? [r.skipped.example ? `${plural(r.skipped.example)} marked Example` : '', r.skipped.left ? `${plural(r.skipped.left)} marked Left` : ''].filter(Boolean).join(' and ') : '';
      setFileNote(`Read ${file.name}: ${people}${skips ? `; ${skips} ${r!.skipped.example + r!.skipped.left === 1 ? 'wasn’t' : 'weren’t'} added` : ''}.${t.goals?.length ? ` It also has a goals sheet${extra ? ` with ${extra}` : ''} you can use in the next step.` : kept ? ` The goals from ${kept} stay.` : ''}`);
    } catch (e) {
      setFileNote(`Couldn’t read ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const meId = result.snapshot.people[0]?.id;
      const wsId = await setup.createWorkspace(d.name.trim(), result.snapshot, meId, !!d.recording);
      // The goals left without an owner are owned by whoever set up, and remembered for them, for Home's "Give n goals
      // an owner" (OB3, rule 7). No field is added to a goal.
      const unowned = result.snapshot.goals.filter((g) => unownedTitles.has(g.title)).map((g) => g.id);
      if (meId) prefs.set(wsId, meId, 'day-one', { firstSeenAt: null, unowned });
      clear();
      nav('/ready', { replace: true });
    } catch (e) {
      setup.toast('Couldn’t create the workspace: ' + (e instanceof Error ? e.message : String(e)), 'error');
      setBusy(false);
    }
  };

  const close = () => (onClose ? onClose() : nav(setup.hasWorkspaces ? '/workspace' : '/'));
  const shownStep = d.step + 1;
  // The counter counts the path chosen (rule 6): with goals set up later or from a spreadsheet, Check is Step 5 of 5.
  const counted = setupSteps(d.template);
  useMark(STEP_MARKS[d.step] ?? null);
  const updatePerson = (i: number, p: Partial<PersonRow>) => set({ people: rowsOf.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const updateGoal = (i: number, p: Partial<GoalRow>) => set({ goals: d.goals.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const label = busy ? 'Creating…' : d.step === 6 ? 'Create workspace' : 'Next';

  return (
    <div className={'focus focus-onboard' + (d.step === 2 || d.step === 5 ? ' focus-roomy' : '')}>
      <div className="focus-top">
        <span className="small strong">Set up</span>
        <Steps at={counted ? counted.indexOf(SETUP_STEPS[d.step]!) + 1 : shownStep} of={counted?.length ?? 7} label={STEP_LABELS[d.step]} />
        <FormClose keeps onClose={close} />
      </div>
      <form ref={form} className="focus-body" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        {restored && <p className="hint">Picked up where you left off. <button type="button" className="linkish tap-44" onClick={() => { clear(); window.location.reload(); }}>Start over</button></p>}

        {d.step === 0 && (
          <section className="qsection">
            <h1 className="qtitle big">What’s this workspace for?</h1>
            <div className="field">
              <label className="field"><span className="field-label">Name</span>
                <input className={'input big-input' + (tried && nameIssue ? ' invalid' : '')} aria-invalid={(tried && !!nameIssue) || undefined} aria-describedby={nameLength(d.name) ? 'setup-name-length' : undefined} autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Platform Engineering" />
              </label>
              {/* The limit is said while typing, never applied by cutting the name short (backlog WS). */}
              {nameLength(d.name) && <span id="setup-name-length" className={'hint' + (nameIssue?.startsWith('Keep') ? ' tone-off' : '')} role="status">{nameLength(d.name)}</span>}
              {fieldErr(nameIssue)}
            </div>
            {cycleOpen ? (
              <>
              <div className="pair">
                <label className="field"><span className="field-label">The goal year starts in</span>
                  <select className="input" value={startMonth({ startDate: d.startDate } as Cycle)} onChange={(e) => set({ startDate: yearStartFor(setup.today, Number(e.target.value)) })}>{MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                </label>
                <label className="field"><span className="field-label">Weekly review on</span>
                  <select className="input" value={d.reviewDay} onChange={(e) => set({ reviewDay: Number(e.target.value) })}>{DAYS.map((x, i) => <option key={x} value={i}>{x}</option>)}</select>
                </label>
              </div>
              <span className="hint">Weeks follow the calendar: week 1 is the week with the first Thursday of {MONTH_NAMES[startMonth({ startDate: d.startDate } as Cycle)]}{startMonth({ startDate: d.startDate } as Cycle) === 0 ? ', so week numbers match ISO weeks' : ''}. This year has {yearWeeks(d.startDate)} weeks.</span>
              </>
            ) : (
              <span className="hint">Goals for the year {yearName(d.startDate, yearWeeks(d.startDate))}, in four quarters, with a weekly review for everyone <span className="nowrap">on {DAYS[d.reviewDay]}s.</span> The first is on {firstText}, so nothing is due before it. <span className="nowrap"><button type="button" className="linkish tap-44" onClick={() => setCycleOpen(true)}>Change</button></span></span>
            )}
            {/* Asked here, off unless chosen (backlog WS, Lane 9 Nov); an admin can change it later, under Privacy. */}
            <label className="check record-check setup-recording">
              <input type="checkbox" checked={!!d.recording} onChange={(e) => set({ recording: e.target.checked })} />
              <span className="stack" style={{ gap: 0 }}>
                <span>Record how the app is used here</span>
                <span className="hint">Off unless you tick it. On, Faro records the pages people open, the buttons they press, errors and slow pages, never anything anyone types, for the people building it. An admin can change it later in Workspace, under Privacy.</span>
              </span>
            </label>
            {err(!nameIssue)}
          </section>
        )}

        {d.step === 1 && (
          <section className="qsection">
            <h1 className="qtitle big">Who are you?</h1>
            <div className="pair">
              <div className="field"><label className="field"><span className="field-label">Your name</span><input className={'input' + (tried && meErr.name ? ' invalid' : '')} aria-invalid={(tried && !!meErr.name) || undefined} autoFocus value={d.me.name} onChange={(e) => set({ me: { ...d.me, name: e.target.value } })} placeholder="e.g. Ana Silva" /></label>{fieldErr(meErr.name)}</div>
              <div className="field"><label className="field"><span className="field-label">Your team</span><input className={'input' + (tried && meErr.team ? ' invalid' : '')} aria-invalid={(tried && !!meErr.team) || undefined} value={d.me.team} onChange={(e) => set({ me: { ...d.me, team: e.target.value } })} placeholder="e.g. Platform" /></label>{fieldErr(meErr.team)}</div>
            </div>
            <div className="field"><label className="field"><span className="field-label">Your email</span><input className={'input' + (tried && meErr.email ? ' invalid' : '')} aria-invalid={(tried && !!meErr.email) || undefined} type="email" autoComplete="email" value={me.email} onChange={(e) => set({ me: { ...me, email: e.target.value } })} placeholder="e.g. ana.silva@example.com" /></label>{fieldErr(meErr.email)}{tried && meIssue && ok[1] && <span className="hint tone-off field-error" role="alert">{meIssue}</span>}</div>
            {viewer && d.me.name === viewer.name && <p className="hint" role="status">Filled in as {viewer.name}, from {app?.ws.name}. Change anything that’s different here.</p>}
            <p className="hint">You’ll be this workspace’s admin: you can add people, change settings and make others admins. Anyone can own goals, watch them and run reviews. Emails tell people apart, in the app and in spreadsheets.</p>
          </section>
        )}

        {d.step === 2 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">Who else is on it?</h1>
              <span className="hint">Type them in, paste rows from a spreadsheet, or upload one. You can also add people later. Leave Team empty for your own team{d.me.team.trim() ? ` (${d.me.team.trim()})` : ''}.</span>
            </div>
            <div className="people-grid" role="table" aria-label="People">
              <div className="pg-head" role="row"><span role="columnheader">Name</span><span role="columnheader">Email</span><span role="columnheader">Team</span><span role="columnheader">Admin</span><span /></div>
              {rowsOf.map((r, i) => {
                const issue = personIssue(i);
                const teamIssue = !!issue && /has no team/.test(issue);
                const emailIssue = !!issue && /email/i.test(issue);
                const typo = teamTypo(r);
                const above = i > 0 ? teamOf(rowsOf[i - 1]!) : '';
                return (
                <div key={i} className="pg-row" role="row">
                  <input className={'input' + (issue && !teamIssue && !emailIssue ? ' invalid' : '')} aria-invalid={issue && !teamIssue && !emailIssue ? true : undefined} aria-label={`Person ${i + 1}: name`} value={r.name} placeholder="Name"
                    onChange={(e) => updatePerson(i, { name: e.target.value })}
                    onPaste={(e) => {
                      const t = e.clipboardData.getData('text');
                      if (!/[\t\n]/.test(t)) return;
                      e.preventDefault();
                      const got = peopleFromTable(t);
                      set({ people: [...rowsOf.slice(0, i), ...got.rows, ...rowsOf.slice(i + got.rows.length)].filter((x, k, arr) => x.name || x.team || x.email || k >= arr.length - 1), objectives: { ...d.objectives, ...got.objectives } });
                    }} />
                  <input className={'input pg-email' + (emailIssue ? ' invalid' : '')} aria-invalid={emailIssue || undefined} aria-label={`Person ${i + 1}: email`} type="email" value={r.email} placeholder="Email" onChange={(e) => updatePerson(i, { email: e.target.value })} />
                  <div className="pg-team">
                    <input className={'input' + (teamIssue || typo ? ' invalid' : '')} aria-invalid={teamIssue || !!typo || undefined} aria-label={`Person ${i + 1}: team`} value={r.team} placeholder="Team" list="teams" onChange={(e) => updatePerson(i, { team: e.target.value })} />
                    {/* Empty takes your team; the row above's team is one click away (setup review, 8 Nov). */}
                    {!r.team.trim() && above && above !== d.me.team.trim() && <button type="button" className="linkish tiny" onClick={() => updatePerson(i, { team: above })}>Same as above ({above})</button>}
                  </div>
                  <label className="pg-check"><input type="checkbox" aria-label={`Person ${i + 1}: admin`} checked={r.admin} onChange={(e) => updatePerson(i, { admin: e.target.checked })} /></label>
                  <button type="button" className="iconbtn" aria-label={`Remove person ${i + 1}`} onClick={() => set({ people: d.people.length > 1 ? d.people.filter((_, k) => k !== i) : [blankPerson()] })}><Icon name="close" /></button>
                  {issue && <span className="pg-issue hint tone-off" role="alert">{issue}</span>}
                  {personNote(i) && <span className="pg-issue hint tone-risk" role="status">{personNote(i)}</span>}
                  {typo && (
                    <span className="pg-issue pg-fix hint">
                      <span className="tone-off" role={tried ? 'alert' : undefined}>“{r.team.trim()}” looks like {typo}. Use one name, so it doesn’t make a second team.</span>
                      <button type="button" className="linkish" onClick={() => set({ people: rowsOf.map((x) => (x.team.trim() === r.team.trim() ? { ...x, team: typo } : x)) })}>Use {typo}</button>
                      <button type="button" className="linkish" onClick={() => set({ newTeams: [...(d.newTeams ?? []), r.team.trim()] })}>It’s a different team</button>
                    </span>
                  )}
                </div>
                );
              })}
              <datalist id="teams">{[...new Set([d.me.team, ...d.people.map((r) => r.team)].filter(Boolean))].map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            {err()}
            <div className="actions">
              <button type="button" className="btn sm" onClick={() => set({ people: [...d.people, blankPerson()] })}>Add a person</button>
              <UploadButton onFile={upload} />
              <button type="button" className="linkish tap" onClick={() => void saveAndSay(setup.toast, { workspace: d.name.trim() || 'new workspace', what: 'template', date: setup.today }, { kind: 'xlsx', sheets: templateSheets() }, 'Template saved')}>Download the Excel template</button>
            </div>
            {fileNote && <span className="hint" role="status">{fileNote}{undoUpload && <> <button type="button" className="linkish" onClick={() => { set(undoUpload); setUndoUpload(null); setFileNote(''); }}>Undo</button></>}</span>}
          </section>
        )}

        {d.step === 3 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">Where do you want to start?</h1>
              <span className="hint">A template gives you an outcome and the goals that usually feed it. You change the names and numbers next.</span>
            </div>
            <div className="optlist" role="radiogroup" aria-label="Starting point">
              {!!d.fileTables?.goals?.length && <button type="button" role="radio" className="opt" aria-checked={d.template === 'file'} onClick={() => pickTemplate('file')}><span>Goals from your spreadsheet</span><span className="hint">As uploaded{d.fileTables.checkIns?.length ? ', with their plans and check-ins' : ''}</span></button>}
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" role="radio" className="opt" aria-checked={d.template === t.id} onClick={() => pickTemplate(t.id)}>
                  <span>{t.name}</span><span className="hint">{t.blurb}</span>
                </button>
              ))}
              <button type="button" role="radio" className="opt" aria-checked={d.template === 'blank'} onClick={() => pickTemplate('blank')}><span>Start blank</span><span className="hint">Type your own outcome and goals</span></button>
              <button type="button" role="radio" className="opt" aria-checked={d.template === 'later'} onClick={() => pickTemplate('later')}><span>Set goals up later</span><span className="hint">Each owner adds theirs in the app</span></button>
            </div>
            {/* The steps this choice skips say so, rather than the count jumping (backlog WS). */}
            {skipGoalSteps && <p className="hint setup-skip" role="status">{d.template === 'later' ? 'The next two steps, the outcome and its goals, are skipped: each owner adds theirs from New goal once the workspace is set up.' : 'The next two steps, the outcome and its goals, are skipped: they come from your spreadsheet.'} Next goes straight to Check.</p>}
            {err()}
          </section>
        )}

        {d.step === 4 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">What outcome are you after?</h1>
              <span className="hint">The one number that says whether this year worked. Everything else feeds it.</span>
              {d.template !== 'blank' && <span className="hint">Example numbers. Change them to yours.</span>}
            </div>
            <SetupGoalFields g={d.outcome} owners={owners} onChange={(p) => set({ outcome: { ...d.outcome, ...p } })} issue={tried ? goalIssue(2) : undefined} errors={tried ? goalErr(d.outcome, true) : undefined} headline startDate={d.startDate} />
          </section>
        )}

        {d.step === 5 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">What feeds it?</h1>
              <span className="hint">Two to four goals that move “{d.outcome.title}”. Pick an owner for each; they check in weekly.</span>
              {d.template !== 'blank' && <span className="hint">Example numbers. Change them to yours.</span>}
            </div>
            {d.goals.map((g, i) => (
              <div key={i} className="goalcard">
                <SetupGoalFields g={g} owners={owners} ownerHint={i === 0 ? 'Give a teammate one, so they have something to check in on. You can leave it for now.' : undefined} onChange={(p) => updateGoal(i, p)} issue={tried ? goalIssue(i + 3) : undefined} errors={tried && g.title.trim() ? goalErr(g) : undefined} week={currentWeek({ startDate: d.startDate, weeks: yearWeeks(d.startDate) } as Cycle, setup.today)} weeks={yearWeeks(d.startDate)} startDate={d.startDate} />
                <button type="button" className="linkish tap" onClick={() => { setRemoved({ goal: g, at: i }); set({ goals: d.goals.filter((_, k) => k !== i) }); }}>Remove this goal</button>
              </div>
            ))}
            {/* Removing a card can be undone until the next change of step (UX report, 8 Nov). */}
            {removed && <p className="hint" role="status">Removed “{removed.goal.title.trim() || 'a goal'}”. <button type="button" className="linkish" onClick={() => { set({ goals: [...d.goals.slice(0, removed.at), removed.goal, ...d.goals.slice(removed.at)] }); setRemoved(null); }}>Undo</button></p>}
            {err()}
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <button type="button" className="btn sm" disabled={d.goals.length >= MAX_GOALS} aria-describedby={d.goals.length >= MAX_GOALS ? 'goals-cap' : undefined} onClick={() => { setRemoved(null); set({ goals: [...d.goals, blankGoal(d.me.name.trim())] }); }}>Add a goal</button>
              {d.goals.length >= MAX_GOALS && <span className="hint" id="goals-cap">Four is the most here: a few goals get the attention they need. Add more from New goal once the workspace is set up.</span>}
            </div>
          </section>
        )}

        {d.step === 6 && (
          <section className="qsection">
            <h1 className="qtitle big">Ready to create {d.name.trim() || 'your workspace'}?</h1>
            {fromFile && (
              <PreviewBoundary name={d.fileName ?? 'your spreadsheet'} onRetry={() => setPreview(() => loadPreview())}>
              <Suspense fallback={<p className="hint">Reading {d.fileName ?? 'your spreadsheet'}…</p>}>
                <Preview name={d.fileName ?? 'your spreadsheet'} goals={result.snapshot.goals.length} people={result.snapshot.people.length} held={new Set(result.issues.filter((i) => i.table === 'Goals').map((i) => i.row)).size}
                  examples={(d.fileTables?.goals ?? []).filter((r) => codeOf(GOAL_ACTION_WORDS, (r['action'] ?? '').trim()) === 'example').length} groups={fileGroups} issues={result.found}
                  answers={d.fileAnswers ?? {}} said={d.fileSaid ?? {}} source={owners.source}
                  valueOf={(kind, id) => {
                    if (kind === 'goal') { const g = result.snapshot.goals.find((x) => x.id === id); return g?.key ?? ''; }
                    if (kind === 'team') return result.snapshot.teams.find((t) => t.id === id)?.name ?? '';
                    const p = draftPeople.find((x) => x.id === id); return p?.email || p?.name || '';
                  }}
                  onAnswer={(g, x) => {
                    // "Add {person}": they join the people step's rows, so the file's people and those typed are one list.
                    if (x.answer.choice === 'add') { const o = ownerToAdd(d.fileTables?.goals ?? [], g, d.me.team.trim()); set({ people: [...rowsOf.filter((r) => r.name.trim() || r.email.trim() || r.team.trim()), { ...blankPerson(), ...o }], fileAdded: [...(d.fileAdded ?? []), addedKey(o)] }); focusAfterAnswer(null); return; }
                    set({ fileAnswers: { ...d.fileAnswers, [g.id]: x.answer }, fileSaid: { ...d.fileSaid, [g.id]: { title: x.title, label: x.label, level: x.level } } });
                    focusAfterAnswer(g.id);
                  }}
                  onClear={(id) => { const { [id]: _a, ...answers } = d.fileAnswers ?? {}; const { [id]: _s, ...said } = d.fileSaid ?? {}; set({ fileAnswers: answers, fileSaid: said }); focusAfterAnswer(null); }} />
              </Suspense>
              </PreviewBoundary>
            )}
            {err()}
            <dl className="details">
              <dt>People</dt><dd>{result.snapshot.people.length} in {result.snapshot.teams.length} {result.snapshot.teams.length === 1 ? 'team' : 'teams'}</dd>
              <dt>Goals</dt><dd>{result.snapshot.goals.length ? `${result.snapshot.goals.length}, listed below${d.template === 'file' ? ', from your spreadsheet (the outcome and goals steps were skipped)' : ''}` : 'None yet: the outcome and goals steps were skipped. Each owner adds theirs from New goal.'}</dd>
              <dt>Goal year</dt><dd>{yearName(d.startDate, yearWeeks(d.startDate))}, starting in {MONTH_NAMES[startMonth({ startDate: d.startDate } as Cycle)]}; you join it in week {Math.max(0, currentWeek(cycleNow, setup.today))}</dd>
              <dt>Weekly review</dt><dd>Everyone, every goal, on {DAYS[d.reviewDay]}s. The first is on {firstText}; the first check-ins are due before it.</dd>
              <dt>You</dt><dd>{d.me.name} ({meEmail}), admin</dd>
              <dt>Recording</dt><dd>{d.recording ? 'On: how the app is used here is recorded' : 'Off: nothing about how the app is used here is recorded'}</dd>
              {(d.fileTables?.checkIns?.length ?? 0) > 0 && d.template === 'file' && <><dt>History</dt><dd>{result.snapshot.checkIns.length} past {result.snapshot.checkIns.length === 1 ? 'check-in' : 'check-ins'}, from your spreadsheet</dd></>}
            </dl>
            <div className="row" style={{ gap: 'var(--s3)' }}>
              <button type="button" className="linkish small tap-44" onClick={() => go(0)}>Change name or year</button>
              <button type="button" className="linkish small tap-44" onClick={() => go(2)}>Change people</button>
            </div>
            {result.snapshot.goals.length > 0 && (
              <div className="stack" style={{ gap: 'var(--s2)' }}>
                <span className="field-label">Check each goal’s owner, where it starts and its target</span>
                {unownedTitles.size > 0 && <p className="small setup-unowned">{unownedTitles.size === 1 ? '1 goal has' : `${unownedTitles.size} goals have`} no owner yet. You can choose them now, or from Home afterwards.</p>}
                <ul className="record">
                  {result.snapshot.goals.map((g) => (
                    <li key={g.id}>
                      <span className="strong">{g.title}{isTop(null, g.level) ? ` · ${levelName(null, g.level)}` : ''}</span>
                      <span className="small">{unownedTitles.has(g.title) ? 'No owner yet' : result.snapshot.people.find((p) => p.id === g.ownerId)?.name ?? '—'} · {g.kind === 'metric' ? `${fmt(g.plan.start, g)} today → ${targetText(g)}${g.plan.target < g.plan.start ? ', lower is better' : ''}` : targetText(g)}{g.kind === 'milestone' ? ` · ${g.stages.map((st) => `${st.name} by week ${st.dueWeek}`).join(', ')}` : ''}</span>
                    </li>
                  ))}
                </ul>
                {!skipGoalSteps && <div className="row" style={{ gap: 'var(--s3)' }}><button type="button" className="linkish small" onClick={() => go(4)}>Change the north star</button><button type="button" className="linkish small" onClick={() => go(5)}>Change the goals</button></div>}
              </div>
            )}
          </section>
        )}

        <div className="focus-foot">
          <div className="foot-row">
            {d.step > 0 && <button type="button" className="btn ghost" onClick={back}>Back</button>}
            <button className="btn primary big-btn" type="submit" disabled={busy}>{label}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** A card as goal entry's draft: its type, unit and numbers (owner, team and level are the step's, 2.10). */
function cardDraft(g: GoalRow): GoalDraft {
  return { ...blankDraft('set-up', 'set-up', ''), title: g.title, kind: g.kind, unit: g.unit, start: g.start, target: g.target, limit: g.limit ?? '', margin: g.margin ?? '', ...(g.kind === 'milestone' ? { stages: [{ id: 's', name: 'x', dueWeek: '1' }] } : {}) };
}
/** The number questions a card asks (2.10): below zero, over 100%, a hundredfold, a billion, a margin as wide as the limit. */
const CARD_CHECKS = ['below-zero', 'over-100', 'hundredfold', 'billion', 'margin-wide'];
function cardChecks(g: GoalRow): GoalCheck[] {
  const d = cardDraft(g);
  const mustFix = goalMustFix(d, { cycleWeeks: 53, week: 0, existing: null, door: 'setup' });
  return goalChecks(d, { week: 0, cycleWeeks: 53, existing: null, door: 'setup', mustFix }).filter((c) => CARD_CHECKS.includes(c.id));
}

function SetupGoalFields({ g, owners, onChange, issue, errors, headline, week = 0, weeks = 52, startDate, ownerHint }: { ownerHint?: string; g: GoalRow; owners: OwnerPick; onChange: (p: Partial<GoalRow>) => void; issue?: string; errors?: { title: string | null; start: string | null; target: string | null; limit: string | null }; headline?: boolean; week?: number; weeks?: number; startDate: string }) {
  const titleIssue = errors?.title;
  const say = (text: string | null | undefined) => (text ? <span className="hint tone-off field-error" role="alert">{text}</span> : null);
  const any = !!errors && !!(errors.title || errors.start || errors.target || errors.limit);
  const name = (headline ? 'Outcome' : g.title || 'Goal');
  // The number questions (goal entry, rule 3; 2.10), under the card's numbers, answered once for the values they're about.
  const answers = g.answers ?? {};
  const questions = (
    <Questions checks={cardChecks(g)} answers={answers} onAnswer={(c) => onChange({ answers: { ...answers, [c.slot]: c.key } })} onNo={() => undefined}
      onChange={(c) => { const { [c.slot]: _gone, ...rest } = answers; onChange({ answers: rest }); }} />
  );
  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <div className="field">
      <label className="field"><span className={headline ? 'sr' : 'field-label'}>{headline ? 'Outcome' : 'Goal'}</span>
        <input className={'input' + (headline ? ' big-input' : '') + (titleIssue ? ' invalid' : '')} aria-invalid={!!titleIssue || undefined} aria-label={headline ? 'Outcome' : 'Goal'} value={g.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={headline ? 'e.g. Weekly active users' : 'e.g. Activation rate'} />
      </label>
      {titleIssue && <span className="hint tone-off field-error" role="alert">{titleIssue}</span>}
      </div>
      {!headline && (
        <div className="optlist compact-opts" role="radiogroup" aria-label="Kind of goal">
          <button type="button" role="radio" className="opt" aria-checked={g.kind === 'metric'} onClick={() => onChange({ kind: 'metric' })}><span>Move a number</span></button>
          <button type="button" role="radio" className="opt" aria-checked={g.kind === 'range'} onClick={() => onChange({ kind: 'range', bound: g.bound ?? 'at most' })}><span>Keep a number in range</span></button>
          <button type="button" role="radio" className="opt" aria-checked={g.kind === 'milestone'} onClick={() => onChange({ kind: 'milestone', stages: g.stages || stagesFromNow('Design@3; Pilot@7; Launch@12', week, weeks) })}><span>Hit dated stages</span></button>
        </div>
      )}
      {g.kind === 'metric' ? (
        <div className="trio">
          <label className="field"><span className="field-label">Today</span><input className={'input' + (errors?.start ? ' invalid' : '')} aria-invalid={!!errors?.start || undefined} inputMode="decimal" value={g.start} onChange={(e) => onChange({ start: e.target.value })} aria-label={name + ': today'} />{say(errors?.start)}</label>
          <label className="field"><span className="field-label">Target</span><input className={'input' + (errors?.target ? ' invalid' : '')} aria-invalid={!!errors?.target || undefined} inputMode="decimal" value={g.target} onChange={(e) => onChange({ target: e.target.value })} aria-label={name + ': target'} />{say(errors?.target)}</label>
          <label className="field"><span className="field-label">Unit</span><input className="input" value={g.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="%, days" aria-label={(headline ? 'Outcome' : g.title || 'Goal') + ': unit'} /></label>
        </div>
      ) : g.kind === 'range' ? (
        <div className="trio">
          <label className="field"><span className="field-label">Must stay</span>
            <select className="input" value={g.bound ?? 'at most'} onChange={(e) => onChange({ bound: e.target.value as 'at most' | 'at least' })} aria-label={(g.title || 'Goal') + ': must stay'}><option value="at most">At most</option><option value="at least">At least</option></select>
          </label>
          <label className="field"><span className="field-label">Limit</span><input className={'input' + (errors?.limit ? ' invalid' : '')} aria-invalid={!!errors?.limit || undefined} inputMode="decimal" value={g.limit ?? ''} onChange={(e) => onChange({ limit: e.target.value })} aria-label={(g.title || 'Goal') + ': limit'} />{say(errors?.limit)}</label>
          <label className="field"><span className="field-label">Warn within</span><input className="input" inputMode="decimal" value={g.margin ?? ''} onChange={(e) => onChange({ margin: e.target.value })} placeholder="1" aria-label={(g.title || 'Goal') + ': warn within'} /></label>
          <label className="field"><span className="field-label">Unit</span><input className="input" value={g.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="%, ms" aria-label={(g.title || 'Goal') + ': unit'} /></label>
        </div>
      ) : null}
      {g.kind !== 'milestone' && questions}
      {g.kind !== 'milestone' ? null : (
        <StageRows value={g.stages ?? ''} onChange={(stages) => onChange({ stages })} goalName={g.title || 'Goal'} cycle={{ startDate, weeks }} week={week} />
      )}
      {/* Asked here, in the open, so a new goal page doesn't say "not described yet" (setup review, 8 Nov). */}
      {g.kind !== 'milestone' && (
        <label className="field"><span className="field-label">How it’s measured <span className="hint">optional</span></span>
          <input className="input" value={g.definition ?? ''} onChange={(e) => onChange({ definition: e.target.value })} aria-label={name + ': how it’s measured'} placeholder={headline ? 'e.g. People who used it at least once in the week, from product analytics' : 'e.g. Median hours to the first reply, from the help desk'} />
        </label>
      )}
      <PickOne kind="person" label="Owner" source={owners.source} value={owners.idOf(g)} none={headline ? undefined : 'No owner yet'} onChange={(id) => onChange(owners.rowOf(id))} />
      {ownerHint && <span className="hint">{ownerHint}</span>}
      {issue && !any && <span className="hint tone-off field-error" role="alert">{issue}</span>}
    </div>
  );
}

/**
 * Stages as rows (name and week), with the same fields as the new-goal wizard and Edit goal. Kept in the text form the
 * importer reads ("Design@3; Pilot@7").
 */
function StageRows({ value, onChange, goalName, cycle, week }: { value: string; onChange: (v: string) => void; goalName: string; cycle: { startDate: string; weeks: number }; week: number }) {
  const parsed = value.split(';').map((x) => x.trim()).filter(Boolean).map((x, i) => { const [n, w] = x.split('@'); return { id: 's' + i, name: (n ?? '').trim(), dueWeek: (w ?? '').trim() }; });
  const stages = parsed.length ? parsed : [{ id: 's0', name: '', dueWeek: '' }];
  const save = (next: { name: string; dueWeek: string }[]) => onChange(next.map((r) => `${r.name.replace(/[;@]/g, ' ')}@${r.dueWeek.replace(/\D/g, '')}`).join('; '));
  return <StageFields stages={stages} onChange={save} onAdd={() => save([...stages, { name: '', dueWeek: '' }])} error={null} labelClass="field-label" cycle={cycle} week={week} goalName={goalName} />;
}

function UploadButton({ onFile, label = 'Upload a spreadsheet' }: { onFile: (f: File) => void; label?: string }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => file.current?.click()}>{label}</button>
      <input ref={file} type="file" accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
  );
}
