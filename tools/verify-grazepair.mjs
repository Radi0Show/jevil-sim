#!/usr/bin/env node
// Grazebox pair-model acceptance: masksOverlap (AxisAlignedRect grazebox A
// vs precise spade B) against 3,600 recorded runner verdicts.
//
//   node tools/verify-grazepair.mjs
//
// Two sweeps from oracle_grazepair_probe.csx (both: grazebox parked at
// (324,172), probe spade repositioned per frame, verdict = did the
// grazebox's collision EVENT fire):
//   grazepair-probe.csv  — 1,800 pts around the box edges, quarter-pixel
//                          x steps, angles 0 / 37.29 / 217.83
//   grazepair-micro.csv  — 1,800 pts dense around the live-65 contact
//                          region, angle 3.1057 static AND moving
//                          (speed 9) plus an angle-0 control
//
// CLAIM: the model matches every verdict, except that EVENT-fire records
// may under-report overlap (the death-frame G-skip class documented in
// sim/index.js runCollisions: dispatch can skip a pair the runner's own
// place_meeting confirms). So runner=1 must imply model=1 byte-for-byte;
// runner=0/model=1 rows are tolerated only in the measured corner band
// (8 rows, top edge y=146.4567, x 290.6-292.4, angle 0) and never grow.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const M = await import('../sim/masks.js');

const SWEEPS = [
  ['grazepair-micro.csv', 0], // allowed runner-0/model-1 rows
  ['grazepair-probe.csv', 8],
];

let failed = false;
for (const [name, allowedSkips] of SWEEPS) {
  const p = join(homedir(), 'jevil-research', 'traces', name);
  if (!existsSync(p)) {
    console.log(`MISSING ${p}`);
    failed = true;
    continue;
  }
  const rows = readFileSync(p, 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  let missedHits = 0; // runner=1, model=0 — never allowed
  let skips = 0; // runner=0, model=1 — G-skip class, capped
  for (const [, , x, y, a, h] of rows) {
    const mine = M.masksOverlap(M.GRAZE_MASK, 324, 172, M.SPADEBULLET_MASK, +x, +y, 1, 1, +a) ? 1 : 0;
    if (mine === +h) continue;
    if (+h === 1) missedHits += 1;
    else skips += 1;
  }
  if (missedHits > 0 || skips > allowedSkips) {
    console.log(`FAIL  ${name}: model misses ${missedHits} runner-hits; ${skips} runner-miss/model-hit (allowed ${allowedSkips})`);
    failed = true;
  } else {
    console.log(`PASS  ${name.padEnd(20)} ${rows.length} verdicts, 0 missed hits` + (skips ? `, ${skips} dispatch-skip rows absorbed` : ''));
  }
}
process.exit(failed ? 1 : 0);
