/* The actions and the AI tools as contracts (kit review, 12 Nov, gap 4): every action's input, result, who may and
   refusals, and every tool's schema, what it gives back and its refusals, are on their pages, read from the code. */
import fs from 'node:fs';
import path from 'node:path';
import { actionFacts, actionsPage, toolFacts, toolsPage } from './calls';
import { actionNames } from '../app/actions';
import { TOOLS, toolModule } from '../mcp/tools';
import { systemOverview } from './overview';

const root = path.resolve(__dirname, '../..');
const r = { root };

describe('the actions and the AI tools, as contracts', () => {
  const actions = actionFacts(r);
  const page = actionsPage(r, '');

  it('lists every action the dispatcher runs, the core’s and the modules’', () => {
    expect(actions.map((a) => a.name).sort()).toEqual(actionNames().sort());
    for (const a of actions) expect(page, a.name).toContain(`## ${a.name}\n`);
  });

  it('says who may run every action, from R1’s access table', () => {
    expect(actions.filter((a) => !a.who.length).map((a) => a.name)).toEqual([]);
  });

  it('reads each action’s input and result from its types, and its refusals from its rule', () => {
    const answer = actions.find((a) => a.name === 'answerRequest')!;
    expect(answer.input.map((i) => i.name)).toEqual(['askId', 'answer']);
    expect(answer.result).toBe('Commit');
    expect(answer.refuses).toContain('Write the answer.');
    expect(answer.refuses).toContain('Only … or an admin can answer it.');
    expect(actions.find((a) => a.name === 'saveMetric')!.module).toBe('metrics');
    // Every type an input or result names is defined: in the data model or on the page.
    for (const t of ['SaveGoalInput', 'GoalDraft', 'ChangeSet', 'Commit', 'CheckInPost', 'Draft']) expect(page, t).toContain(`### ${t}\n`);
  });

  it('gives every tool its schema, what it gives back and its refusals', () => {
    const tools = toolFacts(r, TOOLS);
    expect(tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    const tp = toolsPage(r, TOOLS, toolModule, '');
    for (const t of TOOLS) expect(tp, t.name).toContain(`## ${t.name}\n`);
    expect(tools.find((t) => t.name === 'create_token')!.data.join()).toContain('token: string');
    expect(tools.find((t) => t.name === 'post_check_in')!.actions).toContain('postCheckIn');
    expect(tools.find((t) => t.name === 'get_help')!.refuses.some((s) => s.startsWith('There’s no help article with id'))).toBe(true);
  });

  it('writes no machine’s paths into a type, and is linked from the README and llms.txt', () => {
    for (const f of ['spec/core/actions.md', 'spec/core/tools.md']) expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toContain('import("');
    const readme = fs.readFileSync(path.join(root, 'spec/README.md'), 'utf8');
    for (const p of ['core/actions.md', 'core/tools.md']) { expect(readme).toContain(p); expect(systemOverview()).toContain(p); }
  });
});
