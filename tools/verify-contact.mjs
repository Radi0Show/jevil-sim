#!/usr/bin/env node
// Collision-model acceptance: replay the chapter 1 contact sweep.
//
//   node tools/verify-contact.mjs
//
// jevil-research traces/contact-probe.csv holds 2,400 engine pair-test
// verdicts recorded in the real game (oracle_contact_probe.csx): a probe
// bullet swept in quarter-pixel steps across the heart's mask edges in
// four configurations — clubs scale 1 rotated (AxisAlignedRect sprite),
// spades at 0.4 and 1.0 (Precise), and the scythe-body mask override
// rotating through 360 degrees. masksOverlap must reproduce every verdict.
//
// This is the suite that pins: raw positions + round-half-even bbox
// integerisation + pixel-corner sampling, axis-rect B solidity, and the
// mask_index override. Every attack's contact behaviour rides on it.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  HEART_MASK, SPADEBULLET_MASK, CLUBSBULLET_MASK, SCYTHEBODY_MASK, masksOverlap,
} from '../sim/masks.js';

const path = join(homedir(), 'jevil-research', 'traces', 'contact-probe.csv');
if (!existsSync(path)) {
  console.log(`MISSING ${path}`);
  process.exit(1);
}

const CFG_MASK = { 0: CLUBSBULLET_MASK, 1: SPADEBULLET_MASK, 2: SPADEBULLET_MASK, 3: SCYTHEBODY_MASK };

const rows = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n').slice(1);
let bad = 0;
let hits = 0;
for (const l of rows) {
  const [cfg, , x, y, a, s, hit] = l.split(',').map(parseFloat);
  const got = masksOverlap(HEART_MASK, 314, 162, CFG_MASK[cfg], x, y, s, s, a) ? 1 : 0;
  if (got !== hit) {
    if (bad < 5) console.log(`MISMATCH cfg${cfg} (${x},${y}) a=${a} s=${s}: want ${hit} got ${got}`);
    bad++;
  }
  hits += hit;
}

// Positive assertions: the sweep must contain real hits AND real misses in
// every config, or the replay proves nothing.
const perCfg = [0, 1, 2, 3].map((c) => {
  const rs = rows.filter((l) => l.startsWith(c + ','));
  const h = rs.filter((l) => l.endsWith(',1')).length;
  return { c, total: rs.length, hits: h };
});
for (const { c, total, hits: h } of perCfg) {
  if (h === 0 || h === total) {
    console.log(`DEGENERATE config ${c}: ${h}/${total} hits — sweep uninformative`);
    bad++;
  }
}

if (bad) {
  console.log(`FAIL  ${bad} mismatches of ${rows.length}`);
  process.exit(1);
}
console.log(`PASS  ${rows.length} pair-test verdicts reproduced (${hits} hits) across 4 configs`);
