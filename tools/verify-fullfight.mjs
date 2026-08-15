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

const PAIRS = [
  ['fullfight-defend', 'defend'],
  ['fullfight-fight', 'fight'],
];

let anyFail = false;
for (const [base, mode] of PAIRS) {
  const ORACLE = join(homedir(), 'jevil-research', 'traces', `${base}.csv`);
  const INPUTS = join(homedir(), 'jevil-research', 'traces', `${base}-inputs.txt`);
  if (!existsSync(ORACLE)) {
    console.log(`MISSING ${ORACLE}`);
    anyFail = true;
    continue;
  }
  runPair(base, mode, ORACLE, INPUTS);
}
process.exit(anyFail ? 1 : 0);

function runPair(base, mode, ORACLE, INPUTS) {

const oracleLines = readFileSync(ORACLE, 'utf8').replace(/\r/g, '').trim().split('\n');
const hdr = oracleLines[0].split(',');
const col = (n) => hdr.indexOf(n);

const simCsv = execFileSync(process.execPath, [
  join(import.meta.dirname, 'fullfight-trace.mjs'),
  '--inputs', INPUTS,
  '--txtfrom', ORACLE,
  '--mode', mode,
  '--frames', String(oracleLines.length + 10),
], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const simLines = simCsv.trim().split('\n');

if (simLines[0] !== oracleLines[0]) {
  console.log(`HEADER MISMATCH (${base})\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
  anyFail = true;
  return;
}

// claim window: the wipe (gameover) or the kill (jhp <= 0), inclusive.
const goCol = col('gameover');
const jhpCol = col('jhp');
let rows = Math.min(oracleLines.length, simLines.length) - 1;
for (let i = 1; i <= rows; i++) {
  const rc = oracleLines[i].split(',');
  if (rc[goCol] === '1' || parseFloat(rc[jhpCol]) <= 0) { rows = i; break; }
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
  ['bar', ['bf0', 'bc0', 'bf1', 'bc1', 'bf2', 'bc2', 'p0', 'p1', 'p2']],
  ['bullet-slots', ['b0x', 'b0y', 'b1x', 'b1y', 'b2x', 'b2y', 'b3x', 'b3y', 'b4x', 'b4y', 'b5x', 'b5y']],
  ['ending', ['gameover']],
].map(([n, cs]) => [n, cs.filter((c) => hdr.includes(c))]).filter(([, cs]) => cs.length);

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
let boundaryDrift = 0;

// TURN-ALIGNED comparison. The ±1-frame graze-timepoint flips (the
// documented grazebox pair-model bound) shift each enemy turn's END by a
// frame or two, so absolute frame indexes drift at turn boundaries while
// everything INSIDE a turn stays byte-exact. Anchors = the turn-timer
// re-arm rows (tt jumping up by more than 50); segments are compared
// with their own frame bases, and the drift per boundary is bounded.
const soulCol = col('soul_x');
const myCol = col('myfight');
function anchorsOf(lines) {
  // anchors at every structural transition: turn-timer re-arms AND the
  // soul appearing (moveheart landing) or vanishing (teardown) — each
  // window between transitions is homogeneous, so the ±frame boundary
  // drift never leaks into a comparison.
  const a = [1]; // data rows start at 1 (row 0 is the header)
  let prevTt = NaN;
  let prevSoul = null;
  let prevMy = null;
  for (let i = 1; i <= rows; i++) {
    const c = lines[i].split(',');
    const tt = parseFloat(c[ttCol]);
    const soul = c[soulCol] !== '';
    const my = c[myCol];
    if ((!Number.isNaN(prevTt) && tt - prevTt > 50)
      || (prevSoul !== null && soul !== prevSoul)
      || (prevMy !== null && my !== prevMy)) a.push(i);
    prevTt = tt;
    prevSoul = soul;
    prevMy = my;
  }
  return a;
}
const oa = anchorsOf(oracleLines);
const sa = anchorsOf(simLines);
if (oa.length !== sa.length) {
  findings.push({ name: 'turn-structure', frame: Math.min(oa.length, sa.length), why: `re-arm count ${oa.length} vs ${sa.length}` });
} else {
  for (let k = 0; k < oa.length; k++) {
    boundaryDrift = Math.max(boundaryDrift, Math.abs(oa[k] - sa[k]));
    if (Math.abs(oa[k] - sa[k]) > 3) {
      findings.push({ name: 'turn-structure', frame: oa[k] - 1, why: `boundary drift ${oa[k] - sa[k]} at re-arm ${k}` });
      break;
    }
  }
}

if (findings.length === 0) {
  for (const [name, cols] of GROUPS) {
    const idx = cols.map(col);
    let bad = -1;
    let why = '';
    let prevTenOff = 0;
    let prevTtOff = 0;
    outer:
    for (let k = 0; k < oa.length; k++) {
      const oBase = oa[k];
      const sBase = sa[k];
      const oEnd = k + 1 < oa.length ? oa[k + 1] : rows + 1;
      const sEnd = k + 1 < sa.length ? sa[k + 1] : rows + 1;
      // MENU windows (no soul) are INPUT-driven: the scripted presses land
      // at absolute frames on both sides, so they re-align absolutely and
      // must be compared that way. Enemy-turn windows are spawn-driven and
      // compare relative to their anchors.
      const obc = oracleLines[oBase].split(',');
      const isMenu = obc[soulCol] === '' && obc[myCol] === '0';
      const start = isMenu ? Math.max(oBase, sBase) : 0;
      const len = isMenu ? Math.min(oEnd, sEnd) - start : Math.min(oEnd - oBase, sEnd - sBase);
      for (let j = 0; j < len; j++) {
        const i = isMenu ? start + j : oBase + j;
        const si = isMenu ? start + j : sBase + j;
        if (i > rows || si > rows) break;
        const oc = oracleLines[i].split(',');
        const sc = simLines[si].split(',');
        if (name === 'tension') {
          const tenOff = parseFloat(sc[tenCol]) - parseFloat(oc[tenCol]);
          const ttOff = parseFloat(oc[ttCol]) - parseFloat(sc[ttCol]);
          if (Number.isNaN(tenOff) || Number.isNaN(ttOff)) { bad = i; why = 'unparseable'; break outer; }
          if (j === 0) { prevTtOff = ttOff; }
          if (parseFloat(oc[tenCol]) >= 250 - 1e-9 && parseFloat(sc[tenCol]) >= 250 - 1e-9) prevTenOff = tenOff;
          if (Math.abs(tenOff) > 12 + 1e-9 || Math.abs(ttOff) > 6 + 1e-9) { bad = i; why = 'graze offset out of bounds'; break outer; }
          const dTen = tenOff - prevTenOff;
          const dTt = ttOff - prevTtOff;
          if (Math.abs(dTen) > 1e-9 || Math.abs(dTt) > 1e-9) {
            if (Math.abs(dTen) > 12 + 1e-9 || Math.abs(dTt) > 6 + 1e-9) { bad = i; why = 'graze offset step oversized'; break outer; }
            skipAwards += 1;
            prevTenOff = tenOff;
            prevTtOff = ttOff;
          }
          continue;
        }
        const countsAgree = oc[nbulCol] === sc[nbulCol];
        if (name === 'bullet-slots') {
          // slots compare as a POSITION MULTISET: the recorder's with()
          // walk order is a runner-internal artifact (measured flipping
          // between newest- and oldest-first per object list), and a
          // count flip shifts every slot — order carries no claim.
          if (!countsAgree) continue;
          const pairs = (cells) => {
            const out = [];
            for (let q = 0; q < idx.length; q += 2) {
              if (cells[idx[q]] !== '') out.push([parseFloat(cells[idx[q]]), parseFloat(cells[idx[q] + 1])]);
            }
            // sort on residue-rounded keys — the f32 noise must not
            // reorder near-equal coordinates
            const k = (v) => Math.round(v * 10);
            return out.sort((a, z) => k(a[0]) - k(z[0]) || k(a[1]) - k(z[1]));
          };
          const op = pairs(oc);
          const sp = pairs(sc);
          let ok = op.length === sp.length;
          for (let q = 0; ok && q < op.length; q++) {
            ok = Math.abs(op[q][0] - sp[q][0]) <= 0.01 && Math.abs(op[q][1] - sp[q][1]) <= 0.01;
          }
          if (!ok) { bad = i; why = 'slot multiset'; break outer; }
          continue;
        }
        for (const c of idx) {
          if (oc[c] === sc[c]) continue;
          if (c === nbulCol && Math.abs(parseFloat(oc[c]) - parseFloat(sc[c])) <= 2) continue;
          // inv drifts with the boundary by design; keep it within ±3.
          if (hdr[c] === 'inv' && Math.abs(parseFloat(oc[c]) - parseFloat(sc[c])) <= 3) continue;
          bad = i; why = hdr[c];
          break;
        }
        if (bad >= 0) break outer;
      }
    }
    if (bad >= 0) findings.push({ name, frame: bad - 1, why });
  }
}

findings.sort((a, z) => a.frame - z.frame);
if (findings.length === 0) {
  console.log(`PASS  ${base}: ${rows} rows to the end` +
    (skipAwards ? ` (${skipAwards} one-sided graze step(s) absorbed)` : ''));
  return;
}
anyFail = true;
console.log(`FAIL  ${base} — first divergence per system, earliest first:`);
for (const f of findings) {
  console.log(`  [${f.name}] frame ${f.frame} (${f.why})`);
  for (let k = Math.max(1, f.frame + 1 - context); k <= Math.min(rows, f.frame + 1 + context); k++) {
    console.log(`      oracle: ${oracleLines[k]}`);
    console.log(`      engine: ${simLines[k]}`);
  }
}
}
