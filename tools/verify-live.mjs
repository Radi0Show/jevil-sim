#!/usr/bin/env node
// Damage + graze acceptance: the REAL chapter 1 damage and graze paths
// against unsterilized recordings.
//
//   node tools/verify-live.mjs
//
// Two live recordings (oracle_live_probe.csx): dc.type 70 (aimed fans —
// hits, target redirection, downs) and dc.type 65 (spade rings — heavy
// graze traffic: first-contact TP, trickle, turn shortening).
//
// TWO-TIER CLAIM (see the runCollisions comment in sim/index.js):
//   1. soul, hp1-3, inv, nbul (±2 residue), gameover — byte-exact to the
//      wipe.
//   2. tension / turntimer — byte-exact EXCEPT the death-frame G-skip: on
//      a minority of frames where a bullet dies on the heart, the runner
//      never dispatches that bullet's grazebox event (a deterministic
//      runtime-internal toggle; measured 27/93 + 2/11 contact deaths in
//      traces/pairorder3-{65,70}-events.csv, with the runner's own
//      place_meeting reporting overlap). The sim always grazes first, so
//      the envelope is one-sided and event-bound:
//        tension_sim >= tension_oracle,  tt_sim <= tt_oracle,
//        each offset changes ONLY on a frame where the bullet count
//        drops (a death) or a hit lands, by at most one bullet's award
//        (grazepoints / timepoints), cumulative cap 2 awards.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runTraceFull } from './run-trace.mjs';

const PAIRS = [
  // [trace, scene, grazepoints, timepoints]
  ['live-70.csv', 'live-70', 2, 1],
  ['live-65.csv', 'live-65', 3, 1],
];

let failed = false;
for (const [trace, scene, grazepoints, timepoints] of PAIRS) {
  const oraclePath = join(homedir(), 'jevil-research', 'traces', trace);
  if (!existsSync(oraclePath)) {
    console.log(`MISSING ${oraclePath}`);
    failed = true;
    continue;
  }
  const oracleLines = readFileSync(oraclePath, 'utf8').replace(/\r/g, '').replace(/\n$/, '').split('\n');
  const { csv, counters } = runTraceFull({ seed: 1, frames: 600, scene });
  const simLines = csv.replace(/\n$/, '').split('\n');
  if (simLines[0] !== oracleLines[0]) {
    console.log(`${scene}: HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
    failed = true;
    continue;
  }
  const hdr = oracleLines[0].split(',');
  const col = (n) => hdr.indexOf(n);
  const nbulCol = col('nbul');
  const tenCol = col('tension');
  const ttCol = col('tt');
  const invCol = col('inv');
  const goCol = col('gameover');

  // The claim window ends at the party wipe: past it the original CRASHES
  // (charinstance[3] — latent bug the probe absorbs with a stand-in) and
  // the runner's post-wipe behaviour is not gameplay.
  let rows = Math.min(oracleLines.length, simLines.length) - 1;
  for (let i = 1; i <= rows; i++) {
    if (oracleLines[i].split(',')[goCol] === '1') { rows = i; break; }
  }

  let bad = null;
  let badWhy = '';
  let nbulFlips = 0;
  let skipAwards = 0; // death-frame G-skips absorbed
  let prevTenOff = 0;
  let prevTtOff = 0;
  let prevNbulO = null;
  for (let i = 1; i <= rows && bad === null; i++) {
    const oc = oracleLines[i].split(',');
    const sc = simLines[i].split(',');
    const nbulO = parseFloat(oc[nbulCol]);
    const deathFrame =
      (prevNbulO !== null && nbulO < prevNbulO) ||
      parseFloat(oc[invCol]) > parseFloat(sc[invCol]) - 1e-9 && oc[invCol] !== sc[invCol];
    for (let c = 0; c < hdr.length && bad === null; c++) {
      if (oc[c] === sc[c]) continue;
      if (c === nbulCol) {
        const d = Math.abs(nbulO - parseFloat(sc[c]));
        if (d <= 2) { nbulFlips = Math.max(nbulFlips, d); continue; }
        bad = i - 1; badWhy = 'nbul';
      } else if (c === tenCol || c === ttCol) {
        const tenOff = parseFloat(sc[tenCol]) - parseFloat(oc[tenCol]);
        const ttOff = parseFloat(oc[ttCol]) - parseFloat(sc[ttCol]);
        // one-sided
        if (tenOff < -1e-9 || ttOff < -1e-9) { bad = i - 1; badWhy = 'graze offset wrong side'; break; }
        // offsets only move on a death frame, by at most one award
        const dTen = tenOff - prevTenOff;
        const dTt = ttOff - prevTtOff;
        if (Math.abs(dTen) > 1e-9 || Math.abs(dTt) > 1e-9) {
          const okStep =
            dTen > -1e-9 && dTen <= grazepoints + 1e-9 &&
            dTt > -1e-9 && dTt <= timepoints + 1e-9;
          const prevDeath = deathFrame;
          if (!okStep || !prevDeath) { bad = i - 1; badWhy = 'graze offset moved off a death frame or oversized'; break; }
          skipAwards += 1;
          if (skipAwards > 2) { bad = i - 1; badWhy = 'more than 2 G-skip awards'; break; }
          prevTenOff = tenOff;
          prevTtOff = ttOff;
        }
      } else {
        bad = i - 1; badWhy = hdr[c];
      }
    }
    prevNbulO = nbulO;
  }
  if (bad !== null) {
    console.log(`FAIL  ${scene}: first divergence at frame ${bad} (${badWhy})`);
    console.log(`        oracle: ${oracleLines[bad + 1]}`);
    console.log(`        engine: ${simLines[bad + 1]}`);
    failed = true;
  } else if (counters.collisionHits < 3) {
    console.log(`FAIL  ${scene}: positive assertion — only ${counters.collisionHits} hits`);
    failed = true;
  } else {
    const notes = [];
    if (nbulFlips) notes.push(`nbul residue ${nbulFlips}`);
    if (skipAwards) notes.push(`${skipAwards} death-frame G-skip award(s) absorbed`);
    console.log(`PASS  ${scene.padEnd(8)} ${rows} rows to the wipe${notes.length ? ' (' + notes.join('; ') + ')' : ''} (hits=${counters.collisionHits})`);
  }
}
process.exit(failed ? 1 : 0);
