/* The Platform Engineering example: one division of about 100 people with 12 north stars, a year of history, in Q4.
   A demo example alongside the others (pick it under Other example companies, or open /demo?example=platform-org);
   not the default. Built to find where the app breaks at the size of a real organisation.

   The people who play the main example's parts (for rewriting the walkthroughs and evals by swapping names):

   | Main example | Here   | Why                                                                                      |
   |--------------|--------|------------------------------------------------------------------------------------------|
   | elena        | amara  | VP Platform Engineering: runs the leadership weekly and the QBR, watches the north stars, admin, owns no goals |
   | maya         | rhea   | Owns the lead time north star (off track, the merge queue on its critical path) and 8 goals in all; watches a tree with a goal gone quiet |
   | tom          | oskar  | Engineer who watches three goals and owns none                                            |
   | sam          | tariq  | Raised a too-easy target after check-ins began (AI-assisted review, 60% to 80%)           |
   | kofi         | mateo  | Loaded his first nine weeks of numbers from a spreadsheet (backfilled check-ins)          |
   | priya        | grace  | Engineering operations admin: pinned views, assistant tokens, people and settings         |
   | jonas        | bjorn  | Owns the cost north star, re-planned in week 27 with a reason                             |
   | aisha        | farah  | Director of Security Engineering: runs the security monthly                               |
   | leo          | jun    | Owns dated-stage goals (the lakehouse) and the data freshness north star                  |

   Goals the walkthroughs name: the quiet goal is env-search (in the ns-env tree Rhea watches); the weekly review is
   still `weekly`; the critical path on the map runs ns-lead ← lead-merge ← lead-mq. */
import type { Workspace } from '../../domain/types';
import { buildPlatformOrg } from './generate';

export { buildPlatformOrg, PERSONAS, personaId, QUIET_GOAL } from './generate';

export const EXAMPLE_PLATFORM_ORG: Workspace = { id: 'platform-org', name: 'Example: Platform Engineering', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' };
export const platformOrg = { workspace: EXAMPLE_PLATFORM_ORG, build: buildPlatformOrg };
