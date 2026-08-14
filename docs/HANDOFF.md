# HANDOFF — session log, newest first

Every session appends what it learned, what is open, and the traps it hit.
(PLAYBOOK §9: this is the difference between sessions that compound and
sessions that re-learn.)

## 2026-08-14 (final) — three attacks verified; TWO more runtime facts

**Done since the entry below:** attacks 70/65/49 verified two-tier and
sabotage-tested; types 68/71 translated (suites cloned, recordings queued);
suit bombs + heart blasts + regularbullet base in; attack-diff library with
knight's count-flip slot suppression.

**Fact 4 — chapter 1 iterates instances NEWEST-FIRST** (a49's heart-bomb
blast: a son repositioned past the wall line by its parent survives the
frame — only possible if the son's wall-check ran before the parent's
step). entity.js phaseList sorts seq DESCENDING now; every earlier suite
stays green under the flip because nothing before a49 had cross-instance
repositioning.

**Fact 5 — ONE collision routine for everything**: raw positions,
round-half-even bbox integerisation, pixel-intersection sampling (the rule
ch3's graze probe calibrated for rect-A). Selected by two boundary cases
pulling opposite directions (a65 f79 must hit, a70 f74 must miss) and
validated over all recordings including T3's walls. ch3's floored-corner
precise-A rule is a LATER runtime's behaviour.

**Recording protocol note:** the attack recorder now prints hspeed/vspeed
accessor columns per slot (b*_hs/b*_vs) — scenes recorded with it set
state.traceBulletVel. The accessor disagrees with the mover at the ~1e-5
level (trig residue), so attack-diff bounds those columns at 1e-3.

**a71 RESOLVED — and the previous entry's theory was WRONG.** The "desync
at the 2nd-3rd spawn" never existed: the sim failed from FRAME 0 because
the type-71 block missed the right-to-left fix (the replace-all keyed on a
comment that only the type-70 block had). The "f80 first divergence" was a
misreading: the differ printed hundreds of failures and every view used
(`tail -2`, verify-all's last-6-lines) showed only the LAST lines near the
loop's break point. TWO fixes: RTL applied to type 71 (suite passes, 600
rows, 25 hits, sabotage-tested), and attack-diff now caps failure logging
at 12 lines so the EARLIEST failures are what any truncated view shows.
LESSON FOR EVERY FUTURE DIFF: read failures from the HEAD. The oracle-side
stream mapping that solved it (map each spawn's implied randoms onto the
seed's stream) is the right first move for any future consumption bug.

**Superseded entry kept for the record:**
Type 71 (9-frame cadence, 3+ clones alive) exposes an RNG-stream desync the
other attacks masked: teleport CON MACHINES match frame-by-frame but spawn
POSITIONS differ from around the 2nd-3rd spawn (sim clone at x 136.06 where
the oracle has 216.71 — different jokerx draws). Two traps already
eliminated: the recorder's `with` window keeps the two NEWEST clones
(newest-first iteration — the sim scene now mirrors that), and the
motion-step floor was retuned. Suspects for the desync, in order: (1) an
extra/missing draw somewhere in the single-diamond volley path that only
matters when spawns overlap; (2) nbul differs at f74 (sim 2, oracle 1) —
the aimed diamonds always hit the stationary soul, so a hit-frame
difference removes a bullet a frame apart and may interact with spawn
timing; (3) something in the type-71 block's conditional-random path.
Next session: dump both sides' spawn positions for the first 10 spawns
(the sim can print its gmlRng draw log; the oracle needs a spawn-log
column) and find the first diverging draw. Recording: traces/a71-teleport.csv
(wide format).

## 2026-08-14 (later) — RNG confirmed; attack 1 in progress; THREE new engine facts

**Done:** ch1 RNG probed (WELL512, identical to ch3 — 7/7). Universal attack
oracle built (oracle_attack.csx, config-driven, one build for all 16 types).
a70 (teleport five-spade fan) recorded and diffed: spawn cadence, RNG
consumption, fan geometry, f32 motion, teleport con machine ALL byte-exact;
14 simultaneous bullet tracks matching.

**Three chapter-1 engine facts, each measured against a70-fan.csv:**
1. **GML `type` on an instance collides with the engine's `e.type` handler
   ref.** Convention: translate GML `type` as `gmlType` everywhere.
2. **The GML VM evaluates function arguments RIGHT-TO-LEFT.** In
   `choose(a - random(100), b + random(100))` the SECOND argument's random
   draws first; the choose draw then indexes args in source order. Never
   mattered in knight-sim (their choose args were constants).
3. **Real comparisons use math_set_epsilon (default 1e-5).** An f32 residue
   of +6.6e-8 fails `> 0`. sim/gml.js gmlGreater/gmlLess carry this; use
   them wherever a fractional value meets a comparison.

**RESOLVED → documented deviation (docs/VERIFICATION.md).** Attack 1 now
PASSES two-tier: mechanics byte-exact 600 frames, aimed positions within a
3.3e-3 px measured residue, both tiers sabotage-tested. The investigation's
verdict: the ch1 runner's aimed-bullet velocity comes from single-precision
trig whose bits JS can't reproduce, its own hspeed/vspeed accessor
disagrees with its mover, and drift is exactly 1 f32 ulp/frame in coarse
grid zones (visible in a70-wide.csv's constant-delta rows). Probes:
trig-probe / pointdir-probe / mover-probe CSVs. Next bit-exact step, if
ever: disassemble the runner's sinf.

**Suite-design fact:** contact columns (nbul/hits) can flip at TANGENTIAL
passes once residue crosses a mask edge — the a70 suite pins them
byte-exact through f214 (past the real spawn window) and bounds them after.
Slots 0-15 stay aligned regardless (ch1 bullets never despawn; the oldest
16 are long offscreen).

**Original open note (kept for the record) — the chapter 1 runner's direction->velocity mapping.** One spade
cell diverges ~3 f32 ulps after 35 identical frames: the runner's effective
sin at 226.884° differs from JS f64/f32 sin by ~1e-5 ABSOLUTE (hundreds of
ulps — not rounding). Chapter 1 ships an OLDER runtime than chapter 3
(where JS trig matched byte-exact). tools/patches/oracle_trig_probe.csx
measures the mapping (motion derivation + lengthdir + cos/sin at 400
angles) → traces/trig-probe.csv. Fit the formula from that before touching
the a70 scene again.

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

## 2026-08-14 (second session) — 14 of 16 attacks verified; the epsilon harvest

**State:** verify-all 18/18. Verified: 70, 65, 49, 75, 62(pending), 50, 73,
68, 61, 48, 72, 76, 71, 46, 74(pending), 77. FINAL CHAOS byte-exact through
its whole scripted arc. Playable practice page live (web/, mask-rendered,
honestly labeled) — dev server via the jevil-sim entry in ~/.claude/launch.json
(port 8214; devserver anchors itself to the repo root).

**The epsilon class keeps paying:** math_set_epsilon applies to EVERY real
comparison in the runner. Sites measured this session: teleport vanish
(xscale > 0), fadewhite thresholds (>= 1, >= 1.3, <= 0 — a77's f581 soul
recentre), fade-alpha gates (< 1 with f32 0.1-steps summing to 0.99999994),
the insanity ramp cap (dirspeed < 3 with f64 0.01-steps). RULE: any
computed real meeting a bound in a translation gets gmlGreater/-Less/-Eq.

**Ordering close-out:** object-index dispatch (a49+a48 pin it); the
recorder's `with` windows iterate newest-first (slot semantics for
teleports). Two probe generations calibrate contact: contact-probe.csv
(2,400 pts) + contact-probe2.csv (4,800 pts incl. NEGATIVE xscale carousel,
vert diamond, heartbullet) — a62/a74's single hit-flips pend that fit.

**Batch trap:** back-to-back run-oracle launches can mislabel traces when a
run crashes (a75's crash shifted two names; check the `phase` column of
every fresh trace against its expected dc.type before diffing). And ALWAYS
rebuild the attack oracle after a probe build — a probe bundle records no
oracle_trace.csv and burns a whole batch in timeouts.
