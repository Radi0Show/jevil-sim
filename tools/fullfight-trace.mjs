#!/usr/bin/env node
// Replay the whole-fight input script headless and print/write the trace.
//
//   node tools/fullfight-trace.mjs [--inputs <file>] [--frames N] [--out <file>]
//
// Inputs default to the research repo's recorded script
// (traces/fullfight-defend-inputs.txt, sparse "frame,mask" lines). The
// trace matches oracle_fullfight_ch1.csx's columns byte-for-byte.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createState, stepFrame } from '../sim/index.js';
import { buildFullFightScene, maskToInput } from './scenes/fullfight.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};

const inputsPath = opt('--inputs', join(homedir(), 'jevil-research', 'traces', 'fullfight-defend-inputs.txt'));
const frames = Number(opt('--frames', 12000));
const outPath = opt('--out', null);

const masks = new Map();
if (existsSync(inputsPath)) {
  for (const l of readFileSync(inputsPath, 'utf8').trim().split('\n')) {
    if (!l) continue;
    const [f, m] = l.split(',').map(Number);
    masks.set(f, m);
  }
}

// the text-jitter side-channel rides in the oracle trace's txt column
const txtFrom = opt('--txtfrom', join(homedir(), 'jevil-research', 'traces', 'fullfight-defend.csv'));
let txtDraws = null;
let wrDraws = null;
if (existsSync(txtFrom)) {
  const lines = readFileSync(txtFrom, 'utf8').replace(/\r/g, '').trim().split('\n');
  const hdr = lines[0].split(',');
  const fi = hdr.indexOf('frame');
  const ti = hdr.indexOf('txt');
  if (ti >= 0) {
    txtDraws = new Map();
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      txtDraws.set(+c[fi], +c[ti]);
    }
  }
  const wi = hdr.indexOf('wr');
  if (wi >= 0) {
    wrDraws = new Map();
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      wrDraws.set(+c[fi], +c[wi]);
    }
  }
}

const mode = opt('--mode', 'defend');
const reanchor = process.argv.includes('--reanchor');
const state = createState({ seed: 1, traceBulletSlots: 0 });
buildFullFightScene(state, { seed: 4242, txtDraws, wrDraws, mode });

// MENU-REANCHORED REPLAY (--reanchor): the ±1-frame graze-timepoint turn
// drift (the documented pair-model bound) ACCUMULATES over a long fight
// until absolute-frame replay misses a menu. Re-anchoring keeps the same
// DECISIONS: each burst of inputs is replayed at the SIM's own menu-fresh
// frame plus the burst's offsets from the ORACLE's menu-fresh frame.
let schedule = masks;
let oracleMenus = [];
let oracleAnchors = [];
if (reanchor && existsSync(txtFrom)) {
  const lines = readFileSync(txtFrom, 'utf8').replace(/\r/g, '').trim().split('\n');
  const hdr = lines[0].split(',');
  const [fi2, my, mn, bm, sx, tt2] = ['frame', 'myfight', 'mnfight', 'bmenuno', 'soul_x', 'tt'].map((n) => hdr.indexOf(n));
  let prevFresh = -100;
  let inWindow = false;
  let pTt = NaN;
  let pSoul = null;
  let pMy = null;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const fresh = c[my] === '0' && c[mn] === '0' && c[bm] === '0';
    if (fresh && !inWindow && +c[fi2] > prevFresh + 30) {
      oracleMenus.push(+c[fi2]);
      prevFresh = +c[fi2];
    }
    inWindow = fresh;
    // the differ's anchor set: tt re-arms, soul flips, myfight changes —
    // the channel cursor jumps between these.
    const ttv = parseFloat(c[tt2]);
    const soul = c[sx] !== '';
    if ((!Number.isNaN(pTt) && ttv - pTt > 50)
      || (pSoul !== null && soul !== pSoul)
      || (pMy !== null && c[my] !== pMy)) oracleAnchors.push(+c[fi2]);
    pTt = ttv;
    pSoul = soul;
    pMy = c[my];
  }
}
const burstFor = new Map(); // oracleMenu index -> [[offset, mask], ...]
if (reanchor) {
  for (const [f, m] of [...masks.entries()].sort((a, z) => a[0] - z[0])) {
    let k = -1;
    for (let q = 0; q < oracleMenus.length; q++) if (oracleMenus[q] <= f) k = q;
    if (!burstFor.has(k)) burstFor.set(k, []);
    burstFor.get(k).push([k >= 0 ? f - oracleMenus[k] : f, m]);
  }
  schedule = new Map();
  for (const [off, m] of burstFor.get(-1) ?? []) schedule.set(off, m); // pre-menu absolutes
}

