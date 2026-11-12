/* Where a change came from, as the change log marks it ("Via": a spreadsheet, a bulk edit, MCP …), and the names of
   what a new workspace starts with. Small and separate from the change engine (changeset.ts), so a screen that only
   names them doesn't load the engine with the first download. */

export type Via = 'spreadsheet' | 'bulk' | 'mcp' | 'table' | 'setup' | 'form';
/** `form` is the check-in screens' own post (CK1): it is no import, so its changes carry no Via mark. */
export const VIA_LABEL: Record<Via, string> = { spreadsheet: 'Spreadsheet', bulk: 'Bulk edit', mcp: 'MCP', table: 'Data tables', setup: 'Set-up', form: 'Check-in' };
/** What changes through MCP were marked before backlog 10a (9 Nov): still read as MCP, never written. */
export const VIA_MCP_BEFORE = 'AI assistant (MCP)';
/** The Via mark every change through MCP carries ("via MCP"), on top of its own diffs. */
export const VIA_MCP = { field: 'Via', from: '—', to: VIA_LABEL.mcp } as const;

/** The review every new workspace starts with. */
export const WEEKLY_REVIEW = 'Weekly review';
/** A person's initials from their name: up to two, or "?". */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('') || '?';
