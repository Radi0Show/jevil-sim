# HANDOFF — session log, newest first

Every session appends what it learned, what is open, and the traps it hit.
(PLAYBOOK §9: this is the difference between sessions that compound and
sessions that re-learn.)

## 2026-08-14 — recon → skeleton → T3 verified

**Done:** full recon (see STATUS.md), engine skeleton, chapter 1 soul + box
byte-exact against three real-game recordings on the first attempt.

**What made the first-try pass possible (keep doing these):**
- The T3 oracle stages EXACTLY what the sim scene builds: box settled at
  (320,170) before the heart exists at (314,162); rows begin at the heart's
  first Step. Frame alignment reasoned out in the patch header BEFORE
  running (heart created from obj_time's Draw → first Step next frame →
  that frame is row 0; input functions index the current step as
  `global.oracle_frame + 1`).
- room_battletest (chapter 1, room index 144) is an EMPTY 2x2 room with a
  640x480 view at origin — a perfect blank stage, no tester object needed.
  obj_mainchara follows persistently; hide it, don't destroy it.
- The launcher pattern from knight-research works verbatim with
  `_target_chapter = 1`.

**Traps hit this session:**
- knight-research's lint-csx.py rejects `@"..." + var + @"..."`
  concatenation (its heuristic can't follow leaving/re-entering verbatim
  strings). Write patches with the GML fully inlined per entry.
- UndertaleModLib in ~/tools/utmt-cli has no `GeneralInfo.GameSpeed` —
  don't query it; the 30Hz step is confirmed by trace timing anyway.
- FIRST SABOTAGE WAS A NO-OP: ceil→floor on the focus halving changes
  nothing at wspeed 4 (2.0 either way) and all suites stayed green. A
  sabotage must be proven to change behaviour before its failure means
  anything — wspeed 4→5 fails all three suites at frame 0.
- `spr_grazemask` has maskcount=0 (AxisAlignedRect): masks with no pixel
  data must be synthesized from the bbox (import-masks.mjs does this).

**Open questions for the next session:**
- Chapter 1 RNG identity: assumed WELL512 like chapter 3 (same runner
  family) but NOT yet probed. Do the probe before translating any attack
  with random calls in its spawn path (that is all of them).
- `specialbattle = 3` during the Jevil fight — readers not yet traced.
- obj_growtangle_bouncer — creators not yet traced (may be unused for this
  fight).
- The pre-fight spade volley (jokerbattleevent bulcon chain) — port
  driver-side with the intro cutscene, not as sim entities.
