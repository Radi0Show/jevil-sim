#!/usr/bin/env node
// Import collision masks from the chapter 1 dump into sim/data/masks.json.
//
//   node tools/import-masks.mjs
//
// Source: ~/jevil-research/gml_dump/_masks/mask_<sprite>.txt, produced by
// jevil-research/tools/patches/dump_defs.csx ('#'/'.' rows straight from the
// data file's bit-packed masks). This tool copies ONLY the sprites named in
// WANTED below — the repo ships the masks the fight uses, nothing else.
//
// After running: node tools/gen-masks.mjs (sim/ never reads the filesystem).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SRC = join(homedir(), 'jevil-research', 'gml_dump', '_masks');

// key in masks.json -> sprite name in the data file
const WANTED = {
  heart: 'spr_dodgeheartmask',
  battlebg: 'spr_battlebg_0',
  graze: 'spr_grazemask',
};

function parse(spriteName) {
  const path = join(SRC, `mask_${spriteName}.txt`);
  if (!existsSync(path)) throw new Error(`no mask dump at ${path}`);
  const lines = readFileSync(path, 'utf8').split('\n');
  const meta = {};
  for (const l of lines.slice(0, 4)) {
    for (const m of l.matchAll(/(\w+)=([\d,]+)/g)) meta[m[1]] = m[2];
  }
  const w = Number(meta.w), h = Number(meta.h);
  let rows = lines
    .filter((l) => /^[#.]+$/.test(l))
    .map((l) => l.replace(/#/g, '1').replace(/\./g, '0'));
  // sepmasks=AxisAlignedRect with maskcount=0 stores NO pixel data: the mask
  // is the bbox rectangle itself (spr_grazemask is one). Synthesize it so the
  // downstream model has one representation for every mask.
  if (rows.length === 0 && /AxisAlignedRect/.test(lines[3] ?? '')) {
    const [bl, bt, br, bb] = meta.bbox.split(',').map(Number);
    rows = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) =>
        x >= bl && x <= br && y >= bt && y <= bb ? '1' : '0').join(''));
  }
  // Multiple masks concatenate; GameMaker uses mask 0 at image_index 0. Take
  // the first h rows, but assert every extra mask is identical first — a
  // sprite whose frames have DIFFERENT masks needs modelling, not truncating.
  const first = rows.slice(0, h);
  for (let m = 1; m * h < rows.length; m++) {
    const other = rows.slice(m * h, (m + 1) * h);
    if (JSON.stringify(other) !== JSON.stringify(first)) {
      console.error(`WARNING: ${spriteName} mask ${m} differs from mask 0 — using mask 0; ` +
        `model per-frame masks before relying on frames > 0`);
      break;
    }
  }
  if (first.length !== h || first.some((r) => r.length !== w)) {
    throw new Error(`${spriteName}: parsed ${first.length} rows, expected ${h}x${w}`);
  }
  return {
    name: spriteName,
    w, h,
    originX: Number(meta.ox), originY: Number(meta.oy),
    bbox: meta.bbox.split(',').map(Number),
    rows: first,
  };
}

const out = {};
for (const [key, sprite] of Object.entries(WANTED)) out[key] = parse(sprite);
const dst = new URL('../sim/data/masks.json', import.meta.url);
writeFileSync(dst, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote sim/data/masks.json (${Object.keys(out).join(', ')})`);
