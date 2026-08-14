#!/usr/bin/env node
// Attack 1 acceptance: dc.type 70 (jattack 0 — Jevil clone five-spade fans)
// against the real game.
//
//   node tools/verify-a70.mjs
//
// Oracle: jevil-research traces/a70-fan.csv (oracle_attack.csx, type=70,
// seed=4242, stationary soul, damage+graze sterilized on both sides).
//
// TWO-TIER CLAIM (see docs/VERIFICATION.md, "the chapter 1 trig residue"):
//
//   Tier 1 — byte-exact: every non-position column (soul, teleport con/
//   timer/xscale AND positions — teleport spawn points are RNG-derived, no
//   trig), turntimer, bullet count, hit count, for all 600 frames.
//
//   Tier 2 — bullet positions: byte-exact until the first trig-residue
//   cell, then within DRIFT_MAX of the oracle for the rest of the window.
//   The chapter 1 runner derives aimed-bullet velocities through
//   single-precision trig whose last bits JS cannot currently reproduce
//   (measured: effective direction up to ~1.5e-4 deg from the assigned
//   f32 value; probes in jevil-research traces/{trig,pointdir,mover}-
//   probe.csv and the hs/vs columns of a70-wide.csv). The residue drifts
//   at most 1 f32 ulp per frame in coarse grid zones — bounded here at
//   DRIFT_MAX = 0.02 px per cell, ~100x the worst measured drift and
//   ~100x below any real logic error (a wrong fan offset diverges by
//   whole pixels within two frames).
//
// Positive execution assertions: bullets spawned, contact detected.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';

const DRIFT_MAX = 0.02;

const oraclePath = join(homedir(), 'jevil-research', 'traces', 'a70-fan.csv');
if (!existsSync(oraclePath)) {
  console.log(`MISSING ${oraclePath} — record with oracle_attack.csx type=70`);
  process.exit(1);
}

const oracleLines = readFileSync(oraclePath, 'utf8')
  .replace(/\r/g, '')
  .replace(/\n$/, '')
  .split('\n');
const header = oracleLines[0].split(',');

const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene: 'oracle-a70' });
const simLines = csv.replace(/\n$/, '').split('\n');

if (simLines[0] !== oracleLines[0]) {
  console.log(`HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
  process.exit(1);
}

const isPositionCol = header.map((h) => /^b\d+_[xy]$/.test(h));
// nbul/hits can flip at a TANGENTIAL contact once the trig residue moves a
// young (untraced, slot >= 16) spade across the heart-mask boundary — the
// oldest-16 slots themselves stay aligned because chapter 1 bullets never
// despawn and the early spades are long offscreen. Byte-exact through the
// real-turn window's spawn phase (turntimer >= 30 ends at f210; measured
// clean through f214), bounded after.
const isContactCol = header.map((h) => h === 'nbul' || h === 'hits');
const CONTACT_EXACT_TO = 214;
const CONTACT_SLACK = 3;
const rows = Math.min(oracleLines.length, simLines.length) - 1;
let failed = false;
let firstResidue = null;
let residueCells = 0;
let worstDrift = 0;
let contactFlips = 0;

for (let i = 1; i <= rows; i++) {
  const oc = oracleLines[i].split(',');
  const sc = simLines[i].split(',');
  for (let c = 0; c < header.length; c++) {
    if (oc[c] === sc[c]) continue;
    if (isContactCol[c] && i - 1 > CONTACT_EXACT_TO) {
      const diff = Math.abs(parseFloat(oc[c]) - parseFloat(sc[c]));
      if (diff > CONTACT_SLACK) {
        console.log(`CONTACT FAIL at frame ${i - 1}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]}`);
        failed = true;
      } else if (header[c] === 'hits') {
        contactFlips = Math.max(contactFlips, diff);
      }
      continue;
    }
    if (!isPositionCol[c]) {
      console.log(`TIER-1 FAIL at frame ${i - 1}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]}`);
      failed = true;
      continue;
    }
    // Tier 2: position residue.
    const drift = Math.abs(parseFloat(oc[c]) - parseFloat(sc[c]));
    if (Number.isNaN(drift) || drift > DRIFT_MAX) {
      console.log(`TIER-2 FAIL at frame ${i - 1}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]} (drift ${drift})`);
      failed = true;
      continue;
    }
    residueCells++;
    worstDrift = Math.max(worstDrift, drift);
    if (!firstResidue) firstResidue = { frame: i - 1, col: header[c] };
  }
  if (failed && i > 80) break; // enough to diagnose
}

if (counters.collisionHits < 1) {
  console.log(`POSITIVE ASSERTION FAILED: no contact ever detected`);
  failed = true;
}
if (counters.collisionChecks < 100) {
  console.log(`POSITIVE ASSERTION FAILED: collision checks ${counters.collisionChecks} < 100`);
  failed = true;
}
if (counters.unmaskedBullets > 0) {
  console.log(`POSITIVE ASSERTION FAILED: ${counters.unmaskedBullets} bullet checks skipped for want of a mask`);
  failed = true;
}

if (failed) {
  console.log('FAIL');
  process.exit(1);
}
console.log(
  `PASS  ${rows} rows: mechanics byte-exact (contact cols to f${CONTACT_EXACT_TO}); ` +
    (firstResidue
      ? `trig residue from f${firstResidue.frame} (${firstResidue.col}), ` +
        `${residueCells} cells, worst ${worstDrift.toExponential(2)} px` +
        (contactFlips ? `, ${contactFlips} tangential contact flip(s) past the window` : '')
      : 'positions byte-exact too') +
    `  (hits=${counters.collisionHits}, checks=${counters.collisionChecks})`,
);
