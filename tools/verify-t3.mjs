#!/usr/bin/env node
// T3 acceptance: the chapter 1 soul against the real game.
//
//   node tools/verify-t3.mjs
//
// Three oracle recordings (jevil-research tools/patches/oracle_t3_soul.csx,
// one per input mode), each diffed cell-exact over the FULL 600-frame window
// — the scenario has no bullets, so nothing outside the model perturbs any
// column:
//
//   t3-hold-right.csv   soul-box         hold right into the box wall
//   t3-focus.csv        soul-box-focus   focus halving engages at frame 20
//   t3-corner.csv       soul-box-corner  diagonal into the corner
//
// The oracle stage: box grown at (320,170), heart created at (314,162), rows
// begin at the heart's first Step. buildSoulBoxScene mirrors it exactly.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTrace } from './run-trace.mjs';

const PAIRS = [
  ['t3-hold-right.csv', 'soul-box'],
  ['t3-focus.csv', 'soul-box-focus'],
  ['t3-corner.csv', 'soul-box-corner'],
];

const FRAMES = 600;
let failed = false;

for (const [traceName, scene] of PAIRS) {
  const oraclePath = join(homedir(), 'jevil-research', 'traces', traceName);
  if (!existsSync(oraclePath)) {
    console.log(`MISSING ${oraclePath} — record it first (jevil-research tools/record-t3.sh)`);
    failed = true;
    continue;
  }

  // GameMaker's file_text_writeln emits CRLF; normalise before comparing.
  const oracleLines = readFileSync(oraclePath, 'utf8')
    .replace(/\r/g, '')
    .replace(/\n$/, '')
    .split('\n');

  const simLines = runTrace({ seed: 1, frames: FRAMES, scene }).replace(/\n$/, '').split('\n');

  if (simLines[0] !== oracleLines[0]) {
    console.log(`FAIL  ${scene}: HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
    failed = true;
    continue;
  }

  const rows = Math.min(oracleLines.length, simLines.length) - 1;
  let bad = null;
  for (let i = 1; i <= rows; i++) {
    if (oracleLines[i] !== simLines[i]) {
      bad = i - 1;
      break;
    }
  }
  if (bad !== null) {
    console.log(`FAIL  ${scene}: first divergence at frame ${bad}`);
    console.log(`        oracle: ${oracleLines[bad + 1]}`);
    console.log(`        engine: ${simLines[bad + 1]}`);
    failed = true;
  } else {
    console.log(`PASS  ${scene.padEnd(16)} ${rows} rows byte-exact vs ${traceName}`);
  }
}

process.exit(failed ? 1 : 0);
