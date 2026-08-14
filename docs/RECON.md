# RECON — answered 2026-08-14 (full citations: ~/jevil-research/notes/recon-findings.md)

Answers come from the chapter 1 GML dump. Every entry cites its source file
(in `~/jevil-research/gml_dump/CodeEntries/`). Items still open are marked.

## The data

- [x] Chapter data file: `DELTARUNE.app/Contents/Resources/chapter1_mac/game.ios`
      (pristine copy at `~/jevil-research/oracle/DELTARUNE.app`)
- [x] Dump built into `~/jevil-research/gml_dump/CodeEntries/` (1,293 files)
- [x] Dump accounting closed: 1,680 entries = 1,293 roots (1:1 with files,
      set-diff both directions) + 387 children, every parent dumped
      (`gml_dump/_accounting.tsv`, `tools/patches/code_accounting.csx`)

## The fight

- [x] Encounter room controller: `obj_jokerbattleevent` (intro cutscene,
      pre-fight spade volley, `scr_encountersetup(25)`, post-fight scenes)
- [x] Entered via encounter 25; gated on `flag[241] < 6`; `tempflag[4]`
      selects the shortened re-entry intro; specialbattle = 3;
      music joker.ogg
- [x] Enemy object `obj_joker`; the SELECTOR is inline in Step_0
      (mnfight==1 && talked==0); `event_user(5)` → Other_15 is the dispatch
- [x] Shared spawner: `obj_dbulletcontroller` with `joker = 1`; type table
      in its Step_0 lines 985–1653
- [x] Fight table: jturn 0–19+ with holds at 4/9/14 (HP gates 80/60/40%),
      skip-to-17 at ≤15%, final hold 19+ with stat drift — see CLAUDE.md
      "THE REAL FIGHT"
- [x] Phase gates fire at the TOP of the enemy-talk block (mnfight==1),
      reading mhpratio BEFORE message/attack selection — not at turn end,
      not on a hit
- [x] Fight END: violence = HP ≤ 0 inside the Draw hurt block (ends on the
      killing hit, flag[241]=6); pacify = TIRED + Ralsei's Pacify
      (scr_spell case 3, flag[51]=3, then flag[241]=7). SPARE can never end
      it (sparepoint 0; battlecancel path is dead code — writer gated on
      monstertype 7/16, Jevil is 20)
- [x] Unreachable content: jattack 99 (type 47), 999 (type 25); dc.types
      45, 55, 56, 57, 58, 60, 66, 67 — no creators anywhere in the dump
- [x] Enemy stats: HP 3500, AT 10 (pfactor-modulated per turn), DF 5,
      mercymax 999; jturn≥19 drift DF −3/turn floor −10, AT +0.5 cap 11
- [x] Soul: red only; wspeed = global.sp = 4; focus-slow ceil(v*0.5),
      disableslow latch; UNNORMALIZED diagonals; corner-slide assist in the
      wall resolution (chapter 1 addition — measure in T3, don't assume);
      per-attack overrides wspeed 5 (type 68) / 10 (type 77)

## The presentation

- [x] Battle background: `obj_jokerbg_triangle_real` (rotating triangles);
      rotspeed = 1 + (1.5 − mhpratio·1.5), stepped on each hurt
- [x] Hurt/strobe: obj_joker Draw state==3 block; body dance via
      `obj_joker_body` (dancelv 0–4, condition 0–5, floatsinerspeed
      1 + (1 − mhpratio)); laugh SFX choose() on each hurt
- [x] Battle messages: chosen at rtimer==12 (5 generic + dancelv/jturn/
      status specials); enemy-talk lines per jturn (lang JSON keys
      obj_joker_slash_Step_0_gml_*)
- [x] Game over: chapter 1 standard (no joker refs in obj_gameover_init /
      scr_gameover)
- [ ] Cutscenes: intro chain read (con 1–30 in obj_jokerbattleevent);
      staging coordinates + quick-variant diffs still to be extracted for
      the driver-side port
- [ ] Music/SFX full inventory with pitches (namespace known: snd_joker_*,
      joker.ogg, prejoker.ogg) — enumerate during the audio pass
- [ ] The pre-fight spade volley (bulcon chain) parameters — port with the
      intro cutscene

## Oracle plan

- [x] Universal harness approach carries over: set `jturn`/`jattack` and let
      obj_joker drive (its Step already creates darkener, growtangle,
      moveheart, dispatch at rtimer==12). Set a starting mnfight only; never
      pin it. Launcher patch must select chapter 1 (knight-research's picks
      chapter 3)
- [ ] RNG draw sites in Draw events: obj_joker Draw consumes choose() on
      hurt frames (laughnoise); enumerate others per attack when tracing
- [ ] Fixed-order oracle patches needed: none identified yet
      (no ds_list_shuffle in the jevil attack path — verify per attack)
- [ ] Recorder columns per attack: soul x/y, box, per-bullet x/y/angle/
      scales + attack-specific state (suitbomb.type, spadering phase,
      carousel siner/vsin, scythe angle...)
