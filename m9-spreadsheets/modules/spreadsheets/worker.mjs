// A large file's check, off the server's main thread: it says how far it has got.
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { file, data, moment, viewer, wsPath } = workerData;
const say = (text, done = false) => parentPort.postMessage({ text, done });
const { readFile, readTables, run, groups } = await import('./importer.mjs');
const { load } = await import('../../s1.mjs');
const { makeRules } = await import('../../stage3.mjs');
say(`Reading ${file}: opening the file…`);
const rt = readTables(readFile(Buffer.from(data, 'base64'), file), { fileName: file });
say(`Reading ${file}: ${rt.rows.toLocaleString('en-GB')} rows read from ${rt.read.join(', ') || 'no Faro sheet'}. Checking them against the rules…`);
const { S1 } = await load(wsPath);
const res = run({ S1, W: S1.W, viewer, moment }, rt, {});
const gs = groups(res, rt);
const must = gs.filter((g) => g.level === 'must').length, q = gs.filter((g) => g.level === 'check').length;
say(`Reading ${file}: checked. ${res.items.length.toLocaleString('en-GB')} changes so far, ${must} kinds of problem to fix and ${q} questions.`, true);
