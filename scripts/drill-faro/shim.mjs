/* Faro's own ports behind the port contracts' shim (spec/conformance/contracts/README.md), to prove the harness: every
   case must pass. It answers with src/adapters/contractPorts.ts, the same ports parts.test.ts runs the contracts on.
   One JSON request per line on stdin, one answer per line on stdout. */
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { faroCaller } = await server.ssrLoadModule('/src/adapters/contractPorts.ts');
  const call = faroCaller();
  for await (const line of readline.createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    let answer;
    try { answer = await call(JSON.parse(line)); } catch (e) { answer = { error: `not a request: ${e.message}` }; }
    process.stdout.write(JSON.stringify(answer) + '\n');
  }
} finally {
  await server.close();
}
