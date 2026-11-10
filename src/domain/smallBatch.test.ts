// @vitest-environment node
/* The small batch of 10 Nov (backlog 0u, 10a and the 8 Nov admin/member notes): who sees what on Recently removed, the
   one "via MCP" mark (old changes still count), and builder tokens told apart. */
import { describe, expect, it } from 'vitest';
import { tokenFromRow, tokenToRow } from '../data/rows';
import { kindOf } from './activity';
import { VIA_LABEL, VIA_MCP, VIA_MCP_BEFORE } from './changeset';
import { canRestore } from './removal';
import type { Change } from './types';

describe('Recently removed: an admin sees everything, anyone else their own (8 Nov)', () => {
  it('lets an admin restore anything and anyone else only what they removed', () => {
    expect(canRestore({ id: 'grace', admin: true }, { by: 'oskar' })).toBe(true);
    expect(canRestore({ id: 'oskar', admin: false }, { by: 'oskar' })).toBe(true);
    expect(canRestore({ id: 'oskar', admin: false }, { by: 'maya' })).toBe(false);
    expect(canRestore({ id: 'oskar' }, { by: null })).toBe(false);
  });
});

describe('via MCP (backlog 10a)', () => {
  const change = (to: string): Change => ({ id: 'c', at: '2026-11-09T12:00:00Z', actorId: 'oskar', goalId: 'g', entity: 'check-in', entityId: 'ci', action: 'created', summary: 'Checked in', diffs: [{ field: 'Via', from: '—', to }] });
  it('marks a change through MCP “MCP”, said “via MCP”', () => {
    expect(VIA_LABEL.mcp).toBe('MCP');
    expect(VIA_MCP).toEqual({ field: 'Via', from: '—', to: 'MCP' });
  });
  it('counts a change marked the old way as made through MCP too', () => {
    expect(kindOf(change('MCP'))).toBe('ai');
    expect(kindOf(change(VIA_MCP_BEFORE))).toBe('ai');
    expect(kindOf(change('Spreadsheet'))).not.toBe('ai');
  });
});

describe('builder tokens told apart (backlog 10a)', () => {
  const row = { workspace_id: 'ws', id: 'tok_1', person_id: 'grace', name: 'Inbox', created_by: 'grace', created_at: '2026-11-01T09:00:00Z', last_used_at: null, revoked_at: null };
  it('reads which tokens were made as builder tokens, and never writes it back', () => {
    expect(tokenFromRow({ ...row, builder: true }).builder).toBe(true);
    expect(tokenFromRow({ ...row, builder: false }).builder).toBeUndefined();
    expect(tokenFromRow(row).builder).toBeUndefined();
    expect('builder' in tokenToRow('ws', tokenFromRow({ ...row, builder: true }))).toBe(false);
  });
});
