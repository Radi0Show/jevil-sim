#!/usr/bin/env node
// EVERY ATTACK MAKES A SOUND, and none of them makes a wall of it.
//
// The sim cues through `state.audio?.cue(name)` — a no-op headless, so this
// suite supplies a recorder. No oracle carries an audio column; the two
// properties that actually go wrong are asserted directly (knight pattern):
//
//   1. AUDIBILITY — an attack with no cue at all ships silent.
//   2. NO STACKING — a per-frame wall of copies of one sample.

import { createState, stepFrame } from '../sim/index.js';
import { buildPracticeScene, ATTACKS } from '../sim/scenes/practice.js';

const idle = { left: false, right: false, up: false, down: false, focus: false };
const FRAMES = 900;
const PEAK_LIMIT = 4;

const failures = [];

for (let a = 0; a < ATTACKS.length; a += 1) {
  const state = createState({ seed: 12345, traceBulletSlots: 0 });
  buildPracticeScene(state, { attackIndex: a });
  state.damageEnabled = true;
  state.grazeEnabled = true;
  let frameCues = [];
  const all = new Map();
  let peak = 0;
  let peakFrame = -1;
  state.audio = { cue(n) { frameCues.push(n); } };
  for (let f = 0; f < FRAMES; f += 1) {
    frameCues = [];
    stepFrame(state, idle);
    for (const n of frameCues) all.set(n, (all.get(n) ?? 0) + 1);
    if (frameCues.length > peak) { peak = frameCues.length; peakFrame = f; }
  }
  const name = ATTACKS[a].name ?? `attack ${a}`;
  if (all.size === 0) failures.push(`${name}: SILENT (no cue in ${FRAMES} frames)`);
  if (peak > PEAK_LIMIT) failures.push(`${name}: ${peak} cues in one frame (f${peakFrame}) — stacking`);
}

// Every sound the sim can cue must have a sample in the shipped index —
// a cue with no sample is silently dropped by render/audio.js.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
{
  const idxPath = new URL('../assets/audio/index.json', import.meta.url).pathname;
  const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : {};
  const cued = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory()) { walk(`${dir}/${f.name}`); continue; }
      if (!f.name.endsWith('.js')) continue;
      for (const line of readFileSync(`${dir}/${f.name}`, 'utf8').split('\n')) {
        if (/^\s*(\/\/|\*)/.test(line) || !/audio\?\.\s*cue/.test(line)) continue;
        for (const m of line.matchAll(/'(snd_[a-z_0-9]+)'/g)) cued.add(m[1]);
      }
    }
  };
  walk(new URL('../sim', import.meta.url).pathname);
  for (const c of [...cued].sort()) {
    if (!idx[c]) failures.push(`cue ${c}: no sample in assets/audio/index.json`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL  ${f}`);
  process.exit(1);
}
console.log(`PASS  ${ATTACKS.length} practice attacks: all audible, per-frame peak <= ${PEAK_LIMIT}`);
