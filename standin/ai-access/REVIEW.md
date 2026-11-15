# Review: stand-in stage 4, AI access (reviewer, copy in S/rev-ai-access, ports 43010-43040)

## Re-run (fresh clone, patch applied, npm ci)
- typecheck clean. npm test --testTimeout=60000: 202 files, 2,216 tests pass (matches).
- drill-faro 100%, contracts 56/56 (matches). prove-ai in: 38/38; prove.mjs core (in build): 36/36. Left out (STANDIN_WITHOUT incl. ai-access): prove-ai --without 8/8, prove 36/36. All match.
- git diff --numstat: 4 files +21 -2 (matches total). Small slips: package.json is +1 -1 (table says +2 -2), prove-ai.mjs is 222 lines (report ~240).

## 1. Platform is the stand-in: VERIFIED
No supabase/vercel in changed files or adapters. SQLite, server-side guard + store checks.
Probe over HTTP (S/rev-ai-access, own script, as member rhea; admin amara):
- Guarded (403): member makes a token via /tokens (self, for another, createdBy forged), via /commit (new row); revokes another's token (with or without a change entry, forged actor); renames or hands over a token; un-revokes; modulesOff; piggybacking a token revoke on other rows. Admin /tokens while off 403 with app words; /commit new token while off 403. MCP create/revoke_token while off: the module sentence. Member revoking own: 200.
- Store is a second line: with the guard's token block disabled, the store still refuses forge/rename/hand-over with 400 (revoke one at a time, on its own); a member revoking another's is refused by revokeToken. So the guard is partly redundant, not wrong.
- Quirk: guard's fixed-fields list omits lastUsedAt/tokenHash; a revoke carrying lastUsedAt=2000 returns 200 but the store ignores it (DB stays null). Harmless.
- Record kinds this module writes: tokens (all guarded), change-log entries (actor must be the signer), workspace modulesOff (admin only). Side-effect writes: lastUsedAt (server only), "via MCP" entries (server only). No forgeable kind found for this module.
- Inherited and NOT fixed: the core's hole (decisions, retros, watches, asks, reviews, feedback unguarded) is untouched; this stage does not claim otherwise.

## 3. Claims
(a) VERIFIED (5 files differ: 4 modified + prove-ai).
(b) VERIFIED; WEAK on the two line counts above.
(c)
- NAMED "Who writes tokens ... revoking has no row in r1's access table": WRONG. r1:97 has "Revoke an MCP token | An admin, or the token's person | revokeToken", and r1 rule 5 says "The token's person or an admin revokes it." Fix 3's first half is already in the kit.
- GAP "a token only changes by revoking": real (grep spec/ for "only revoked/never changed": nothing).
- PART "making refused on the server": real. Faro's okr_token_create (spec/core/schema.sql ~1347) checks only admin; module-platform.md:57 and stage-4 exits 4/8 say "refused as an action". VERIFIED.
- NAMED cites r1:21, module-platform.md:57, stage-4 exits 3/4/8, server/mcp.ts:94-98: right.
- "Left out vs off" gap 2: already stated in stage-4 Gaps (second bullet); report adds the no-screen consequence. Fine.
(d) numbers VERIFIED. U22/U62/U175 run in /demo (browser store): they prove nothing about HttpStore (same weakness as core).

## 4. Proofs
On: VERIFIED (38/38, I read the checks; tokens, door, read-backs, screens, persistence). Off: VERIFIED (POST /tokens 403, revoke works, door sentence, lastUsedAt unmoved). Left out: VERIFIED (53 core tools, /mcp open, no screens, set_feature rejects ai-access). Faro bug (Settings "On this page" link while off): real, Settings.tsx:102 SECTIONS is static.

## 5. Tests honest
Guard token block disabled: prove-ai exits 1, 5 R1 token checks FAIL (status 400 instead of 403, store's words). Honest. But npm test (standin.test.ts 29/29) still passes with it disabled: no token-guard unit test in the regular suite; prove-ai is not in npm test or CI.

## 6. One-line kit fixes
1. Settings.tsx:102 filter SECTIONS: not one line (SectionLinks takes no props; needs `on` passed in, about 3 lines) but right.
2. stage-4 exit 4 wording "refused by the server too": one line, sound. "add the check to okr_token_create in a migration" is a function rewrite, not one line.
3. r1:96 row: ALREADY EXISTS (WRONG). "A token is never changed, only revoked" in rule 5: sound, one line.
4. stage-4 gap 2 no-screen note: sound.

## Top real GAPs
1. Server must refuse making a token while off (spec says action-level only; Faro's DB function doesn't).
2. Spec silent that a token is immutable except revoke; a Store-level guard must derive it.
3. Settings section link not module-aware (Faro bug).
4. Token guard has no unit test in npm test.
