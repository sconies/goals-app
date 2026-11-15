// The drill's command with the metric library built in: the core's main.mjs writes its stages' files, then the
// module writes metrics.csv from the same workspace. Usage: node modules/metrics/drill.mjs <workspace.json> <out folder>
import fs from 'node:fs';
import { makeS1 } from '../../rules.mjs';
import { writeMetricsCsv } from './conformance.mjs';
await import('../../main.mjs');
const [, , wsPath, outDir] = process.argv;
const W = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
if (W.modules && W.modules.metrics) writeMetricsCsv({ W, S1: makeS1(W) }, outDir);
