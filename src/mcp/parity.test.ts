// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS, SCREENS } from './parity';
import { TOOLS } from './tools';

const root = path.join(__dirname, '..', '..');
const names = new Set(TOOLS.map((t) => t.name));

describe('Every action a person can take, their AI assistant can take too', () => {
  it('maps every action in AppState to MCP tools, or says why an assistant has no need of it', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/state.tsx'), 'utf8');
    const body = src.slice(src.indexOf('export interface AppState {'), src.indexOf('\n}', src.indexOf('export interface AppState {')));
    // The members that change something: they return a promise, change who or where you are, or (previewChanges) give a change set to apply. Showing a message is not an action.
    const actions = [...body.matchAll(/^ {2}(\w+)\(.*\): (Promise<[^>]*>|ChangeSet|void);$/gm)].map((m) => m[1]!).filter((n) => n !== 'toast');
    expect(actions.length).toBeGreaterThan(20);
    expect(actions.filter((a) => !(a in ACTIONS))).toEqual([]);
  });

  it('maps every screen to the tools that read or do what it shows', () => {
    const screens = fs.readdirSync(path.join(root, 'src/screens')).filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
    expect(screens.filter((s) => !(s in SCREENS))).toEqual([]);
  });

  it('names only tools that exist, and every tool has a description and an object schema', () => {
    const named = [...Object.values(ACTIONS), ...Object.values(SCREENS)].flatMap((e) => (Array.isArray(e) ? e : []));
    expect(named.filter((n) => !names.has(n))).toEqual([]);
    for (const t of TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(30);
      expect(t.inputSchema.type).toBe('object');
    }
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
  });
});
