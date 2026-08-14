#!/usr/bin/env node
// Attack 1 acceptance: dc.type 70 (jattack 0 — Jevil clone five-spade fans)
// against the real game.
//
//   node tools/verify-a70.mjs
//
// Oracle: jevil-research traces/a70-fan.csv (oracle_attack.csx, type=70,
// seed=4242, stationary soul, damage+graze sterilized on both sides).
//
// Window claim: rows 0..239 are a real turn's attack window (turntimer
// 240 -> 0); rows beyond continue under the recorder configuration on both
// sides. The whole 600-frame file must match cell-for-cell.
//
// Positive execution assertions: bullets spawned, contact detected — a run
// of empty green cells cannot pass.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';

const oraclePath = join(homedir(), 'jevil-research', 'traces', 'a70-fan.csv');
if (!existsSync(oraclePath)) {
  console.log(`MISSING ${oraclePath} — record with oracle_attack.csx type=70`);
  process.exit(1);
}

const oracleLines = readFileSync(oraclePath, 'utf8')
  .replace(/\r/g, '')
  .replace(/\n$/, '')
  .split('\n');

const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene: 'oracle-a70' });
const simLines = csv.replace(/\n$/, '').split('\n');

if (simLines[0] !== oracleLines[0]) {
  console.log(`HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
  process.exit(1);
}

const rows = Math.min(oracleLines.length, simLines.length) - 1;
let failed = false;
let shown = 0;
for (let i = 1; i <= rows; i++) {
  if (oracleLines[i] !== simLines[i]) {
    if (shown === 0) console.log(`FIRST DIVERGENCE at frame ${i - 1}:`);
    if (shown < 3) {
      console.log(`  oracle: ${oracleLines[i]}`);
      console.log(`  engine: ${simLines[i]}`);
      shown++;
    }
    failed = true;
    if (shown >= 3) break;
  }
}

// Positive execution: the attack must actually have happened.
if (counters.collisionHits < 1) {
  console.log(`POSITIVE ASSERTION FAILED: no contact ever detected (collisionHits=0)`);
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
console.log(`PASS  ${rows} rows cell-exact vs a70-fan.csv  ` +
  `(hits=${counters.collisionHits}, checks=${counters.collisionChecks})`);
