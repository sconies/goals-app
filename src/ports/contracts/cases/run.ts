/* Runs a contract's cases (cases/format.ts) on a build's ports, with the drill harness's own checks (scripts/drill.mjs,
   `runContract`), so vitest and the drill judge a case the same way. `caller` is also what Faro's shim answers with
   (scripts/drill-faro/shim.mjs, src/adapters/contractPorts.ts). */
import { runContract, type Outcome, type Request } from '../../../../scripts/drill.mjs';
import type { Contract } from './format';

/** One port, opened for a case: `op` names the operation, `args` its arguments. */
export type Port = (op: string, args: unknown[]) => unknown;
/** Opens a fresh port from a case's `given`. */
export type Start = (given: unknown) => Port | Promise<Port>;

/** A port object's methods as a Port. */
export const methods = (o: object): Port => (op, args) => {
  const f = (o as Record<string, unknown>)[op];
  if (typeof f !== 'function') throw new Error(`No operation “${op}”.`);
  return (f as (...a: unknown[]) => unknown).apply(o, args);
};

/** Answers a shim's requests ({ port, op, args }) over these ports: `given` opens a fresh one, the rest go to it. Answers
    are what JSON carries (undefined left out), as a shim's would be. */
export function caller(starts: Record<string, Start>) {
  const open: Record<string, Port> = {};
  return async (req: Request): Promise<Outcome> => {
    try {
      if (req.op === 'given') {
        const start = starts[req.port];
        if (!start) throw new Error(`No port “${req.port}” here.`);
        open[req.port] = await start(req.args[0]);
        return { ok: null };
      }
      const port = open[req.port];
      if (!port) throw new Error(`Send “given” for ${req.port} first.`);
      const v = await port(req.op, req.args ?? []);
      return { ok: v === undefined ? null : JSON.parse(JSON.stringify(v)) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };
}

/** The contract as a vitest suite: one test per case. */
export function contractSuite(contract: Contract, name: string, start: Start) {
  describe(`the ${contract.port} contract: ${name}`, () => {
    const call = caller({ [contract.port]: start });
    for (const c of contract.cases) {
      it(c.name, async () => {
        const [r] = await runContract({ ...contract, cases: [c] }, call);
        expect(r!.problems).toEqual([]);
      }, 60_000);
    }
  });
}
