/* Types for the seed generator (seed.mjs) that src/spec/seed.test.ts uses. */
export const COMPANY_GOALS: number;
export const KINDS: string[];
export function defaultSource(): string;
export function copyOf(w: unknown, n: number): Map<string, { id: string; [k: string]: unknown }[]>;
export function copiesFor(w: { goals: unknown[] }, goals?: number): number;
export interface Seed { about: string; builtFor: string; copies: number; cycle: unknown; counts: Record<string, number>; sha256: Record<string, string> }
export function writeSeed(w: unknown, dir: string, copies?: number): Seed;
