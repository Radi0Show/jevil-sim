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

## 2026-08-14 (close) — ALL 16 ATTACKS VERIFIED; selector translated

verify-all 20/20. Contact model now carries: pixel-intersection raw+rint,
axis-rect-B AABB solidity, MIRRORED-axis sampling floor((u+1)/scale)
(probe2 cfg4/5, 44/44). OPEN: obj_dbullet_vert's EFFECTIVE mask matches
neither stored diamond (probe2 cfg6: 36 vs vert, 100 vs flat, no shift
zeroes it) — costs exactly one transient hit-flip (a74 f136); reconstruct
it with a dense dedicated sweep, then restore a74's full window.
sim/joker.js holds the fight selector (smoke-tested: violence pacing
reproduces fakeout→FINAL CHAOS→phase 5). NEXT per PLAYBOOK §10: the turn
lifecycle around the selector (enemy-talk timing, box regrow, teardown at
turntimer 0, returnheart), then graze/TP + damage with their own probes,
then endings, then sprites/audio/UI, then Pages deploy.

## 2026-08-14 (lifecycle session) — damage/graze/turn-cycle; a LATENT ORIGINAL CRASH

Damage + graze + the full enemy-turn lifecycle translated and wired
(fight mode on the page, menu phase = labeled pause). Live-probe findings,
both caught from the game window mid-run:
1. scr_damage needs obj_battlecontroller's arrays (battledf etc.) — any
   stage without a bc must initialize them (fresh-file values: df 2).
2. **LATENT CRASH IN THE ORIGINAL**: hit on a downed target + whole party
   untargetable -> scr_randomtarget returns 3 -> scr_damage indexes
   charinstance[3] -> out of range. Unreachable in normal play only
   because the wipe's scr_gameover leaves the room first; the probe's
   soft gameover exposed it. Plausibly the crash the PS4/PS5 v1.03 note
   fixed ("fighting Jevil could occasionally crash the game") — a hit
   landing in the wipe's frame window. The sim's translation happens to
   be crash-free (the with is a no-op); verify-live's claim window ends
   at the wipe.
Also: bullet inv fields confirmed WRITE-ONLY (i-frames always invc*40) —
dc.inv 20 on jattack 4/8 does nothing; three more original bugs preserved
in damage.js (AOE downs at hp 0 sans scr_dead; pillar low-HP no-op).

## 2026-08-14 (graze-order session) — dmgwriter RNG; fresh-file party; the DEATH-FRAME G-SKIP

verify-live's last desyncs were three separate things, and none was the
graze geometry:
1. **obj_dmgwriter consumes RNG.** Its Create draws `round(random(600))`
   (immediately overwritten — the draw still counts) and its Draw draws
   `-5 - random(2)` on its second draw frame. Every hit therefore shifts
   the stream; scrDamage + stepFrame's draw-phase hook now consume both.
   Any live-path probe comparison made WITHOUT this desyncs every spawn
   after the first hit while soul positions stay identical — the failure
   looks exactly like bad graze geometry. It isn't.
2. **The probe stage is a fresh-file party** (scr_gamestart): char
   [1,0,0], charcantarget ALL 0 (only scr_revive sets one). Kris alone;
   the wipe is one down; the charinstance[3] crash fires on the FIRST
   down. tools/scenes/live.js overrides freshParty accordingly.
3. **The DEATH-FRAME G-SKIP** (documented runtime deviation). Event-order
   probe (jevil-research/tools/patches/oracle_pairorder_probe.csx) logs
   every grazebox/heart collision event + the runner's own place_meeting.
   Result: pairs run per bullet, [graze, hit], newest-first (f34:
   G(new) H(new) G(old, inv 40)) — BUT on 27/93 (t65) + 2/11 (t70)
   heart-contact deaths, the dying bullet's G never fires while
   place_meeting says overlap, at positions that fire in other rings.
   Toggles mid-ring; no GML-visible cause (collision-grid internals).
   Sim always grazes first; verify-live enforces the one-sided envelope
   (tension >= oracle, tt <=, steps only on death frames, cap 2). The
   macro grazepair sweep's 8 corner-band mismatches are the same class
   (event-fire records) — verify-grazepair absorbs exactly those 8 and
   allows ZERO model-missed-hits.
