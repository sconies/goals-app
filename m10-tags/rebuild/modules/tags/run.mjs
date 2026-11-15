// The drill's command with Fields in: the core's main.mjs, then Fields' own conformance file (tags.csv).
// Usage: node modules/tags/run.mjs <workspace.json> <out folder>
await import('../../main.mjs');
const { writeTagsCsv } = await import('./conformance.mjs');
writeTagsCsv(process.argv[3]);
