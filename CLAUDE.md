# CLAUDE.md — Jevil Simulator

**FIRST: read docs/PLAYBOOK.md, all of it.** It is the distilled method and
trap catalog from knight-sim (the reference implementation, one directory
over at ~/knight-sim). This project follows it exactly.

**THEN: docs/RECON.md** — if its checkboxes are empty, recon is the task.
No code before the fight table exists.

Session basics (same machine as knight-sim):

    export PATH="$HOME/tools/node/bin:$PATH"   # Node is NOT on PATH

- Chapter data: chapter1_mac/game.ios (Jevil is Chapter 1's secret boss).
- UTMT CLI at ~/tools/utmt-cli — SOLO RUNS ONLY (concurrent runs wedge).
- Research repo: ~/jevil-research/ — PRIVATE AND LOCAL. The dump,
  oracle patches, traces. Never published, never committed here.
- knight-research/tools/patches/ holds every working script template:
  extraction (SPR_LIST file → padded PNGs — ALWAYS verify PNG dims ==
  manifest dims after), id resolvers, room/object dumps, the universal
  oracle harness, the capture bundle.
- Dev server: tools/devserver.py pattern on its own port — NEVER the app's
  preview server (stale module graphs; PLAYBOOK §7).

---

## THE REAL FIGHT — ground truth (from the chapter 1 dump, recon 2026-08-14)

Full citations in `~/jevil-research/notes/recon-findings.md`. The selector is
INLINE in `obj_joker`'s Step (mnfight==1 && talked==0 block) — chapter 1 has
no Other_10-style selector event. `event_user(5)` → **Other_15 is the attack
dispatch**; every attack goes through `obj_dbulletcontroller` (`dc.type`,
`joker = 1`).

**Stats** (scr_monstersetup, monstertype 20): HP 3500, AT 10, DF 5,
mercymax 999, sparepoint 0. ACTs: Check / Pirouette (50 TP, Kris) /
Hypnosis (125 TP, Ralsei+Susie).

**Turn structure**: `jturn` advances 0→19+; holds at 4, 9, 14 (random pick
from the previous quartet) until HP gates 80% / 60% / 40% pass (or the
hypnosis alternates); ≤15% skips any jturn<17 to 17. jturn 19+ is the final
hold: choose(0,4,7,8,10,11,12,13,13,13) with DF −3 (floor −10) and AT +0.5
(cap 11) per turn.

| jturn | jattack (dc.type) |
|---|---|
| 0–3 | 0 (70), 1 (65), 2 (49), 3 (75) in order |
| 4 hold | choose 0–3, until HP ≤ 80% |
| 5–8 | 4 (62), 5 (50), 6 (73), 7 (68) |
| 9 hold | choose 4–7, until HP ≤ 60% |
| 10–13 | 8 (61), 9 (48), 10 (72), 11 (76) |
| 14 hold | choose 8–11, until HP ≤ 40% |
| 15–18 | 12 (71), 13 (46), 14 (74), 15 (77 FINAL CHAOS) |
| 19+ hold | choose(0,4,7,8,10,11,12,13,13,13) + stat drift, TIRED at turns ≥ 29 − hypnosiscounter |

**Live attack roster** (16): suitbombs 46/48/49/50 (obj_suitbomb),
carousel 61/62 (obj_carouselbullet), spaderings 65/68 (obj_spadering),
teleport-clone volleys 70/71 (obj_joker_teleport), dark clubs 72
(obj_clubsbullet_dark), vertical bullets 73/74 (obj_dbullet_vert),
Devilsknife 75/76 (obj_centerscythe), FINAL CHAOS 77 (obj_laserscythe rain,
scripted inline in the controller). Targeting: jattack 2,5,9,13,15 →
scr_targetall, else scr_randomtarget. Turn timer 240 default; overrides:
jattack 5→300, 8→240, 9→270, 13→330, 15→1500.

**UNREACHABLE — do not translate**: jattack 99 (type 47) and 999 (type 25)
have no writers; dc.type 45, 55–58, 60, 66, 67 have no creators anywhere in
the dump (bigscythe variants, easier carousel, spadering variants).

**Endings** — two, not three:
- **Violence**: HP ≤ 0, checked INSIDE the Draw hurt block — ends on the
  killing hit. flag[241] = 6.
- **Pacify**: monsterstatus == 1 (TIRED: jturn ≥ 19 && turns ≥ 29 −
  hypnosiscounter, or hypnosiscounter ≥ 9) then Ralsei's Pacify →
  spare anim + defeat. flag[241] = 7.
- **SPARE never ends it**: needs mercymod ≥ 100; sparepoint is 0 and the
  `battlecancel == 1 → mercymod = 999` line in his Step is DEAD CODE (its
  only writer is gated on monstertype 7/16; Jevil is 20).

**Chapter 1 soul**: global.sp = 4, unnormalized diagonals, focus-slow
ceil(v·0.5) with the disableslow latch, **corner-slide assist** in wall
resolution (ch1 addition vs ch3 — T3 must pin it), and **obj_grazebox**
(TP graze, +10,+10 offset). Attack speed overrides: type 68 → wspeed 5,
type 77 → wspeed 10.

---

The five rules that cost the most, restated because they will be tested:

1. Read the dump before launching the game. A grep is seconds; a run is
   minutes.
2. Never pin a value the game sequences itself with. Grep for readers
   first.
3. The SELECTOR decides what is real, not the dispatch table — and trace
   every creator before calling anything dead.
4. Nothing invented ships; approximations are LABELLED where the player
   sees them.
5. A claim is only true if a suite checks it — and green only answers
   "did I break something", never "did my change do anything".
