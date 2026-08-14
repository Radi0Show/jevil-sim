// The two-tier attack differ (docs/VERIFICATION.md, "the chapter 1 trig
// residue"). Shared by every attack suite:
//
//   Tier 1 (byte-exact): every column except aimed-bullet positions and
//   velocity accessors. Contact columns (nbul/hits) byte-exact through
//   `contactExactTo`, within `contactSlack` after (tangential flips).
//
//   Tier 2 (residue-bounded): b*_x/b*_y within driftMax px; b*_hs/b*_vs
//   within velMax (the runner's accessor disagrees with its own mover at
//   the ~1e-5 level — measured, see jevil-research probes).
//
// Returns { failed, summaryLine }. Callers add their own positive
// execution assertions.

export function diffAttackTrace({
  oracleLines,
  simLines,
  driftMax = 0.02,
  velMax = 1e-3,
  contactExactTo = 214,
  contactSlack = 3,
  // Attacks whose bullets WALL-DESPAWN (suit-bomb bursts are
  // regularbullets) compact their slots on every despawn, and a
  // single-frame despawn flip (mover-residue class) misaligns every later
  // slot column. slotMatch compares each frame's bullets as a MULTISET:
  // greedy nearest-neighbour pairing, every pair within driftMax, at most
  // `contactSlack` unmatched per frame. Stronger than suppression — the
  // positions keep being verified after a flip — but strict slot order is
  // stronger still, so suites use slotMatch only when despawn compaction
  // makes strict order meaningless.
  slotMatch = false,
  log = console.log,
}) {
  const header = oracleLines[0].split(',');
  if (simLines[0] !== oracleLines[0]) {
    log(`HEADER MISMATCH\n  oracle: ${oracleLines[0]}\n  engine: ${simLines[0]}`);
    return { failed: true };
  }

  const isPos = header.map((h) => /^b\d+_[xy]$/.test(h));
  const isVel = header.map((h) => /^b\d+_[hv]s$/.test(h));
  const isContact = header.map((h) => h === 'nbul' || h === 'hits');

  const rows = Math.min(oracleLines.length, simLines.length) - 1;
  const nbulCol = header.indexOf('nbul');
  // Cap failure logging: hundreds of lines get tail-truncated by callers
  // and the EARLIEST failures are the diagnostic ones — a session was lost
  // to reading an f80 tail line as "first divergence" when frame 0 failed.
  const LOG_CAP = 12;
  let logged = 0;
  const capLog = (msg) => {
    if (logged < LOG_CAP) log(msg);
    if (logged === LOG_CAP) log(`... further failures suppressed (earliest are above)`);
    logged++;
  };
  let failed = false;
  let firstResidue = null;
  let residueCells = 0;
  let worstDrift = 0;
  let worstVel = 0;
  let contactFlips = 0;
  let slotsSuppressedFrom = null;

  // Column index groups for slotMatch: per-slot [x, y] (and hs/vs ride
  // along but are checked via the pairing, not by column).
  const slotCols = [];
  if (slotMatch) {
    for (let c = 0; c < header.length; c++) {
      const m = header[c].match(/^b(\d+)_x$/);
      if (m) slotCols.push({ x: c, y: c + 1 });
    }
  }

  for (let i = 1; i <= rows; i++) {
    const oc = oracleLines[i].split(',');
    const sc = simLines[i].split(',');

    if (slotMatch) {
      const frame = i - 1;
      const parse = (cells) =>
        slotCols
          .filter((s) => cells[s.x] !== '' && cells[s.x] !== undefined)
          .map((s) => ({ x: parseFloat(cells[s.x]), y: parseFloat(cells[s.y]) }));
      const ob = parse(oc);
      const sb = parse(sc);
      const used = new Set();
      let unmatched = 0;
      for (const o of ob) {
        let best = -1;
        let bestD = Infinity;
        for (let k = 0; k < sb.length; k++) {
          if (used.has(k)) continue;
          const d = Math.max(Math.abs(sb[k].x - o.x), Math.abs(sb[k].y - o.y));
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (best >= 0 && bestD <= driftMax) {
          used.add(best);
          residueCells += bestD > 0 ? 1 : 0;
          worstDrift = Math.max(worstDrift, bestD);
          if (bestD > 0 && !firstResidue) firstResidue = { frame, col: 'slotMatch' };
        } else {
          unmatched++;
        }
      }
      unmatched += sb.length - used.size;
      if (unmatched > contactSlack) {
        capLog(`SLOT-MATCH FAIL at frame ${frame}: ${unmatched} bullets unpaired within ${driftMax}px (oracle ${ob.length}, engine ${sb.length})`);
        failed = true;
      }
      // Non-slot columns still compare below; skip the per-column slot
      // checks by blanking them out of this row's comparison.
      for (const s of slotCols) {
        oc[s.x] = sc[s.x] = '';
        oc[s.y] = sc[s.y] = '';
        // hs/vs columns sit right after y when present.
        if (/^b\d+_hs$/.test(header[s.y + 1] ?? '')) {
          oc[s.y + 1] = sc[s.y + 1] = '';
          oc[s.y + 2] = sc[s.y + 2] = '';
        }
      }
      // nbul under slotMatch: bounded, not byte-exact (despawn flips).
      if (nbulCol >= 0 && oc[nbulCol] !== sc[nbulCol]) {
        const d = Math.abs(parseFloat(oc[nbulCol]) - parseFloat(sc[nbulCol]));
        if (d > contactSlack) {
          capLog(`COUNT FAIL at frame ${frame}: nbul oracle=${oc[nbulCol]} engine=${sc[nbulCol]}`);
          failed = true;
        }
        oc[nbulCol] = sc[nbulCol] = '';
      }
    }

    // KNIGHT'S FULLFIGHT RULE: a count divergence shifts every slot at
    // once. Once nbul differs (a tangential contact flip past the exact
    // window — bounded below), the positional columns compare misaligned
    // bullets and would report forty false faults for one flip. Suppress
    // slot columns from that frame; mechanics columns keep comparing.
    if (
      slotsSuppressedFrom === null &&
      nbulCol >= 0 &&
      oc[nbulCol] !== sc[nbulCol] &&
      i - 1 > contactExactTo &&
      Math.abs(parseFloat(oc[nbulCol]) - parseFloat(sc[nbulCol])) <= contactSlack
    ) {
      slotsSuppressedFrom = i - 1;
    }
    for (let c = 0; c < header.length; c++) {
      if (oc[c] === sc[c]) continue;
      const frame = i - 1;
      if (slotsSuppressedFrom !== null && (isPos[c] || isVel[c])) continue;
      if (isContact[c] && frame > contactExactTo) {
        const diff = Math.abs(parseFloat(oc[c]) - parseFloat(sc[c]));
        if (diff > contactSlack) {
          capLog(`CONTACT FAIL at frame ${frame}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]}`);
          failed = true;
        } else if (header[c] === 'hits') {
          contactFlips = Math.max(contactFlips, diff);
        }
        continue;
      }
      if (isVel[c]) {
        const diff = Math.abs(parseFloat(oc[c]) - parseFloat(sc[c]));
        if (Number.isNaN(diff) || diff > velMax) {
          capLog(`VEL FAIL at frame ${frame}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]}`);
          failed = true;
        } else {
          worstVel = Math.max(worstVel, diff);
        }
        continue;
      }
      if (!isPos[c]) {
        capLog(`TIER-1 FAIL at frame ${frame}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]}`);
        failed = true;
        continue;
      }
      const drift = Math.abs(parseFloat(oc[c]) - parseFloat(sc[c]));
      if (Number.isNaN(drift) || drift > driftMax) {
        capLog(`TIER-2 FAIL at frame ${frame}, ${header[c]}: oracle=${oc[c]} engine=${sc[c]} (drift ${drift})`);
        failed = true;
        continue;
      }
      residueCells++;
      worstDrift = Math.max(worstDrift, drift);
      if (!firstResidue) firstResidue = { frame, col: header[c] };
    }
    if (failed && i > 80) break;
  }

  const summaryLine =
    `${rows} rows: mechanics byte-exact (contact cols to f${contactExactTo}); ` +
    (firstResidue
      ? `trig residue from f${firstResidue.frame} (${firstResidue.col}), ` +
        `${residueCells} cells, worst ${worstDrift.toExponential(2)} px` +
        (worstVel ? `, vel ${worstVel.toExponential(2)}` : '') +
        (contactFlips ? `, ${contactFlips} tangential flip(s)` : '') +
        (slotsSuppressedFrom !== null
          ? `; slots suppressed from f${slotsSuppressedFrom} (count flip)`
          : '')
      : 'positions byte-exact too');

  return { failed, summaryLine };
}
