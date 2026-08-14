#!/usr/bin/env node
// Run every verification suite. This is the project's health check.
//
//   export PATH="$HOME/tools/node/bin:$PATH"
//   node tools/verify-all.mjs
//
// If this is green, the engine reproduces the real game everywhere it claims
// to. Run it before and after any change to sim/.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));

// TWO KINDS OF SUITE, and the difference is where the truth lives.
//
// The oracle suites diff against recordings in `~/jevil-research/traces/` —
// the PRIVATE repo, which is never published and does not exist on a CI
// runner or a fresh clone. The rest are self-contained. Skipping the oracle
// suites on a machine without the traces is right, but it must be LOUD.
const ORACLE_DIR = join(homedir(), 'jevil-research', 'traces');
const HAVE_ORACLE = existsSync(ORACLE_DIR);

/** A suite needs the oracle if it reads a trace. Detected, not hand-listed. */
function needsOracle(file) {
  try {
    const src = readFileSync(join(here, file), 'utf8');
    return /jevil-research|traces\//.test(src);
  } catch {
    return false;
  }
}

const SUITES = [
  ['verify-determinism.mjs', 'byte-identical across 10 runs'],
  ['verify-rng.mjs', "GameMaker's RNG (WELL512) reproduced — chapter 1 probe"],
  ['verify-t3.mjs', 'chapter 1 soul movement — three oracle recordings'],
  ['verify-contact.mjs', 'collision model — 2,400 recorded pair-test verdicts'],
  ['verify-a70.mjs', 'attack 1: teleport spade fans (dc.type 70, jattack 0)'],
  ['verify-a65.mjs', 'attack 2: spade rings (dc.type 65, jattack 1)'],
  ['verify-a49.mjs', 'attack 3: heart suit bombs (dc.type 49, jattack 2)'],
  ['verify-a50.mjs', 'attack 6: club suit bombs (dc.type 50, jattack 5)'],
  ['verify-a48.mjs', 'attack 10: spade suit bombs (dc.type 48, jattack 9)'],
  ['verify-a46.mjs', 'attack 14: Chaos Bomb (dc.type 46, jattack 13)'],
  ['verify-a68.mjs', 'attack 8: side spade rings + speedup (dc.type 68, jattack 7)'],
  ['verify-a71.mjs', 'attack 13: single-diamond teleports (dc.type 71, jattack 12)'],
  ['verify-a75.mjs', 'attack 4: Spinning Scythes (dc.type 75, jattack 3)'],
  ['verify-a61.mjs', 'attack 9: Carousel II (dc.type 61, jattack 8)'],
  ['verify-a76.mjs', 'attack 12: Spinning Scythes II (dc.type 76, jattack 11)'],
  ['verify-a72.mjs', 'attack 11: Three-Club Attack (dc.type 72, jattack 10)'],
  ['verify-a73.mjs', 'attack 7: Diamond Release (dc.type 73, jattack 6)'],
  ['verify-a77.mjs', 'attack 16: FINAL CHAOS (dc.type 77, jattack 15)'],
  // verify-a62 / verify-a74 pend the negative-scale contact probe
  // (single hit-flip each; see HANDOFF).
];

// EVERY suite file must be in the table. A suite that exists and is never run
// is worse than no suite: it looks like coverage and checks nothing.
const listed = new Set(SUITES.map(([f]) => f));
const onDisk = readdirSync(here)
  .filter((f) => /^verify-.*\.mjs$/.test(f) && f !== 'verify-all.mjs');
const unregistered = onDisk.filter((f) => !listed.has(f));
if (unregistered.length) {
  console.log(`UNREGISTERED SUITES (in tools/ but never run): ${unregistered.join(', ')}`);
  console.log('Add them to SUITES in tools/verify-all.mjs.\n');
}

let failed = 0;
let skipped = 0;
const width = Math.max(...SUITES.map(([f]) => f.length));

for (const [file, what] of SUITES) {
  if (!HAVE_ORACLE && needsOracle(file)) {
    skipped++;
    console.log(`SKIP  ${file.padEnd(width)}  ${what}`);
    continue;
  }
  const r = spawnSync(process.execPath, [join(here, file)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${file.padEnd(width)}  ${what}`);
  if (!ok) {
    for (const line of out.trimEnd().split('\n').slice(-6)) console.log(`        ${line}`);
  }
}

console.log('');
if (skipped) {
  console.log(`${skipped} oracle suites SKIPPED — no ${ORACLE_DIR}.`);
  console.log('Those are the ones that diff against recordings of the real game.');
  console.log('This run proves the self-contained half only.\n');
}
console.log(failed ? `${failed} SUITE(S) FAILED` : `all ${SUITES.length - skipped} suites passed`);
process.exit(failed ? 1 : 0);
