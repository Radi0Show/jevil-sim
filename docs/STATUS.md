# STATUS

Updated 2026-08-15. CORE VERIFICATION COMPLETE — all three
whole-fight endings replay byte-exact (23 suites green).

## Done, verified

- **Recon complete.** Dump accounting closed. Fight table in CLAUDE.md;
  citations in ~/jevil-research/notes/recon-findings.md. Dead content
  listed (jattack 99/999; dc types 45, 55-58, 60, 66, 67).
- **Engine skeleton** (knight-sim core) + determinism (10 scenes x 10 runs).
- **Chapter 1 RNG**: WELL512, identical to chapter 3 — 7/7 probe sections.
- **T3 soul + battle box**: 3 recordings x 600 frames, ALL columns
  byte-exact, sabotage-tested.
- **Attack 1 — dc.type 70** (teleport five-spade fans, jattack 0).
- **Attack 2 — dc.type 65** (spade rings, jattack 1).
- **Attack 3 — dc.type 49** (heart suit bombs + orbiting blasts, jattack 2).
  All two-tier verified per docs/VERIFICATION.md, each sabotage-tested.
- Translated and awaiting their recordings' suites: dc.type 68 (side
  rings + wspeed 5), 71 (single-diamond teleports), plus the suitbomb
  variants 46/48/50 (code shared with 49; each still gets its own trace).

## Chapter-1 runtime facts (all measured; details in HANDOFF.md)

1. GML VM evaluates function args RIGHT-TO-LEFT (choose with random args).
2. Real comparisons use math_set_epsilon (1e-5) — gml.js gmlGreater/Less.
3. Instance iteration is NEWEST-FIRST (GM8 legacy; ch3 is oldest-first).
4. ONE collision routine for every mask pairing: raw positions,
   round-half-even bbox, pixel-intersection (ch3's floored-corner
   precise-A rule does not carry).
5. Aimed-bullet velocity passes through single-precision trig that JS
   cannot bit-match — THE documented deviation (max drift 3.3e-3 px per
   600-frame window; docs/VERIFICATION.md).
6. Plain obj_collidebullet has no Step — bullets never despawn offscreen.
7. snd_play consumes no RNG (bare audio_play_sound).
8. GML `type` on instances translates as `gmlType` (collides with the
   engine's handler ref).

## Current wave (lifecycle + damage session)

- ALL 16 attacks verified (see VERIFICATION.md). Fight selector + full
  enemy-turn lifecycle translated (sim/joker.js, sim/fight.js); fight mode
  on the page with debug FIGHT/PACIFY keys and both endings.
- Damage system translated (sim/damage.js) with three more original bugs
  preserved; graze system translated (sim/graze.js) with the measured
  per-bullet graze-then-damage pair interleave, newest-first.
- verify-live GREEN (two-tier): live-70/65 to the wipe. Root causes of the
  last desyncs, all measured: obj_dmgwriter consumes RNG on every hit
  (random(600) at create + random(2) next draw frame — now consumed by
  scrDamage/stepFrame); the probe stage is a FRESH-FILE party (char
  [1,0,0], charcantarget all 0 — scr_gamestart); and the DEATH-FRAME
  G-SKIP, a real runtime quirk: the runner sometimes skips a dying
  bullet's grazebox event though its own place_meeting says overlap
  (event-order probe, 29/104 contact deaths). Sim keeps the majority
  order (per-bullet [graze, hit], newest-first); the suite enforces the
  one-sided envelope. verify-grazepair holds the 3,600-verdict pair-model
  sweeps (0 missed hits; the 8 corner-band rows reclassified as
  dispatch skips, not geometry).
- LATENT ORIGINAL CRASH found (charinstance[3] on wipe-window redirects) —
  plausibly the PS4 v1.03 fix; see HANDOFF.

- WHOLE-FIGHT HARNESS GREEN (verify-fullfight): defend-only fight through
  real menus to the wipe, 1,020 rows byte-exact (slots within the f32
  residue; 3 one-sided graze-surplus steps absorbed). Chapter 1 menu
  translated (sim/menu.js); obj_moveheart flight; random(0) CONSUMES —
  writer/astream presentation draws replayed via a logged side-channel.

- FIGHT-PATH FULLFIGHT GREEN: 3,442 rows to the KILL (immortal-party
  scenario, AT 30) — attack bar, swing damage, TP/15, HP gates, phase 5,
  the i-clobber handoff bug, turn-aligned differ. Both whole-fight
  oracles in one suite.

## Presentation progress (2026-08-15, same session)

- **Sprite pack shipped**: 103 sprites / 369 frames with origins manifest,
  dims-checked (tools/pack-sprites.mjs); sprite-first renderer with mask
  fallback, GML string colour tints. Verified: Carousel gray back-faces,
  FINAL CHAOS scythes/pillars, fight-mode Jevil.
- **Fonts shipped**: fnt_mainbig/main/dotumche (glyph advance tables);
  menu lists render in real glyphs (JEVIL target row + monster HP bar,
  ACT list, spell list with the Pacify aqua glow, TP "N %"/"MAX").
- **Battle UI first pass**: band + charboxes (mmy rise), buttons, heads,
  nameplates, hpfont readouts, HP bars, tension bar chase, attack-bar
  lanes/bolts, damage numbers.

- **Audio shipped**: 35-sample pack + joker.ogg loop, full cue sweep at
  the GML play sites, two suites (audibility/stacking/index coverage +
  dump-derived sound coverage with traced excuses). 25 suites total.

- **Battle text shipped**: Jevil's clubs talk balloon (every jturn line +
  hold rr/alt pairs from lang_en.json, typer reveal) and the bottom
  flavor line with its override ladder. Presentation session also
  landed: hero pose machine at 2x, jokerbg port, obj_joker_body port
  (hurt head-swing, shadow dance), darkener, two-layer battle box,
  startup music, the charbox layering fix, and the battleat freeze fix.

## Next

1. Replay tokens (?seed= exists; add input recording/replay in the URL).
2. Deploy (Pages) — BLOCKED on user authorization: this repo's standing
   rule is commits local, never pushed.
3. (If a scenario ever pirouettes) obj_healanim star sprays — the one
   unmodeled RNG consumer, currently avoided by the pacify route.

## Whole-fight verification (2026-08-15)

- fullfight-defend: 1,020 rows PASS (3 one-sided graze steps absorbed).
- fullfight-fight: 3,442 rows PASS (18 graze steps) — violence ending.
- fullfight-pacify: 7,086 rows PASS (32 graze steps) — TIRED + Pacify
  ending, jturn -1 at f7085 = spellphase +5 (alarm0) +15 (hero alarm4).
- verify-contact replays ALL THREE sweep datasets (9,600 verdicts):
  corner sampler + untransformed fast path (HANDOFF Facts 5 & 6).
- a74 full-window byte-exact — the vert-diamond "effective mask" chase
  was a collision-routine gap, now closed.
- Seven sabotages verified red: fast-path rounding, fast-path removal,
  gate order, TIRED pre-increment, box lifecycle, pillar shake, spell
  strike timing.
