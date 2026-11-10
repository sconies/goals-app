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
  [/^src\/screens\/Home\.tsx|^src\/domain\/(home|attention)\.ts/, ['U2', 'U16', 'U33', 'F1', 'N3', 'N6', 'N10', 'P6']],
  // The talk-path polish (N10): its own check, and the screens it looks at.
  [/^evals\/notes\/10-talk-polish\.cjs$/, ['N10']],
  [/^src\/screens\/Watching\.tsx/, ['U8', 'U9', 'F1']],
  [/^src\/screens\/(CheckInFlow|QuickCheckIn)\.tsx|^src\/domain\/checkin\.ts/, ['U1', 'U54', 'U15', 'U21', 'U25', 'U30', 'U31', 'U37', 'U39', 'U40', 'U45', 'U57', 'F2', 'F9', 'N8']],
  [/^src\/screens\/(GoalWizard|GoalEdit)\.tsx|^src\/domain\/templates\.ts/, ['U4', 'U54', 'U18', 'U25', 'F3', 'F9']],
  [/^src\/screens\/(GoalScreen|Inspect|Respond)\.tsx|^src\/domain\/(goalPage|scorecard|story|chartStory|summary|summaryFacts|progress|trend)\.ts/, ['U6', 'U7', 'U36', 'U37', 'U38', 'U39', 'U57', 'U77', 'U78', 'U79', 'F4', 'F14', 'N2', 'N9', 'N6', 'N15']],
  [/^src\/ui\/(NextStepSheet|PersonPick)\.tsx|^evals\/(finish\/10-goal-order|notes\/11-said-once)\.cjs$/, ['U3', 'U77', 'U78', 'F14', 'N15']],
  [/^src\/screens\/(GoalsScreen|GoalViews|GoalTable|GoalBoard|GoalFilters|GoalHistory)\.tsx|^src\/ui\/HealthLine\.tsx|^src\/domain\/(query|tableFilter|tableLayout|columns|order)\.ts/, ['U19', 'U23', 'U32', 'U34', 'F5', 'N5', 'N6', 'N10']],
  [/^src\/screens\/GoalMap\.tsx|^src\/domain\/(map|tree)\.ts/, ['U26', 'U30', 'U34', 'F6']],
  [/^src\/screens\/(Review|Retro)\.tsx|^src\/domain\/review\.ts/, ['U3', 'U10', 'U13', 'U36', 'F6', 'N1']],
  [/^src\/screens\/(DataTables|DataLayout|DataFilters|BulkEdit)\.tsx|^src\/domain\/(changeset|importer|export|sheets|format|formatDoc)\.ts|^src\/app\/(spreadsheet|files|zip)\.ts/, ['U19', 'U20', 'U21', 'U35', 'U45', 'U46', 'F7', 'F8', 'N5']],
  [/^src\/screens\/(Workspace|Settings|Onboarding|Start|Feedback)\.tsx|^src\/app\/appearance\.ts|^src\/domain\/workspaceAttention\.ts/, ['U5', 'U54', 'U11', 'U49', 'U14', 'U17', 'U22', 'U43', 'U51', 'U52', 'U53', 'U59', 'U60', 'U61', 'U62', 'F7', 'F10', 'N4', 'N9', 'N10']],
  [/^src\/screens\/Activity\.tsx|^src\/domain\/activity\.ts/, ['U6', 'U35']],
  // People and Teams (app redesign WR1).
  [/^src\/screens\/People\.tsx|^src\/domain\/directory\.ts|^src\/styles\/notes\/people\.css/, ['U58', 'U60', 'U14', 'U43', 'U46', 'U51', 'U53', 'F7', 'F9', 'F10', 'N4', 'P6']],
  [/^evals\/finish\/10-people\.cjs$/, ['F10']],
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

/** What a set of changed files touches: { full, ids, unmatched }. ids: journey ids (U…) and check ids (F…, N…, P…). */
function touches(files) {
  const ids = new Set();
  const unmatched = [];
  let full = false;
  for (const f of files) {
    let hit = false;
    for (const [re, what] of RULES) {
      const m = re.exec(f);
      if (!m) continue;
      hit = true;
      for (const id of typeof what === 'function' ? what(m) : what) { if (id === FULL) full = true; else ids.add(id); }
    }
    if (!hit) { if (/^(src|evals|server|api)\//.test(f)) { full = true; unmatched.push(f); } }
  }
  return { full, ids: [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), unmatched };
}

module.exports = { touches, RULES };
