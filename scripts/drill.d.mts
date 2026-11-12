/* Types for the parts of the drill harness (drill.mjs) that the vitest contracts share: the port contracts' checks. */
import type { Contract, Then } from '../src/ports/contracts/cases/format';

export type Outcome = { ok: unknown } | { error: string };
export interface Request { port: string; op: string; args: unknown[] }
export interface CaseResult { name: string; pass: boolean; problems: string[] }
export function sameJson(a: unknown, b: unknown): boolean;
export function selectPath(path: string, value: unknown): unknown;
export function checkThen(t: Then, outcome: Outcome): string[];
export function runContract(contract: Contract, call: (req: Request) => Promise<Outcome>, only?: string[] | null): Promise<CaseResult[]>;
export function contractReport(contracts: { contract: string; cases: CaseResult[] }[], diffs?: number): string;