TRAP FOR LATER SESSIONS: sabotage-testing by editing sim files then
`git checkout` restores the COMMITTED version — commit first or re-apply;
this session lost and re-applied the dmgwriter fix that way.

### Vert-diamond effective mask — dense census recorded, hypothesis space narrowed

New instrument: jevil-research tools/patches/oracle_vertmask_probe.csx ->
traces/vertmask-probe.csv — 1,800 place_meeting verdicts for
spr_diamondbullet_vert vs the heart, whole perimeter, sub-pixel grids
(pm and collision-event verdicts agree 1800/1800 for a static probe, so
the earlier event-based cfg6 data was geometry-faithful after all).
RULED OUT by this data plus the existing suite pins:
- ANY static pixel set under the current raw+corner+floor sampler (the
  free-pixel solver hits 82 hit/miss contradictions — verdicts flip
  WITHIN a floor-equivalence class, so the runner is frac-sensitive at a
  non-integer threshold for this sprite);
- rint/center sampling or rounded-B-position as UNIVERSAL rules (each
  fixes the census 0/1800 but breaks contact-probe cfg3, grazepair,
  live-65, or the wall/despawn pins in t3 (spr_heartsmall origin 0,0),
  a71 (spr_diamondbullet oy 15 != h/2 16), a61 (spr_carousel oy 20);
  those three pin ORIGIN-anchored sampling for sprite-derived masks);
- an analytic diamond inscribed in the scaled bbox (96 corner / 44
  center mismatches).
Best current guess: the sprite's collision KIND is a baked GMS2
diamond/ellipse evaluated analytically at runtime with some other
extent — fit the census's per-row sub-pixel thresholds (left/right
flank transitions as a function of y) before trying more rules. Cost of
leaving it: exactly the one documented transient hit-flip (a74 f136).
Parsing traps that burned this session: probe CSVs are CRLF (awk
$N==\"1\" silently fails on the last column); the contact CSVs have SEVEN
columns (cfg,i,x,y,angle,scale,hit).

## 2026-08-14 (whole-fight session) — the harness is GREEN; random(0) CONSUMES

verify-fullfight: a defend-only whole fight — real encounter pipeline,
real menus, real turns — byte-green for 1,020 rows to the party wipe
(bullet slots included, within the documented f32 residue; 3 one-sided
graze-surplus steps absorbed). The pieces, in discovery order:

1. **The ch1 battle menu translated** (sim/menu.js): the five-button row
   with CROSSED input buffers (left checks lbuffer, sets rbuffer),
   DEFEND (+40 TP, charaction 10), scr_nexthero/prevhero/endturn/
   attackphase, and obj_attackpress's no-fighter path (timermax 3,
   TWO boltorder chooses ALWAYS — an RNG draw pair per turn). Menus
   consume no RNG themselves. Defend-only scripting is 6 sparse inputs
   per turn: cursor 0 wraps LEFT to DEFEND; buffers need a 2-frame gap.
2. **The iterative recording driver** (jevil-research
   tools/record-fullfight.mjs): each turn's menu-ready frame is only
   visible in the previous recording, so the script grows one burst per
   round; all-down turns auto-skip (scr_mnendturn) and need no input.
3. **obj_moveheart**: the heart FLIES IN over 8 frames to (view+310,
   view+160) — the probe stages' instant (314,162) spawn was both late
   and 4px off; inv/graze arm only on landing.
4. **The dispatch flavor line** rr = choose(0,1,2,3,4) draws once per
   enemy turn AFTER event_user(5) (obj_joker Step_0:281).
5. **random(0) CONSUMES WELL512 STATE.** The whole-fight streams only
   align at offset 5,618: obj_writer draws random(shake) per revealed
   character per frame with shake == 0, and obj_astream — created by
   EVERY snd_init, one per active music stream — draws random(20) twice
   per frame forever. Two streams (room music + joker.ogg) = a constant
   4/frame. These are visually inert but stream-advancing.
   **Model: the presentation-draw side-channel** — the recorder wraps
   the sites in a counting oracle_r0() (the real draws still run, so the
   recorded stream is the real game's) and logs a per-frame count (txt
   column); the sim replays the counts at the draw phase (knight's
   shuffle precedent: logged, not stripped). A native writer/astream
   reveal-engine translation can replace the channel without touching
   anything else. The recorder must ZERO the counter at the seed moment
   (it otherwise accumulates from game boot — a 128-draw ghost).
