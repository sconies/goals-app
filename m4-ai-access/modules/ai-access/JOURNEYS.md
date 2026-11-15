# AI access's journeys, tallied

Scripted in Playwright on a phone (390×844) and a desktop (1440×900): `node modules/ai-access/journeys.cjs http://localhost:4173` against `node app/server.mjs 4173`. Each run starts from `/__reset`. Exit test 2 runs the same script.

**3 journeys: DONE 0 · PART 3 · NOT BUILT 0.** Every step and check of each holds except the ones below, which the kit's demo workspace or another module stands in the way of.

| Id | Tally | Steps (phone, desktop / budget) | What doesn't hold, and why |
|---|---|---|---|
| U22 | PART | 5, 5 / 10 | Everything holds (make for Mateo by search, “Make the token” disabled until it says what it's for, “it isn’t shown again”, token and `claude mcp add` command, stored as a hash, “not used yet”, Revoke, “Revoked”). Not provable: “labels the builder token apart”. Builder tokens are made only by the builders' inbox (Feedback, okr_builder_token_create) and the kit's workspace has none; the row has the label (`builder: true` → “Builder token, made before the inbox opened”), never shown. The journey starts “in the real app”; this rebuild has one mode, so tokens work in the demo too. |
| U62 | PART | 2, 2 / 6 | Your page in view and opens /people/rhea; no Make for tokens; Recording leads to Privacy; Leave asks who takes over; Escape closes it; Workspace has no Leave. Fails: “the only admin is told why not”: the journey stays as Rhea, who is no admin in the kit's workspace (Amara, Grace and Hamid are). The rule is built (only admin → disabled, “You’re the only admin. Make someone else an admin first…”) but unproven. |
| U175 | PART | 2, 2 / 12 | On: its own section after Access; Features' tick box in view, under Beyond this workspace; with no token switching off acts at once (“AI access is off in …”); Access is the admins only; Workspace's menu has no AI access; /workspace/ai is Page not found and says it is switched off; Settings has no “Your MCP tokens”; the switch is logged; back on, all return. Not built: the inbox's Connect Claude (`/feedback` `#inbox`) is the Feedback module's (stage 5), not in this build. |
