// Scores tags.csv with the drill harness's own scoring (spec/rebuild/drill.mjs scoreAll and report). The harness's
// command line refuses --files tags and drill.json's also: ["tags"] (it isn't in its ALSO list): GAPS T-1.
// node modules/tags/score.mjs [--diffs n]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(here, '../../../spec');
const { parseCsv, scoreAll, report } = await import(path.join(kit, 'rebuild/drill.mjs'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tags-'));
execFileSync(process.execPath, [path.join(here, 'conformance.mjs'), out]);
const score = scoreAll({ tags: parseCsv(fs.readFileSync(path.join(kit, 'conformance/tags.csv'), 'utf8')) }, { tags: parseCsv(fs.readFileSync(path.join(out, 'tags.csv'), 'utf8')) }, ['tags']);
const i = process.argv.indexOf('--diffs');
console.log(report(score, { diffs: i > 0 ? Number(process.argv[i + 1]) : 10 }));
fs.rmSync(out, { recursive: true, force: true });
process.exitCode = score.pass ? 0 : 1;
