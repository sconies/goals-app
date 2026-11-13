// @vitest-environment node
import { screenFiles } from '../core/sources';
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS, SCREENS } from './parity';
import { ACTIONS as TABLE, MODULE_ACTIONS } from '../app/actions';
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

  it('maps every action the dispatcher runs (app/actions.ts) to MCP tools, or says why it is app-only', () => {
    // The core's table, so the spec's “AI tools that do the same” (spec/core/actions.md) is backed: every action has a
    // tool doing the same, or a reason it is deliberately app-only. (A module's actions carry their own tools.)
    for (const name of Object.keys(TABLE)) {
      const e = ACTIONS[name];
      expect(e, name).toBeDefined();
      if (Array.isArray(e!)) { expect(e.length, name).toBeGreaterThan(0); expect(e.filter((t) => !names.has(t)), name).toEqual([]); }
      else expect((e as { notForAssistants: string }).notForAssistants.length, name).toBeGreaterThan(20);
    }
  });

  it('maps every feature module’s action (run through app.run) to MCP tools that exist', () => {
    expect(Object.keys(MODULE_ACTIONS).length).toBeGreaterThan(0);
    for (const [name, a] of Object.entries(MODULE_ACTIONS)) {
      expect(a.tools.length, name).toBeGreaterThan(0);
      expect(a.tools.filter((t) => !names.has(t)), name).toEqual([]);
    }
  });

  it('maps every screen to the tools that read or do what it shows', () => {
    // src/screens, and each module's screens (src/core/sources.ts).
    const screens = screenFiles(root).map((f) => f.name);
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
