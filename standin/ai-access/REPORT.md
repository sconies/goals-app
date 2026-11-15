# Stand-in rebuild: stage 4, AI access (drill item 11)
(Saved by the drill session from the builder's reply; the builder's tool could not write report files.)

Core stand-in (tag `core-standin`) with AI access built in. `npm run build:standin` leaves out the other modules; `STANDIN_WITHOUT` changes the list. Proofs: `node platform/prove-ai.mjs [port]` (module in, 38 checks), `--without` (left out, 8), `node platform/prove.mjs` (core, 36, either build).

## (a) Ported as-is
2,319 of 2,324 files unchanged from the core stand-in: src/modules/ai-access/* (module.json, tools.ts list/create/revoke_token, help, app), src/ui/AiAssistants.tsx and the Workspace, Settings, People places, src/domain/switchOff.ts read-backs, src/domain/actions.ts createToken/revokeToken, src/app/actions.ts switched-action gate, src/app/reads.ts aiAccessOn and sentences, the door in server/mcp.ts. The core stand-in already ported the token store (okr_token_create/revoke/find/touch, okr_api_tokens) and Deps.modulesOff, because tokens are the core's (stage gap 1). No new migration.

## (b) Rewired (`git diff --stat core-standin`: 4 files, +21 −2, plus prove-ai.mjs ~240 lines)
| Area | File | Lines | Why |
|---|---|---|---|
| Build | package.json | +2 −2 | ai-access out of FARO_WITHOUT; list from STANDIN_WITHOUT |
| Server access: making a token | platform/server.ts | +6 | POST /tokens refused "AI access is off in {workspace}." while off (exits 4, 8). Faro refuses only in the browser action; its okr_token_create doesn't check modules_off. |
| Server access: tokens via /commit | src/adapters/standin/guard.ts | +11 | Refuses a new token in a save ("Only admins can make tokens, with Make an MCP token."), any change but revoking ("A token can only be revoked, not changed."), a member revoking another's ("Only an admin or the token's person can revoke it."). Revoking while off allowed. |
| Proof | platform/prove.mjs | +3 −1 | tool list expects token tools when built in |

grep -ri supabase over changed files: nothing.

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Secret made on the server, shown once, hash kept, person's rights, logged via MCP | NAMED | R1 rule 5 (r1:21); MCP-TOKENS, TOKENS-SERVER-ONLY |
| Who writes tokens: admins make, person or admin revokes | NAMED | r1:21, r1:96 (Make an MCP token: Admins); revoking has no row in r1's access table |
| Who may change a token's other fields through a save | GAP | nothing says a token only changes by revoking; Faro gets it implicitly from TOKENS-SERVER-ONLY |
| modulesOff on every request | NAMED | stage-4 entry 1–2; Deps.modulesOff (server/mcp.ts:47) |
| Making refused while off, on the server | PART (GAP: where) | stage-4 exits 4, 8, module-platform.md:57 say refused as an action; nothing says the server must; Faro's okr_token_create doesn't |
| Revoking while off | NAMED | module-platform.md:57 |
| The door while off | NAMED | stage-4 exit 3; server/mcp.ts:94-98 |
| Left out vs off | NAMED, tension | gap 2: left out, tokens stay core and /mcp open, but no screen makes a token |
| Files, jobs | not needed | |

## (d) Behaviour
- typecheck passes. npm test 202 files, 2,216 tests: 4 timed out at 5 s under machine load (load 17 on 4 CPUs from parallel drill sessions); rerun alone with --testTimeout=60000 all pass; guard tests pass.
- drill-faro 100% (462,003 cells), contracts 56/56; stand-in shim 56/56. No module contract or conformance rows (stage gap 3).
- Module in: prove-ai 38/38, core prove 36/36. Left out: prove-ai --without 8/8, core prove 36/36 (/mcp 53 core tools, no token tools, no screens or Features line).

| Exit criterion | Status | Evidence |
|---|---|---|
| 1 MCP-TOKENS, TOKENS-SERVER-ONLY, AI-ACCESS-OPTIONAL | MET | admin makes a token, secret once, SQLite holds a 64-char hash only; member sees own tokens; token has its person's rights; "Via MCP" logged; R1 via /commit as a member: forge, revoke another's, rename, hand over, un-revoke all 403; revoke own allowed |
| 2 Journeys U22, U62, U175 | MET (in /demo) | U22, U62 10/10 with Feedback out; U175 0/10 with Feedback out (needs Feedback's inbox, stage gap 4), 10/10 with it in; journeys use the browser store |
| 3 The door while off | MET | exact sentence; initialize and tools/list answer; lastUsedAt unchanged |
| 4 Off: making refused, revoking works | MET | POST /tokens 403; revoke 200 |
| 5 Off: screens | MET | /workspace/ai not found + sentence; no menu link; no Settings heading; no Make an MCP token. Faro bug: Settings' "On this page" still links "Your MCP tokens" while off |
| 6 Read-backs | MET | on/off read-backs name the right tokens and counts; switch in SQLite, logged; member 403 |
| 7 set_feature's last words | MET | exact sentence |
| 8 Revoke while off; making refused | MET | as 4 |

## One-line kit fixes
- src/screens/Settings.tsx:102: filter SECTIONS by aiAccessOn(on); U175 should check .section-links.
- stage-4 exit 4: "refused by the server too, not only the app"; add the check to okr_token_create in a migration.
- r1:96: row "Revoke an MCP token | Its person or an admin | revokeToken"; rule 5: "A token is never changed, only revoked."
- stage-4 gap 2: a core-only build has no screen to make a token.
