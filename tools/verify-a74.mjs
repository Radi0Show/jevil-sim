#!/usr/bin/env node
// Attack 15 acceptance: dc.type 74 (jattack 14 — Diamond Release II) vs the real
// game. Two-tier per docs/VERIFICATION.md; recorded with the widened
// recorder (hs/vs accessor columns).
//
//   node tools/verify-a65.mjs

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';
import { diffAttackTrace } from './lib/attack-diff.mjs';

const oraclePath = join(homedir(), 'jevil-research', 'traces', 'a74-diamonds2.csv');
if (!existsSync(oraclePath)) {
  console.log(`MISSING ${oraclePath} — record with oracle_attack.csx type=74`);
  process.exit(1);
}

const oracleLines = readFileSync(oraclePath, 'utf8').replace(/\r/g, '').replace(/\n$/, '').split('\n');
const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene: 'oracle-a74' });
const simLines = csv.replace(/\n$/, '').split('\n');

// FULL-WINDOW EXACT since the untransformed collision fast path landed
// (sim/masks.js): the old f136 hit-flip was never a mask problem — the
// stored spr_diamondbullet_vert mask is right, and the RUNNER's
// angle-0/scale-1 pairs round both positions half-even and intersect
// cells directly (contact-probe2 cfg6 0/600, contact-probe3 0/2400).
// The "effective mask" hypothesis chase is closed.
const { failed, summaryLine } = diffAttackTrace({ oracleLines, simLines, slotMatch: true });

let bad = failed;
if (counters.collisionHits < 1) {
  console.log('POSITIVE ASSERTION FAILED: no contact ever detected');
  bad = true;
}
if (counters.motionSteps < 1000) {
  console.log(`POSITIVE ASSERTION FAILED: motion steps ${counters.motionSteps} < 1000`);
  bad = true;
}
if (counters.unmaskedBullets > 0) {
  console.log(`POSITIVE ASSERTION FAILED: ${counters.unmaskedBullets} unmasked bullet checks`);
  bad = true;
}

if (bad) {
  console.log('FAIL');
  process.exit(1);
}
console.log(`PASS  ${summaryLine}  (hits=${counters.collisionHits}, motion=${counters.motionSteps})`);
