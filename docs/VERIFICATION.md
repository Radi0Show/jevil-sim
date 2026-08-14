# VERIFICATION

What "verified" means in this project, and the one documented deviation.

## The standard

Same as knight-sim (docs/PLAYBOOK.md §3): per attack, an instrumented copy
of the real game records one CSV row per frame; the sim replays the same
seed and inputs headless; the differ compares cell for cell. Suites are
sabotage-tested — a suite whose failure has never been demonstrated proves
nothing.

## The chapter 1 trig residue (documented deviation)

Chapter 1 ships an older GameMaker runtime than chapter 3. Its runtime
pipeline for AIMED bullets (move_towards_point / the direction setter)
derives velocity through single-precision trig whose exact bit behaviour JS
does not reproduce; the effective flight direction can sit up to ~1.5e-4
degrees (≈10 f32 ulps) from the assigned f32 direction value, and the
runner's own hspeed/vspeed READ-ACCESSOR disagrees with the velocity its
mover actually integrates (all measured — jevil-research
traces/{trig,pointdir,mover}-probe.csv and a70-wide.csv's hs/vs columns;
knight-sim's ch3 runner has no such gap, its motion matched JS trig
byte-exactly).

Consequences, bounded by measurement:

- Aimed-bullet positions can drift **1 f32 ulp per frame at worst** in
  coarse grid zones. Over a full 600-frame window the worst observed
  drift is 3.3e-3 px — invisible at any display scale.
- A TANGENTIAL contact (bullet skimming the heart mask edge) can flip by
  one frame / one hit past the drift horizon.

Suites therefore verify **two tiers**: everything except aimed-bullet
position cells byte-exact (soul, spawners, state machines, timers, RNG
consumption, spawn positions); aimed positions byte-exact until the first
residue cell and within 0.02 px after (100x the worst measured residue,
100x under any real logic error — sabotage runs show a 1-degree fan error
trips the bound within 13 frames at 0.06 px).

Bit-exactness would need the runner's sinf/cosf/atan2f disassembled (the
knight ds_list_shuffle precedent: black-box probing stopped converging).
The probes and wide traces are preserved for that hunt.

## Verified so far

| suite | claim |
|---|---|
| verify-determinism | 8 scenes x 10 runs byte-identical + seed sensitivity |
| verify-rng | WELL512 + seeding + all five call mappings vs 131 in-game values |
| verify-t3 | soul movement: 3 recordings x 600 frames, ALL columns byte-exact |
| verify-a70 | teleport spade fans: 600 frames two-tier, sabotage-tested both tiers |
| verify-a65/-a68 | spade rings both variants |
| verify-a49/-a50/-a48/-a46 | all four suit-bomb attacks incl. Chaos Bomb |
| verify-a71 | single-diamond teleports |
| verify-a62/-a61 | both carousels (negative-xscale mirror rule; a61 byte-exact incl. the Everyman roll) |
| verify-a75/-a76 | Devilsknife both variants (epsilon dirspeed cap) |
| verify-a72 | Three-Club Attack |
| verify-a73 | Diamond Release (byte-exact positions) |
| verify-a74 | Diamond Release II — NARROWED: one f136 hit-flip documented (vert-diamond effective mask open) |
| verify-a77 | FINAL CHAOS: full scripted arc byte-exact |

All 16 live attack types of the fight are covered — 15 at the full
two-tier standard, one narrowed with its cause recorded.
