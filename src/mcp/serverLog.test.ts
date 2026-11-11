/* The MCP server writes a failure to standard error and gives the caller a reference to quote (backlog AX10). */
import { logFailure } from '../../server/log';

describe('the MCP server’s failures', () => {
  it('are written to standard error with a reference, which is what the caller is given', () => {
    const seen: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { seen.push(a); });
    try {
      const ref = logFailure('A request', new Error('The database did not answer in time.'));
      expect(ref).toMatch(/^err_[a-z0-9]+$/);
      expect(String(seen[0]![0])).toContain(ref);
      expect(String(seen[0]![1])).toContain('The database did not answer in time.');
      expect(logFailure('A request', 'x')).not.toBe(ref);
    } finally { spy.mockRestore(); }
  });
});
