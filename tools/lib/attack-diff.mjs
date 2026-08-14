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

  for (let i = 1; i <= rows; i++) {
    const oc = oracleLines[i].split(',');
    const sc = simLines[i].split(',');
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
