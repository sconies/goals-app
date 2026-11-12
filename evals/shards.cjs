/* The shard plan: which journeys and which platform checks run in which shard, so every check runs in exactly one.
   Shared by evals/journeys.cjs (to pick what to run) and evals/run.mjs (to print and verify the plan).

   Journeys and platform checks (P1–P4, P6–P10, P15 and every F/N module) are placed by weight: heaviest first, each
   into the shard with the least work so far. The weights are measured seconds (from a four-shard run); a journey that
   isn't listed counts as JOURNEY_SECONDS and a check as DEFAULT.
   P5 is not placed: it is computed from the console errors of every journey, in every shard, when the results merge. */
const fs = require('fs');
const path = require('path');

const JOURNEY_SECONDS = 15; // a journey on a phone and a desktop, when it hasn't been measured yet
/** Each journey, a phone and a desktop together, and each platform check, in seconds, as measured in a four-shard run
    on 7 Nov (evals/out/results.json: platform[].seconds; journeys' phone.ms + desktop.ms). Re-measure when a shard
    finishes much later than the others. */
const JOURNEY_WEIGHTS = {
  U1: 43, U2: 4, U3: 46, U4: 14, U5: 10, U6: 14, U7: 21, U8: 12, U9: 14, U10: 13, U11: 8, U12: 6, U13: 12, U14: 14, U15: 6, U16: 6,
  U17: 12, U18: 10, U19: 38, U20: 13, U21: 24, U22: 7, U23: 32, U24: 23, U25: 17, U26: 8, U27: 12, U28: 6, U29: 14, U30: 15, U31: 16,
  U32: 20, U33: 23, U34: 24, U35: 19, U36: 18, U37: 16, U38: 61, U39: 17, U40: 22, U41: 23, U42: 23, U43: 23, U44: 32, U45: 19, U46: 48, U47: 15, U48: 20, U49: 30, U51: 30, U52: 60, U58: 20, U59: 15, U60: 14, U61: 12, U62: 10, U86: 20, U93: 34, U109: 30, U136: 12, U137: 30, U134: 40, U142: 30,
};
const DEFAULT = 30;
const WEIGHTS = {
  P1: 1, P2: 13, P3: 64, P4: 63, P6: 28, P7: 15, P8: 5, P9: 50, P10: 6, P15: 2,
  F1: 32, F2: 18, F3: 25, F16: 20, F4: 29, F5: 17, F6: 36, F7: 29, F8: 34, F9: 20, F10: 12, F11: 10, F14: 45,
  N1: 21, N2: 98, N3: 18, N4: 62, N5: 19, N6: 32, N7: 256, N8: 34, N9: 43, N10: 40, N12: 120, N15: 40, N26: 150,
};

/** Ids of the per-area modules (evals/finish, evals/notes), in the order journeys.cjs runs them. */
function moduleIds() {
  return ['finish', 'notes'].flatMap((d) => fs.readdirSync(path.join(__dirname, d)).filter((x) => x.endsWith('.cjs')).sort().map((x) => require(path.join(__dirname, d, x)).id));
}

/** Every platform check that is placed in a shard (P5 is aggregated, not placed). */
function checkIds() {
  return ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8', 'P9', 'P10', 'P15', ...moduleIds()];
}

/** The plan for n shards: [{ k, journeys: [ids], checks: [ids], seconds }]. Deterministic. Everything (journeys and
    checks) goes heaviest first into the shard with the least work so far, so the shards end close together: placing
    journeys round-robin left one shard two minutes behind the rest. */
function plan(n, journeyIds) {
  const shards = Array.from({ length: n }, (_, i) => ({ k: i + 1, journeys: [], checks: [], seconds: 0 }));
  const order = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  const units = [
    ...journeyIds.map((id) => ({ id, w: JOURNEY_WEIGHTS[id] ?? JOURNEY_SECONDS, journey: true })),
    ...checkIds().map((id) => ({ id, w: WEIGHTS[id] ?? DEFAULT, journey: false })),
  ].sort((a, b) => b.w - a.w || order(a.id, b.id));
  for (const u of units) {
    const s = shards.reduce((best, x) => (x.seconds < best.seconds ? x : best));
    (u.journey ? s.journeys : s.checks).push(u.id); s.seconds += u.w;
  }
  // Journeys run in the order journeys.cjs lists them.
  shards.forEach((s) => { s.journeys.sort((a, b) => journeyIds.indexOf(a) - journeyIds.indexOf(b)); s.checks.sort(order); });
  return shards;
}

module.exports = { plan, checkIds, moduleIds, WEIGHTS, JOURNEY_WEIGHTS };
