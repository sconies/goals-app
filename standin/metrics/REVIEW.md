# Review: stand-in stage 7, Metric library (reviewer; copy in S/rev-metrics)

## Re-run
- typecheck 0. npm test: first run 201/203 files (2 timeouts-type failures under shared CPU load), rerun 203 files, 2,231 tests pass (matches report; the report's own "10 timeouts on a loaded run" is the same flake).
- drill scripts/drill-faro: status.csv 5696/5696 (100%), contracts 56/56. lint:layers passes. prove-metrics.sh: on 41/41, left out 5/5, back 1/1 (matches).

## 1. Platform is the stand-in: VERIFIED
No supabase/vercel in platform/*.ts, new adapters, platform.ts, standinGuard/standinSources. SQLite, files API, server-side guard.
Forging as non-owner members through POST /commit (rhea, adaeze) and /api/files:
- GUARDED: metrics (change, remove, retire, merge, add-as-other, no unit/direction, dup name, delete-used), metricLinks (other's goal, unlink, part>60, unit mismatch), goals changed in a metric save (title, unit, no-metric relabel), module rows while off or left out, changes-log actor, readings drops (PUT/DELETE by member 403, anon 401).
- FORGEABLE: (1) a goal's `unmeasuredSince` (held to no number), on any other owner's goal, by a member who owns no metric: carry the goal's unchanged link row in the commit. allowsGoal only checks "a link row for that goal is in the commit" (not that it changed, nor that the metric's save caused it), so the side-effect write of the Gap rule is open (200, goal then held). (2) readings drop bypass: PUT /api/files/readings//ws_platform/b.csv as a member returns 200 and the row is served as a reading (admin-only check regex ^readings/<ws>/ does not match the double slash; files.put normalises). Also `Readings/...` and `readings/<ws>.csv` accepted (harmless folders). (3) unknown record kind inside module metrics (`modules.metrics.zzz`) returns 200 (silently dropped, not stored). (4) a check-in's `reading` {source,value} is not checked against any source (own goal only; owner may already set the value). (5) A member can create a goal owned by someone else and link it (200): the module's "creator links" rule, core goal creation rules apply.
- Core unguarded kinds (decisions, retros, watches, asks, reviews, feedback) unchanged from the core review; not module-7 writes.

## 3. Claims
(a) 50 of 55 untouched, src/domain 0: VERIFIED (patch touches no src/domain). (b) table VERIFIED in shape; WEAK: says R1 rule 4 met for the module, but forgery (1) and (2) above exist.
(c) NAMED cites r1:106-110, rules.md:28, adapters.md:28/42, r12:17: VERIFIED. R12.3 line 19: VERIFIED.
- GAP "switched-off module's forged rows refused by the server": WRONG. spec/rebuild/ports-at-scale.md:104 rule 5 says exactly this (Reviews examples). Should be NAMED.
- GAP "goal created in same save linked by its creator": WEAK. spec/modules/metrics/rules.md:97,562,663 name it ("a goal being made for someone else can be measured in the same save, by whoever makes it"); only r1 lacks it.
- GAP unit relabel / Gap held writes: WEAK. rules.md:633, 694-695 name them in the module spec; r1 table indeed does not. Real gap is the guard cannot tell the Gap write from any unmeasuredSince edit (see forgery 1).
- GAP Files list, sourcesFrom demo-only registration (no spec hit for registerNumberSources), core GAP 5 route shape, dropped DB checks (PART): VERIFIED gaps.
(d) numbers VERIFIED. Journeys 15/18 in /demo browser store: prove nothing about the stand-in server (as in core review). Exit 4/5 "forged /commit": VERIFIED except the Gap/unmeasuredSince write.

## 4. Proofs
On: VERIFIED (41). Left out: VERIFIED (5; save refused with module sentence, 53 tools, rows byte-identical). Back: VERIFIED. Switch-off by admin and member refusal: VERIFIED (in prove). Left-out refusal also holds for a module not in build (tags 403).

## 5. Tests honest
- standinGuard.refusal -> return null: metrics.test.ts 4 failures; exit 1. Honest.
- allowsGoal weakened (no rest-of-goal check, always true): only 1 of 15 fails; no test covers unmeasuredSince forged by a non-owner. Weak for allowsGoal.
- Two npm test files fail under load (timeouts), pass alone.

## 6. One-line kit fixes
- r12:57 "Stage 4" -> "Stage 7" (link stage-7-module-metrics.md exists): SOUND.
- adapters.md:42 add registerNumberSources: SOUND (line right).
- r1:106-110 rows (relabel/Gap side-effect writes; creator-links): SOUND, but two lines not one, and should also say the server must check the Gap write came from a metric's own save.
- Files `list?(prefix)` in src/ports/index.ts: one line, right; optional member means the contract cannot require it.
- module-platform.md ModuleGuard line: sound, but the refusal rule already exists in ports-at-scale.md:104; link it instead.
- schema.sql marking per module: not one line (ship per-module schema files).
Missing fix: spec should say a module's side-effect writes on core records (goal.unit, unmeasuredSince) need the server to check them as derived from the saved module rows, not just allow the field.
