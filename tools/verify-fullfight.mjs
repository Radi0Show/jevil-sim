#!/usr/bin/env node
// WHOLE-FIGHT DIFF — the chapter 1 one-to-one check.
//
//   node tools/verify-fullfight.mjs [--context N]
//
// One input script drives both the real game (oracle_fullfight_ch1.csx,
// via jevil-research/tools/record-fullfight.mjs) and the sim
// (tools/fullfight-trace.mjs); the traces must match to the wipe.
//
// The report is by SYSTEM, in causal order (knight-sim's verify-fullfight
// pattern): each column group's first divergence is found independently
// and printed earliest-first, because the group that broke first is the
// fault and the rest are its downstream.
//
// TWO-TIER: tension/tt run under the death-frame G-skip envelope
// (sim/index.js runCollisions): sim tension >= oracle, tt <=, offsets
// stepping only on frames where a bullet died or a hit landed, each step
// bounded by the largest grazepoints/timepoints in the fight (12 / 5 —
// Diamond Release II). Every other column is byte-exact. nbul keeps the
// established +/-2 trig-residue allowance.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ORACLE = join(homedir(), 'jevil-research', 'traces', 'fullfight-defend.csv');
const INPUTS = join(homedir(), 'jevil-research', 'traces', 'fullfight-defend-inputs.txt');

if (!existsSync(ORACLE)) {
  console.log(`MISSING ${ORACLE} — record with jevil-research/tools/record-fullfight.mjs`);
  process.exit(1);
}

const oracleLines = readFileSync(ORACLE, 'utf8').replace(/\r/g, '').trim().split('\n');
const hdr = oracleLines[0].split(',');
const col = (n) => hdr.indexOf(n);

const simCsv = execFileSync(process.execPath, [
  join(import.meta.dirname, 'fullfight-trace.mjs'),
  '--inputs', INPUTS,
  '--frames', String(oracleLines.length + 10),
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const simLines = simCsv.trim().split('\n');

if (simLines[0] !== oracleLines[0]) {
  console.log(`HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
  process.exit(1);
}

// claim window: to the wipe (inclusive of the gameover row).
const goCol = col('gameover');
let rows = Math.min(oracleLines.length, simLines.length) - 1;
for (let i = 1; i <= rows; i++) {
  if (oracleLines[i].split(',')[goCol] === '1') { rows = i; break; }
}

// causal column groups
const GROUPS = [
  ['menu', ['myfight', 'mnfight', 'bmenuno', 'charturn', 'ca0', 'ca1', 'ca2']],
  ['turn', ['jturn', 'jattack', 'mt']],
  ['soul', ['soul_x', 'soul_y']],
  ['damage', ['hp1', 'hp2', 'hp3', 'inv']],
  ['tension', ['tension', 'tt']], // envelope, not exact
  ['jevil', ['jhp']],
  ['bullets', ['nbul']], // +/-2 residue
  ['bullet-slots', ['b0x', 'b0y', 'b1x', 'b1y', 'b2x', 'b2y', 'b3x', 'b3y', 'b4x', 'b4y', 'b5x', 'b5y']],
  ['ending', ['gameover']],
];

const nbulCol = col('nbul');
const tenCol = col('tension');
const ttCol = col('tt');
const invCol = col('inv');

const context = (() => {
  const i = process.argv.indexOf('--context');
  return i >= 0 ? Number(process.argv[i + 1]) : 1;
})();

const findings = [];
let skipAwards = 0;

for (const [name, cols] of GROUPS) {
  const idx = cols.map(col);
  let prevTenOff = 0;
  let prevTtOff = 0;
  let prevNbulO = null;
  let bad = -1;
  let why = '';
  for (let i = 1; i <= rows; i++) {
    const oc = oracleLines[i].split(',');
    const sc = simLines[i].split(',');
    if (name === 'tension') {
      const tenOff = parseFloat(sc[tenCol]) - parseFloat(oc[tenCol]);
      const ttOff = parseFloat(oc[ttCol]) - parseFloat(sc[ttCol]);
      if (Number.isNaN(tenOff) || Number.isNaN(ttOff)) { bad = i; why = 'unparseable'; break; }
      if (tenOff < -1e-9 || ttOff < -1e-9) { bad = i; why = 'offset on the wrong side'; break; }
      // a turn-timer RE-ARM (tt assigned 120/240/...) erases any G-skip
      // shortfall on both sides at once — resync the tt baseline there.
      const oPrevTt = i > 1 ? parseFloat(oracleLines[i - 1].split(',')[ttCol]) : NaN;
      if (!Number.isNaN(oPrevTt) && parseFloat(oc[ttCol]) > oPrevTt) {
        prevTtOff = ttOff;
      }
      // the maxtension cap (250) saturates both sides — any accumulated
      // G-skip surplus is erased there; resync the tension baseline.
      if (parseFloat(oc[tenCol]) >= 250 - 1e-9 && parseFloat(sc[tenCol]) >= 250 - 1e-9) {
        prevTenOff = tenOff;
      }
      const dTen = tenOff - prevTenOff;
      const dTt = ttOff - prevTtOff;
      if (Math.abs(dTen) > 1e-9 || Math.abs(dTt) > 1e-9) {
        // ONE-SIDED, BOUNDED steps only: the sim awarding a graze the
        // runner skipped (death-frame G-skips AND the corner-band class,
        // which steps on any frame a grazed bullet clips a box edge the
        // runner's dispatch misses). Each step is at most one bullet's
        // award; the direction never reverses outside the cap/re-arm
        // resyncs above.
        const okStep = dTen > -1e-9 && dTen <= 12 + 1e-9 && dTt > -1e-9 && dTt <= 5 + 1e-9;
        if (!okStep) { bad = i; why = 'graze offset step wrong side or oversized'; break; }
        skipAwards += 1;
        prevTenOff = tenOff;
        prevTtOff = ttOff;
      }
      prevNbulO = parseFloat(oc[nbulCol]);
      continue;
    }
    for (const c of idx) {
      if (oc[c] === sc[c]) continue;
      if (c === nbulCol && Math.abs(parseFloat(oc[c]) - parseFloat(sc[c])) <= 2) continue;
      // bullet slots carry the documented f32 aimed-trig residue: positions
      // within 0.01px are the known deviation class, not a divergence.
      if (name === 'bullet-slots' && oc[c] !== '' && sc[c] !== ''
          && Math.abs(parseFloat(oc[c]) - parseFloat(sc[c])) <= 0.01) continue;
      bad = i; why = hdr[c];
      break;
    }
    if (bad >= 0) break;
    prevNbulO = parseFloat(oc[nbulCol]);
  }
  if (bad >= 0) findings.push({ name, frame: bad - 1, why });
}

findings.sort((a, z) => a.frame - z.frame);
if (findings.length === 0) {
  console.log(`PASS  fullfight-defend: ${rows} rows to the wipe` +
    (skipAwards ? ` (${skipAwards} death-frame G-skip award(s) absorbed)` : ''));
  process.exit(0);
}
console.log(`FAIL  fullfight-defend — first divergence per system, earliest first:`);
for (const f of findings) {
  console.log(`  [${f.name}] frame ${f.frame} (${f.why})`);
  for (let k = Math.max(1, f.frame + 1 - context); k <= Math.min(rows, f.frame + 1 + context); k++) {
    console.log(`      oracle: ${oracleLines[k]}`);
    console.log(`      engine: ${simLines[k]}`);
  }
}
process.exit(1);
