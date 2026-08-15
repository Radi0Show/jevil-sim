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
  HEART_MASK, SPADEBULLET_MASK, CLUBSBULLET_MASK, SCYTHEBODY_MASK,
  CAROUSEL_MASK, DIAMONDBULLET_VERT_MASK, HEARTBULLET_MASK, masksOverlap,
} from '../sim/masks.js';

// Three sweeps, three generations of the model:
//   contact-probe.csv  (2,400) — clubs/spades/scythe, rotated + scaled:
//                      pins the corner-sampling routine.
//   contact-probe2.csv (4,800) — adds carousel negative scales, the
//                      vert diamond and the rotating heartbullet. cfg6
//                      (diamond, angle 0 scale 1) was 36 points wrong
//                      until the untransformed fast path landed.
//   contact-probe3.csv (2,400) — heartbullet at angle 0 scale 1 brushing
//                      the heart's bottom slope (the fullfight-pacify
//                      f5503 family): pins the fast path's half-even
//                      position rounding (0/2400; round-half-up is 6 off).
const DATASETS = [
  ['contact-probe.csv', {
    0: [CLUBSBULLET_MASK, 1], 1: [SPADEBULLET_MASK, 1],
    2: [SPADEBULLET_MASK, 1], 3: [SCYTHEBODY_MASK, 1],
  }],
  ['contact-probe2.csv', {
    0: [CLUBSBULLET_MASK, 1], 1: [SPADEBULLET_MASK, 1],
    2: [SPADEBULLET_MASK, 1], 3: [SCYTHEBODY_MASK, 1],
    4: [CAROUSEL_MASK, 2], 5: [CAROUSEL_MASK, 2],
    6: [DIAMONDBULLET_VERT_MASK, 1], 7: [HEARTBULLET_MASK, 1],
  }],
  ['contact-probe3.csv', {
    0: [HEARTBULLET_MASK, 1], 1: [HEARTBULLET_MASK, 1],
    2: [HEARTBULLET_MASK, 1], 3: [HEARTBULLET_MASK, 1],
  }],
];

let allBad = 0;
for (const [file, cfgMap] of DATASETS) {
  const path = join(homedir(), 'jevil-research', 'traces', file);
  if (!existsSync(path)) {
    console.log(`MISSING ${path}`);
    process.exit(1);
  }
  const rows = readFileSync(path, 'utf8').replace(/\r/g, '').trim().split('\n').slice(1);
  let bad = 0;
  let hits = 0;
  for (const l of rows) {
    const [cfg, , x, y, a, s, hit] = l.split(',').map(parseFloat);
    const [mask, syFixed] = cfgMap[cfg];
    const sy = syFixed === 2 ? 2 : s;
    const got = masksOverlap(HEART_MASK, 314, 162, mask, x, y, s, sy, a) ? 1 : 0;
    if (got !== hit) {
      if (bad < 5) console.log(`MISMATCH ${file} cfg${cfg} (${x},${y}) a=${a} s=${s}: want ${hit} got ${got}`);
      bad++;
    }
    hits += hit;
  }
  // Positive assertions: every config needs real hits AND real misses, or
  // the replay proves nothing.
  for (const c of Object.keys(cfgMap)) {
    const rs = rows.filter((l) => l.startsWith(c + ','));
    const h = rs.filter((l) => l.endsWith(',1')).length;
    if (h === 0 || h === rs.length) {
      console.log(`DEGENERATE ${file} config ${c}: ${h}/${rs.length} hits — sweep uninformative`);
      bad++;
    }
  }
  if (bad) {
    console.log(`FAIL  ${file}: ${bad} mismatches of ${rows.length}`);
    allBad += bad;
  } else {
    console.log(`PASS  ${file}: ${rows.length} verdicts reproduced (${hits} hits)`);
  }
}
process.exit(allBad ? 1 : 0);
