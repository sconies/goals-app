/* The MCP server's failures, written where the platform keeps a function's logs (standard error), each with a
   reference the caller is given, so a failure reported by someone can be found (backlog AX10; review finding 9).
   The internal platform's own logging replaces this (spec/requirements/internal, observability). */

/** Writes the failure to standard error and returns its reference. Never throws. */
export function logFailure(where: string, e: unknown): string {
  const reference = `err_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try { console.error(`[faro mcp] ${where} failed (${reference}):`, e instanceof Error ? (e.stack ?? e.message) : e); } catch { /* nowhere to write */ }
  return reference;
}
