/* The shard plan: which journeys and which platform checks run in which shard, so every check runs in exactly one.
   Shared by evals/journeys.cjs (to pick what to run) and evals/run.mjs (to print and verify the plan).

   Journeys go round-robin by position (journey i is in shard k when i % n === k - 1). Platform checks (P1–P4, P6–P10, P15 and
   every F/N module) are placed by weight: heaviest first, each into the shard with the least work so far, counting its
   journeys. The weights are measured seconds (from a four-shard run); a check that isn't listed counts as DEFAULT.
   P5 is not placed: it is computed from the console errors of every journey, in every shard, when the results merge. */
const fs = require('fs');
const path = require('path');

const JOURNEY_SECONDS = 9.5; // a journey on a phone and a desktop, on average
const DEFAULT = 30;
const WEIGHTS = {
  P1: 3, P2: 22, P3: 28, P4: 20, P6: 21, P7: 14, P8: 3, P9: 41, P10: 6, P15: 8,
  F1: 38, F2: 27, F3: 29, F4: 19, F5: 21, F6: 29, F7: 26, F8: 41,
  N1: 23, N2: 32, N3: 16, N4: 45, N5: 14, N6: 26, N7: 240, N8: 34, N9: 29,
};

/** Ids of the per-area modules (evals/finish, evals/notes), in the order journeys.cjs runs them. */
function moduleIds() {
  return ['finish', 'notes'].flatMap((d) => fs.readdirSync(path.join(__dirname, d)).filter((x) => x.endsWith('.cjs')).sort().map((x) => require(path.join(__dirname, d, x)).id));
}

/** Every platform check that is placed in a shard (P5 is aggregated, not placed). */
function checkIds() {
  return ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8', 'P9', 'P10', 'P15', ...moduleIds()];
}

/** The plan for n shards: [{ k, journeys: [ids], checks: [ids], seconds }]. Deterministic. */
function plan(n, journeyIds) {
  const shards = Array.from({ length: n }, (_, i) => ({ k: i + 1, journeys: [], checks: [], seconds: 0 }));
  journeyIds.forEach((id, i) => { const s = shards[i % n]; s.journeys.push(id); s.seconds += JOURNEY_SECONDS; });
  const units = checkIds().map((id) => ({ id, w: WEIGHTS[id] ?? DEFAULT })).sort((a, b) => b.w - a.w || a.id.localeCompare(b.id, 'en', { numeric: true }));
  for (const u of units) {
    const s = shards.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    s.checks.push(u.id); s.seconds += u.w;
  }
  const order = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  shards.forEach((s) => s.checks.sort(order));
  return shards;
}

module.exports = { plan, checkIds, moduleIds, WEIGHTS };
