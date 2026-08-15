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
}

const state = createState({ seed: 1, traceBulletSlots: 0 });
buildFullFightScene(state, { seed: 4242, txtDraws });

let rows = frames;
for (let i = 0; i < frames; i++) {
  stepFrame(state, maskToInput(masks.get(i) ?? 0));
  if (state.gameOver && rows === frames) rows = Math.min(frames, i + 30); // recorder keeps a 30-frame tail
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
