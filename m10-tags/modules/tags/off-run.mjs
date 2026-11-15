// Runs the core drill's command on the workspace it is given with Fields switched off (modulesOff: ["tags"]), so the
// harness scores stages 1 to 3 with the module off. Used by drill-off.json: node modules/tags/off-run.mjs <ws> <out>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const [, , ws, out] = process.argv;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tags-off-'));
const W = JSON.parse(fs.readFileSync(ws, 'utf8'));
W.modulesOff = [...new Set([...(W.modulesOff || []), 'tags'])];
fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify(W));
for (const f of fs.readdirSync(path.dirname(ws))) if (f !== 'workspace.json') fs.copyFileSync(path.join(path.dirname(ws), f), path.join(dir, f));
const r = spawnSync(process.execPath, ['main.mjs', path.join(dir, 'workspace.json'), out], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
process.exit(r.status ?? 1);