6. **The differ's envelope** (verify-fullfight): tension/tt one-sided
   bounded steps (the G-skip + corner-band classes); baselines resync at
   turn-timer RE-ARMS (tt assignment erases the shortfall) and at the
   MAXTENSION CAP (250 saturates both sides).
7. Diagnostic that cracked it: a THROWAWAY per-frame probe draw
   (string_format(random(1))) recovers the runner's per-frame stream
   position exactly against the known WELL512 sequence.

TRAP (hit AGAIN this session): sabotage-testing via edit +
`git checkout` reverts to the COMMITTED file — fight.js lost every
uncommitted change and had to be reapplied. COMMIT BEFORE SABOTAGING.

NEXT: FIGHT-path scripting (attack bar, damage rolls, HP-gate
progression, ACTs) for a full-roster fullfight; presentation (task #8);
replay tokens + deploy (task #9).

## 2026-08-14 (FIGHT-path session) — the fight can be WON, verified

verify-fullfight now runs TWO whole fights: defend-only to the wipe
(1,020 rows) and FIGHT-path to the KILL (3,442 rows — every HP gate,
holds releasing turn by turn, the <=15% skip into phase 5, Diamond
Release II at jturn 18, the killing swing at f3441). The scenario is the
knight-sim immortality trick, applied on BOTH sides: hp pinned to max
after each row (hit frames stay visible; the wipe cannot happen), with
AT boosted to 30 so the kill lands in ten turns.

New translations (sim/heroes.js + menu.js fighter path):
- FIGHT target column (bmenuno 1): single-monster cursor pin, confirm
  gated on ONEBUFFER (not twobuffer like the row).
- The attack bar's fighter path: boltorder pair + the mymethod-1
  rejection-sampled boltchar chooses + the lastbolt walk seeded at -1
  (first bolt lands at frame 29 — original quirk); the one-button
  boltcheck (window -5..+15, 150/120/110/100-2p points, dual on exact
  ties).
- **ORIGINAL BUG preserved — the Other_11 i-clobber**: the handoff
  loop's event_user(1) reuses `i` in the ap's scope, so only ONE hero
  handoff resolves per draw frame; dual-press swings stagger by a frame
  (hs columns f1018/f1019, damages f1029/f1030).
- The swing: first state-1 draw sets alarm[1] = 10 — damage lands at
  handoff + 11, formula round(battleat*points/20 - monsterdf*3), NO RNG
  in the roll. The enemy dmgwriter uses delay 8 (2 on a miss). TP on a
  landed hit: round(points/15) for Jevil (monstertype 20) — the wiki's
  "2/3rds" claim, now dump-verified (normal enemies get /10).
- obj_basicattack spawn jitter: random(6) x2 per landed hit, y before x
  (RTL instance_create args).
- Jevil hurt entry (Draw state-3): dancelv gates by mhpratio,
  laughnoise choose rides the presentation channel, defeat at hp <= 0.

Differ v3 (turn-aligned): anchors at every structural transition
(tt re-arms, soul appear/vanish, myfight changes); menu windows compare
ABSOLUTELY (inputs re-sync both sides at scripted frames), enemy-turn
windows RELATIVELY (spawn-anchored) — because the ±1-frame graze
timepoint flips shift each turn's end. Envelope: |tension offset| <= 12,
|tt| <= 6, per-step bounds, cap/re-arm resyncs; inv tolerates the ±3
boundary drift; slots compare as position MULTISETS on residue-rounded
sort keys (the recorder's with() order flips between newest- and
oldest-first per object list — runner-internal, no gameplay claim).

Recorder v2 (mode=1): immortal pin after the row write, at=30, bolt
schedule columns (bf/bc), points and hero-state columns, kill-stop with
a 30-row tail. Driver v2 (record-fullfight-fight.mjs): FIGHT bursts are
six confirms; bar presses scheduled from the previous round's logged
boltframes at create+boltframe+1 (one press can dual-consume ties).
