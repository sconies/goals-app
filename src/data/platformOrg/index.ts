/* The Platform Engineering example: one division of about 100 people with 12 north stars, a year of history, in Q4.
   It is the demo's only example (src/data/examples.ts loads it on demand).

   Who plays which part in the walkthroughs, research tasks and evals (PERSONAS in generate.ts says the same):

   | Part                                   | Here   | Why                                                                                      |
   |----------------------------------------|--------|------------------------------------------------------------------------------------------|
   | The leader                             | amara  | VP Platform Engineering: runs the leadership weekly and the QBR, watches the north stars, admin, owns no goals |
   | A goal owner with goals behind         | rhea   | Owns the lead time north star (off track, the merge queue on its critical path) and 8 goals in all; watches a tree with a goal gone quiet |
   | Someone who only watches               | oskar  | Engineer who watches three goals and owns none                                            |
   | An owner who changed a target          | tariq  | Raised a too-easy target after check-ins began (AI-assisted review, 60% to 80%)           |
   | An owner who imported past weeks       | mateo  | Loaded his first nine weeks of numbers from a spreadsheet (backfilled check-ins)          |
   | The admin                              | grace  | Engineering operations admin: pinned views, assistant tokens, people and settings         |
   | A director who re-planned              | bjorn  | Owns the cost north star, re-planned in week 27 with a reason                             |
   | A director who runs a review           | farah  | Director of Security Engineering: runs the security monthly                               |
   | An owner of dated stages               | jun    | Owns dated-stage goals (the lakehouse) and the data freshness north star                  |

   Goals the walkthroughs name: the quiet goal is env-search (in the ns-env tree Rhea watches); the weekly review is
   `weekly`; the critical path on the map runs ns-lead ← lead-merge ← lead-mq. */
export { buildPlatformOrg, PERSONAS, personaId, QUIET_GOAL } from './generate';
