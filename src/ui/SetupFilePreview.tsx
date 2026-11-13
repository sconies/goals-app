/* Set-up's preview of a spreadsheet (IM8; import spec 2.3 in create mode; set-up spec SETUP-UPLOAD): what the file would
   add, then what must be fixed, then the questions, with the same group blocks and answers as the import's preview.
   Every row is new, so an owner the People sheet lacks is answered with "Add {person}" or "Give it to someone here",
   and stages already due are counted from this week unless changed. Nothing is saved until "Create workspace".
   Loaded only when set-up reads a spreadsheet, so it costs the first download nothing. */
import type { Answer, Issue, IssueGroup as Group } from '../domain/problemLevels';
import { questionsLine } from '../domain/problemLevels';
import { Answered, IssueGroup, type Given } from './IssueGroup';
import type { PickSource } from './Pick';

const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;
const rowKey = (x: { sheet: string; row: number }) => `${x.sheet}:${x.row}`;

export interface SetupFilePreviewProps {
  name: string;
  goals: number;
  people: number;
  /** The engine's groups, notes left out. */
  groups: readonly Group[];
  issues: readonly Issue[];
  answers: Record<string, Answer>;
  said: Record<string, { title: string; label: string; level: 'must' | 'check' }>;
  onAnswer: (g: Group, given: Given) => void;
  onClear: (id: string) => void;
  source: PickSource;
  valueOf: (kind: 'team' | 'person' | 'goal', id: string) => string;
}

export function SetupFilePreview(p: SetupFilePreviewProps) {
  const must = p.groups.filter((g) => g.level === 'must');
  const checks = p.groups.filter((g) => g.level === 'check');
  const answered = Object.keys(p.answers).filter((id) => p.said[id] && !p.groups.some((g) => g.id === id));
  const mustRows = new Set(p.issues.filter((i) => i.level === 'must').map(rowKey)).size;
  const held = new Set(p.issues.filter((i) => i.level === 'must' && i.sheet === 'Goals').map(rowKey)).size;
  const block = (g: Group) => <IssueGroup key={g.id} g={g} rows={p.issues.filter((i) => i.group === g.id)} prior={p.answers[g.id]} source={p.source} valueOf={p.valueOf} onAnswer={(x) => p.onAnswer(g, x)} />;
  const line = (id: string) => <Answered key={id} id={id} title={p.said[id]!.title} label={p.said[id]!.label} onChange={() => p.onClear(id)} />;
  return (
    <section className="stack setup-file" aria-labelledby="setup-file">
      <h2 className="h2" id="setup-file">From {p.name}</h2>
      {/* Counts never leave a wrong row out (SETUP-UPLOAD): a goal stopped by a Must fix is counted, and said. */}
      <p>{n(p.goals + held, 'goal')} and {n(p.people, 'person', 'people')} would be added{held ? `, once ${held === 1 ? 'the goal' : `the ${held} goals`} below ${held === 1 ? 'is' : 'are'} settled` : ''}. Nothing has been saved.</p>
      {must.length > 0 && (
        <section className="stack import-section" aria-labelledby="setup-must">
          <h3 className="h3" id="setup-must">Must fix</h3>
          <p className="hint">{n(mustRows, 'row')}, {n(new Set(must.map((g) => g.kind)).size, 'kind')} of problem. Answer here, or fix the file and upload it again on the people step.</p>
          {must.map(block)}
        </section>
      )}
      {(checks.length > 0 || answered.some((id) => p.said[id]!.level === 'check')) && (
        <section className="stack import-section" aria-labelledby="setup-checks">
          <h3 className="h3" id="setup-checks">Check</h3>
          {checks.length > 0 && <p className="hint">{questionsLine(checks)}.</p>}
          {checks.map(block)}
        </section>
      )}
      {answered.map(line)}
    </section>
  );
}
