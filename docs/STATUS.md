# STATUS

Updated 2026-08-14.

## Done, verified

- **Recon complete.** Dump accounting closed (1,680 entries, every negative
  grep trustworthy). Fight table in CLAUDE.md ("THE REAL FIGHT"), full
  citations in ~/jevil-research/notes/recon-findings.md. Dead content listed
  (jattack 99/999; dc types 45, 55-58, 60, 66, 67).
- **T2 — engine skeleton.** Boss-agnostic core from knight-sim (clock, rng,
  entity, trace, gml, lerpvar, masks/collision model, differ, devserver,
  stub scene). verify-determinism: 7 scenes, 10/10 byte-identical + seed
  sensitivity.
- **T3 — chapter 1 soul + battle box. VERIFIED against the real game.**
  Three oracle recordings (hold-right, focus-at-20, corner diagonal), 600
  frames each, byte-exact all columns (`node tools/verify-t3.mjs`).
  Sabotage-tested (wspeed 4→5 fails all three at frame 0).
  - sim/soul.js — ch1 obj_heart line-for-line (corner-slide assists, doubled
    meeting tests, no canmove/flag22/yellow-soul).
  - sim/battlebox.js — ch1 obj_growtangle, fixed 2x2, no custom-arena path.
  - Masks: spr_dodgeheartmask + spr_battlebg_0 bit-identical to chapter 3's
    (verified), so knight-sim's calibrated collision model carries with its
    evidence. Data regenerated from the ch1 dump regardless.

## Known limits / debts

- **ceil-vs-floor in the focus halving is NOT discriminated at wspeed 4**
  (4·0.5 = 2 exactly). It matters at wspeed 5 — dc.type 68 sets that — so
  the type-68 attack suite MUST include a focus window to pin it.
- The box grow-in (15-frame ramp, spinning fractional-scale mask) is not
  collision-modelled; T3 recordings start after the box settles. Same
  posture knight-sim shipped with; needs its own trace if an attack overlaps
  the grow window.
- obj_grazebox is not yet an entity; stepFrame tracks grazePrev only. The
  graze/TP system lands with its own suite (chapter 1 semantics read:
  first-contact grazepoints + trickle /20, turntimer shortening — see
  jevil-research notes).

## Next (PLAYBOOK §10 order)

1. RNG identity probe for chapter 1 (WELL512 assumed, never trusted).
2. First attack end-to-end: jattack 0 → dc.type 70 (obj_joker_teleport,
   5-spade fan) through the oracle recipe.
3. Attack by attack in fight order; then the scheduler; then presentation.
