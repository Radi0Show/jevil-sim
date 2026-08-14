# STATUS

Updated 2026-08-14 (end of first build session).

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

## Next (PLAYBOOK §10 order)

1. Suites for a68/a71 once their traces land (translations done).
2. Remaining attacks in fight order: 75/76 centerscythe, 62/61 carousel,
   50 clubs bombs, 73/74 dbullet_vert, 46/48 bomb variants, 72 clubs dash,
   77 FINAL CHAOS (scripted controller block).
3. Graze + damage systems with their own suites (recon notes have the
   semantics; oracle probes per system).
4. Fight scheduler (jturn/jattack state machine from obj_joker's Step),
   endings (violence on killing hit; pacify via TIRED).
5. Presentation: sprites (dims check!), triangle background, fonts, audio
   index, battle messages. Then the playable page + replay tokens.
