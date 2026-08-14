#!/usr/bin/env node
// Attack 8 acceptance: dc.type 68 (jattack 7 — side-flipped spade rings + soul speedup) vs the real
// game. Two-tier per docs/VERIFICATION.md; recorded with the widened
// recorder (hs/vs accessor columns).
//
//   node tools/verify-a65.mjs

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';
import { diffAttackTrace } from './lib/attack-diff.mjs';

const oraclePath = join(homedir(), 'jevil-research', 'traces', 'a68-spadering.csv');
if (!existsSync(oraclePath)) {
  console.log(`MISSING ${oraclePath} — record with oracle_attack.csx type=68`);
  process.exit(1);
}

const oracleLines = readFileSync(oraclePath, 'utf8').replace(/\r/g, '').replace(/\n$/, '').split('\n');
const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene: 'oracle-a68' });
const simLines = csv.replace(/\n$/, '').split('\n');

const { failed, summaryLine } = diffAttackTrace({ oracleLines, simLines });

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
