#!/usr/bin/env node
// Damage + graze acceptance: the REAL chapter 1 damage and graze paths
// against unsterilized recordings.
//
//   node tools/verify-live.mjs
//
// Two live recordings (oracle_live_probe.csx): dc.type 70 (aimed fans —
// hits, target redirection, downs) and dc.type 65 (spade rings — heavy
// graze traffic: first-contact TP, trickle, turn shortening). Every cell
// must match byte-exact: hp1-3, inv, tension (10dp), turntimer (10dp),
// bullet count, gameover.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';

const PAIRS = [
  ['live-70.csv', 'live-70'],
  ['live-65.csv', 'live-65'],
];

let failed = false;
for (const [trace, scene] of PAIRS) {
  const oraclePath = join(homedir(), 'jevil-research', 'traces', trace);
  if (!existsSync(oraclePath)) {
    console.log(`MISSING ${oraclePath}`);
    failed = true;
    continue;
  }
  const oracleLines = readFileSync(oraclePath, 'utf8').replace(/\r/g, '').replace(/\n$/, '').split('\n');
  const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene });
  const simLines = csv.replace(/\n$/, '').split('\n');
  if (simLines[0] !== oracleLines[0]) {
    console.log(`${scene}: HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
    failed = true;
    continue;
  }
  const rows = Math.min(oracleLines.length, simLines.length) - 1;
  let bad = null;
  for (let i = 1; i <= rows; i++) {
    if (oracleLines[i] !== simLines[i]) { bad = i - 1; break; }
  }
  if (bad !== null) {
    console.log(`FAIL  ${scene}: first divergence at frame ${bad}`);
    console.log(`        oracle: ${oracleLines[bad + 1]}`);
    console.log(`        engine: ${simLines[bad + 1]}`);
    failed = true;
  } else if (counters.collisionHits < 3) {
    console.log(`FAIL  ${scene}: positive assertion — only ${counters.collisionHits} hits`);
    failed = true;
  } else {
    console.log(`PASS  ${scene.padEnd(8)} ${rows} rows byte-exact (hits=${counters.collisionHits})`);
  }
}
process.exit(failed ? 1 : 0);
