// The port contracts' shim: one JSON request per line in, one answer per line out.
import readline from 'node:readline';
import { Store } from './store.mjs';

let store = new Store();
const ops = {
  given: (g) => { store = new Store(); for (const { workspace, snapshot } of g?.workspaces || []) store.createWorkspace(workspace, snapshot); return null; },
  workspaces: () => store.workspaces(),
  createWorkspace: (w, s) => { store.createWorkspace(w, s); return null; },
  load: (id, win) => store.load(id, win),
  commit: (id, c) => { store.commit(id, c); return null; },
  issueToken: (id, c) => store.issueToken(id, c),
  deleteWorkspace: (id) => { store.deleteWorkspace(id); return null; },
  history: (id, o) => store.history(id, o),
};
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let out;
  try {
    const { port, op, args = [] } = JSON.parse(line);
    if (port !== 'store' || !ops[op]) throw new Error(`No ${port}.${op} here.`);
    const ok = ops[op](...args);
    out = { ok: ok === undefined ? null : ok };
  } catch (e) { out = { error: String(e.message || e) }; }
  process.stdout.write(JSON.stringify(out) + '\n');
});