let rows = frames;
let simMenuIdx = 0;
let prevFreshSim = false;
let lastMenuFrame = -100;
// CHANNEL CURSOR (reanchor): the presentation-draw counts are consumed
// along the ORACLE's timeline, advanced one oracle-frame per sim frame
// and JUMPED at every anchor so each phase window consumes exactly the
// draws the runner's matching window consumed — regardless of the ±drift
// in the sim's own frame numbers. Skipped oracle rows' counts are
// consumed in bulk at the jump (the runner consumed them; the stream
// must advance identically).
let chanCursor = 0;
let anchorIdx = 0;
let pTtS = NaN;
let pSoulS = null;
let pMyS = null;
const rawTxt = state.txtDraws;
const rawWr = state.wrChannel;
if (reanchor && rawTxt) {
  state.txtDraws = { get: () => 0 }; // replaced by the cursor feed below
}
for (let i = 0; i < frames; i++) {
  if (reanchor) {
    const fresh = state.myfight === 0 && state.mnfight === 0 && state.bmenuno === 0
      && !(state.soul && state.soul.alive);
    if (fresh && !prevFreshSim && i > lastMenuFrame + 30) {
      for (const [off, m] of burstFor.get(simMenuIdx) ?? []) schedule.set(i + off, m);
      simMenuIdx += 1;
      lastMenuFrame = i;
    }
    prevFreshSim = fresh;
    // detect a sim anchor (same predicate family as the oracle list)
    const ttv = state.turntimer;
    const soul = !!(state.soul && state.soul.alive);
    const my = String(state.myfight ?? 0);
    const isAnchor = (!Number.isNaN(pTtS) && ttv - pTtS > 50)
      || (pSoulS !== null && soul !== pSoulS)
      || (pMyS !== null && my !== pMyS);
    pTtS = ttv;
    pSoulS = soul;
    pMyS = my;
    if (isAnchor && anchorIdx < oracleAnchors.length) {
      // jump: consume any oracle rows the cursor skipped
      const target = oracleAnchors[anchorIdx];
      let bulk = 0;
      while (chanCursor < target) {
        bulk += rawTxt?.get(chanCursor) ?? 0;
        chanCursor += 1;
      }
      if (bulk > 0) state.pendingChannelBulk = (state.pendingChannelBulk ?? 0) + bulk;
      anchorIdx += 1;
    }
    if (rawTxt) {
      const n = (rawTxt.get(chanCursor) ?? 0) + (state.pendingChannelBulk ?? 0);
      state.pendingChannelBulk = 0;
      state.frameChannelCount = n;
      state.txtDraws = { get: (f) => (f === state.frame ? state.frameChannelCount : 0) };
      chanCursor += 1;
    }
    if (rawWr) {
      // the wr gate reads the same cursor's oracle frame
      state.writerBusy = (f) => (rawWr.get(chanCursor - 2) ?? 0) > 0;
    }
  }
  stepFrame(state, maskToInput(schedule.get(i) ?? 0));
  if ((state.gameOver || state.jokerDefeated) && rows === frames) rows = Math.min(frames, i + 30); // recorder keeps a 30-frame tail
  if (i + 1 >= rows) break;
}

// state.trace rows are pre-joined strings (sim/trace.js traceRow).
const csv = [state.traceCustom.header.join(',')]
  .concat(state.trace.slice(0, rows))
  .join('\n') + '\n';

if (outPath) {
  writeFileSync(outPath, csv);
  console.log(`${Math.min(rows, state.trace.length)} rows -> ${outPath}`);
} else {
  process.stdout.write(csv);
}
