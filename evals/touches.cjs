/* Which checks a change touches (backlog -1), so a build session reruns those, not the whole suite, until its final
   full pass. `npm run evals:changed` reads what changed since origin/main and runs the smoke gate's journeys plus the
   journeys and F/N/P checks below for each changed file. The spec scenarios always run (they take seconds).

   Rules are tried in order and every match counts. A changed file under src/, evals/ or server/ that no rule names, or
   one a rule marks FULL (shared layout, styles, the app's state, the rules every screen uses, the eval harness), means
   the full suite: when in doubt, run everything. Documents and the database's paste-in scripts touch nothing extra.
   Keep it rough and safe: listing a check that didn't need to run costs a minute; missing one costs a failure on main. */
const FULL = 'FULL';

/** [what changed, the journeys and checks it touches] */
const RULES = [
  // Nothing extra: words for people, the database's paste-in copies, the backlog. (What's new and the guide are N7.)
  [/^(docs\/|README|CLAUDE\.md|supabase\/manual\/|\.github\/|evals\/(report\.md|requirements\.json))/, []],
  // The spec (backlog 8a, 8b): generated files and their generator. npm test checks them; no screen reads them.
  [/^(spec\/|llms\.txt$|src\/spec\/|scripts\/spec\.mjs$)/, []],
  [/^src\/help\//, ['N7', 'U27', 'U29']],
  // The build-time index of Help and What's new (#167): what the first download knows of them before they load.
  [/^vite\.helpIndex\.ts$/, ['N7', 'U27', 'U29']],
  // Shared by every screen: the full suite.
  [/^(src\/(App|main)\.tsx|src\/styles\.css|src\/styles\/[^/]+\.css|src\/app\/state\.tsx|src\/ui\/|src\/domain\/(vocabulary|status|types|plan|cycle|year)\.ts|src\/data\/(store|examples)\.ts|src\/data\/platformOrg\/|index\.html|vite\.config\.ts|package(-lock)?\.json)/, [FULL]],
  [/^evals\/(journeys\.cjs|run\.mjs|shards\.cjs|touches\.cjs)$/, [FULL]],
  // The module pattern itself (the registry, the places on core screens, the build's module list): everything.
  [/^(src\/core\/|vite\.(modules|mcp\.config)\.ts$)/, [FULL]],
  // A feature module: the journeys and checks its module.json lists, and the design check.
  [/^src\/modules\/([^/]+)\//, (m) => { try { return [...require(`../src/modules/${m[1]}/module.json`).journeys, 'P6']; } catch { return [FULL]; } }],
  // One area each.
  [/^src\/markup\/|^src\/styles\/notes\/(markup|workspace)\.css/, ['U41', 'U42', 'U47', 'U52', 'U53', 'P6']],
  [/^src\/telemetry\//, ['N8']],
  [/^(src\/mcp\/|server\/|api\/)/, ['U22']],
  // The Search and Prefs ports and the find rules (AR1): read by the AI tools until the pickers and list bars use them.
  [/^src\/(ports\/|adapters\/(local|localSearch)\.ts|app\/reads\.ts|domain\/find\.ts)/, ['U22']],
  [/^src\/domain\/dayOne\.ts/, ['U97', 'U11', 'U86', 'U5', 'U49']],
  [/^src\/screens\/Home\.tsx|^src\/domain\/(home|attention)\.ts|^src\/domain\/homeSets\.ts|^src\/ui\/HomeSets\.tsx/, ['U86', 'U2', 'U9', 'U16', 'U33', 'U122', 'U123', 'U124', 'F1', 'F25', 'N3', 'N6', 'N10', 'N26', 'P6']],
  // What changed since you last looked (HM4): rule 5, home-seen, the Goals filter moved/since, and Home's numbers agreeing.
  [/^src\/domain\/(changed|query)\.ts$|^src\/app\/homeSeen\.ts$|^evals\/finish\/25-home-numbers\.cjs$/, ['U124', 'F25']],
  [/^evals\/notes\/12-home\.cjs$/, ['N26']],
  // Fields switched off (TG1): its own check, and the module's journey.
  [/^evals\/notes\/34-fields-off\.cjs$/, ['N34', 'U174']],
  // Held at company size (N12, FS4): its fixture and check, and the search, the pickers and the list bars it times.
  [/^evals\/(fixtures\/company|finish\/11-company-size)\.cjs$|^src\/(ports\/search|adapters\/localSearch|domain\/find|app\/search|app\/reads)\.ts|^src\/ui\/(Pick|ListBar)\.tsx/, ['N12']],
  // The talk-path polish (N10): its own check, and the screens it looks at.
  [/^evals\/notes\/10-talk-polish\.cjs$/, ['N10']],
  [/^src\/screens\/Watching\.tsx/, ['U8', 'U9', 'F1']],
  [/^src\/screens\/(CheckInFlow|CheckInQueue|QuickCheckIn)\.tsx|^src\/ui\/Levels\.tsx|^src\/domain\/checkin\.ts/, ['U71', 'U1', 'U54', 'U15', 'U21', 'U25', 'U30', 'U31', 'U37', 'U39', 'U40', 'U45', 'U57', 'U85', 'U111', 'U142', 'F2', 'F9', 'N8']],
  [/^src\/screens\/(GoalWizard|GoalEdit)\.tsx|^src\/ui\/GoalFields\.tsx|^src\/styles\/finish\/wizard\.css|^src\/domain\/(templates|newGoal|goalEntry|goalRights|readBack)\.ts/, ['U4', 'U54', 'U18', 'U25', 'U30', 'U33', 'U84', 'U85', 'U93', 'U137', 'U134', 'U145', 'U109', 'U136', 'U31', 'U24', 'U91', 'F3', 'F9', 'F16']],
  // Years and weeks (goal entry, rule 13; GE9): the week picker and the rule it shows.
  [/^src\/screens\/Proposed(Goal|List)\.tsx|^src\/domain\/proposed\.ts|^src\/styles\/notes\/proposed\.css/, ['U134', 'U137', 'P6']],
  [/^src\/ui\/WeekPick\.tsx|^src\/domain\/week(s|Choices)\.ts/, ['U109', 'U93', 'U137', 'U18', 'U85', 'U136', 'U5', 'F3', 'F16']],
  [/^src\/screens\/(GoalScreen|Inspect|Respond)\.tsx|^src\/domain\/(goalPage|scorecard|story|chartStory|summary|summaryFacts|progress|trend)\.ts/, ['U6', 'U7', 'U36', 'U37', 'U38', 'U39', 'U57', 'U77', 'U141', 'U78', 'U79', 'U80', 'F4', 'F14', 'N2', 'N9', 'N6', 'N15']],
  [/^src\/ui\/(NextStepSheet|PersonPick|goalRows)\.tsx|^evals\/(finish\/10-goal-order|notes\/11-said-once)\.cjs$/, ['U3', 'U9', 'U77', 'U78', 'U80', 'F14', 'N15']],
  [/^src\/screens\/(GoalsScreen|GoalViews|GoalTable|GoalBoard|GoalFilters|GoalHistory)\.tsx|^src\/ui\/HealthLine\.tsx|^src\/domain\/(query|tableFilter|tableLayout|columns|order)\.ts/, ['U19', 'U23', 'U32', 'U34', 'F5', 'N5', 'N6', 'N10']],
  [/^src\/screens\/GoalMap\.tsx|^src\/domain\/(map|tree)\.ts/, ['U26', 'U30', 'U34', 'F6']],
  [/^src\/screens\/(Review|Retro)\.tsx|^src\/domain\/review\.ts/, ['U3', 'U10', 'U13', 'U36', 'F6', 'N1', 'N25']],
  [/^src\/screens\/Inspect\.tsx|^evals\/notes\/13-review-speak\.cjs$/, ['N25']],
  // Reviews behind its switch (FT2): its read-back, a switched-off module's addresses, and its two journeys.
  [/^src\/domain\/reviewsOff\.ts$|^src\/screens\/NotFound\.tsx$|^src\/ui\/SwitchedOff\.tsx$|^evals\/notes\/21-switched-off\.cjs$/, ['U103', 'U104', 'U48', 'N21']],
  // SW1: the four switches whose code is still the core's, their read-backs and the Features page's groups.
  [/^src\/domain\/switchOff\.ts$|^src\/app\/reads\.ts$|^src\/domain\/home\.ts$|^src\/screens\/(Workspace|Home|GoalsScreen|GoalViews)\.tsx$|^src\/ui\/(Shell|goalRows|HomeSets)\.tsx$|^evals\/notes\/22-more-switches\.cjs$/, ['U164', 'U165', 'U166', 'N22', 'N21']],
  // The check-in rhythm (FT1): its words, its sheet and its journeys and check.
  [/^src\/domain\/rhythm\.ts$|^evals\/(finish\/20-no-rhythm|notes\/31-rhythm)\.cjs$/, ['U101', 'U102', 'F20', 'N31']],
  // Its clock (RS1): dueWords and the receipt, the read-back's two lines; the words with it off, and back on (N30, the tools' one
  // sentence, is a spec scenario in evals/mcp.eval.ts, which always runs).
  [/^src\/domain\/(reviewsOff|progress)\.ts$|^src\/screens\/CheckInFlow\.tsx$|^src\/mcp\/moduleOff\.ts$|^evals\/notes\/21-switched-off\.cjs$/, ['U154', 'U155', 'N21']],
  [/^src\/screens\/(DataTables|DataLayout|DataFilters|BulkEdit)\.tsx|^src\/domain\/(changeset|importer|export|sheets|format|formatDoc)\.ts|^src\/app\/(spreadsheet|files|zip)\.ts/, ['U19', 'U20', 'U21', 'U35', 'U45', 'U46', 'F7', 'F8', 'N5']],
  // The import's preview (IM3): its rules and its two checks.
  [/^src\/domain\/(changeset|sheets|leaveOut|workedOut|problemLevels)\.ts/, ['U87', 'U88', 'U89', 'U94', 'U98', 'F17', 'N18', 'P19']],
  [/^evals\/finish\/(17-import|18-import-design)\.cjs$/, ['F17', 'P19']],
  [/^src\/modules\/spreadsheets\//, ['P19']],
  // Large files (IM6): the worker, progress, Stop and the split.
  [/^src\/modules\/spreadsheets\/(checkRun|worker|workerInput|Large|importPlan|importStore)\.tsx?$|^src\/domain\/(splitFile|importLimits)\.ts$|^evals\/finish\/19-import-large\.cjs$/, ['U98', 'N18']],
  [/^src\/screens\/(Workspace|Settings|Onboarding|Start|Welcome|Feedback)\.tsx|^src\/app\/appearance\.ts|^src\/domain\/workspaceAttention\.ts/, ['U97', 'U5', 'U54', 'U11', 'U49', 'U14', 'U17', 'U22', 'U43', 'U51', 'U52', 'U53', 'U59', 'U60', 'U61', 'U62', 'U86', 'F7', 'F10', 'N4', 'N9', 'N10']],
  [/^src\/screens\/Activity\.tsx|^src\/domain\/activity\.ts/, ['U6', 'U35']],
  // People and Teams (app redesign WR1).
  [/^src\/screens\/People\.tsx|^src\/domain\/directory\.ts|^src\/styles\/notes\/people\.css/, ['U58', 'U60', 'U14', 'U43', 'U46', 'U51', 'U53', 'F7', 'F9', 'F10', 'N4', 'P6']],
  [/^evals\/finish\/10-people\.cjs$/, ['F10']],
  // The metric library (ML1): its two checks.
  [/^evals\/(finish\/15-metrics|notes\/16-metrics)\.cjs$/, ['F15', 'N16']],
  [/^evals\/notes\/29-readings\.cjs$/, ['N29']],
  // Small workspaces, rows and tabs that wait (SM1).
  [/^evals\/notes\/30-small-menu\.cjs$|^src\/domain\/(goalsPage|navigation)\.ts$/, ['N30']],
  [/^src\/screens\/Print\.tsx|^src\/domain\/onePager\.ts/, ['N6']],
  [/^src\/screens\/Research\.tsx|^src\/app\/research\.ts/, ['U28', 'U40']],
  [/^src\/screens\/Help\.tsx/, ['N7']],
  [/^src\/domain\/(removal|actions|asks|changes|people|goal|goalKey)\.ts/, ['U3', 'U8', 'U36', 'U37', 'U43', 'U44', 'U45', 'F9']],
  [/^src\/domain\/(numbers|thresholds)\.ts/, ['U1', 'U4', 'U30', 'U57', 'F2', 'F3', 'F9']],
  [/^src\/app\/(tours|drafts|goalSeen)\.ts/, ['U27', 'U29', 'U31', 'U1', 'U57']],
  [/^src\/data\/(rows|rpc)\.ts|^src\/adapters\/|^supabase\/migrations\//, ['U24', 'U40', 'U42', 'U47']],
  // Unit tests and scenarios run anyway; an F/N module is that check.
  [/\.test\.tsx?$|^evals\/[^/]+\.eval\.ts$|^evals\/vitest\.config\.ts$/, []],
  [/^evals\/(finish|notes)\/(\d)-/, (m) => [`${m[1] === 'finish' ? 'F' : 'N'}${m[2]}`]],
  [/^scripts\//, []],
];

/** What a set of changed files touches: { full, ids, unmatched, score }. ids: journey ids (U…) and check ids (F…, N…,
    P…). score: how directly the files name each id, for PR CI's cap (capJourneys): every rule a file matches gives each
    id it lists 1 ÷ how many ids it lists, so a file whose rule names one journey counts for that journey more than a
    file whose rule names twenty. */
function touches(files) {
  const ids = new Set();
  const score = new Map();
  const unmatched = [];
  let full = false;
  for (const f of files) {
    let hit = false;
    for (const [re, what] of RULES) {
      const m = re.exec(f);
      if (!m) continue;
      hit = true;
      const named = (typeof what === 'function' ? what(m) : what).filter((id) => id !== FULL);
      if ((typeof what === 'function' ? what(m) : what).includes(FULL)) full = true;
      for (const id of named) { ids.add(id); score.set(id, (score.get(id) ?? 0) + 1 / named.length); }
    }
    if (!hit) { if (/^(src|evals|server|api)\//.test(f)) { full = true; unmatched.push(f); } }
  }
  return { full, ids: [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), unmatched, score };
}

/** PR CI's cap (Lane, 14 Nov): at most this many journeys and checks together beyond the core ones; the rest wait for
    the full suite that runs after the merge, so a PR touching many files still finishes inside the job's 30 minutes.
    Checks count too (planning, 14 Nov, after #465's smoke job ran out of time on 31 journeys and 28 uncapped checks):
    a check runs about as long as a journey. */
const PR_JOURNEY_CAP = 25;

/**
 * The journeys and checks a pull request's CI runs: every core one (the smoke journeys and checks), then of the others
 * the `cap` the changed files name most directly (touches' score; ties by id, lowest first), journeys and checks ranked
 * together. Returns { run, left } in the order given, `left` (in id order) the ones the full suite after the merge
 * covers.
 */
function capJourneys(journeys, core, score, cap = PR_JOURNEY_CAP) {
  const byId = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  const rest = journeys.filter((id) => !core.includes(id));
  if (rest.length <= cap) return { run: [...journeys], left: [] };
  const ranked = [...rest].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || byId(a, b));
  const kept = new Set([...ranked.slice(0, cap), ...journeys.filter((id) => core.includes(id))]);
  return { run: journeys.filter((id) => kept.has(id)), left: rest.filter((id) => !kept.has(id)).sort(byId) };
}

/** The journeys about what is due, late or on time (FT1): CI's "Core journeys with no rhythm" (FARO_DEMO_RHYTHM=0)
    runs the smoke gate without them, since with no set rhythm nothing is due. U3, U49, U63 and U80 have a rhythm half
    and are left out whole until they split. */
const rhythm = ['U1', 'U2', 'U3', 'U8', 'U19', 'U33', 'U38', 'U49', 'U63', 'U80'];

module.exports = { touches, capJourneys, PR_JOURNEY_CAP, RULES, rhythm };
