// The Jevil turn selector — obj_joker's Step, mnfight==1 && talked==0 block
// (gml_Object_obj_joker_Step_0 lines 1-254) as a pure state machine, plus
// the dispatch table (Other_15).
//
// SHAPE OF THE ORIGINAL, preserved exactly:
//  - the HP/hypnosis gates run FIRST (they advance jturn OUT of the holds);
//  - the jattack selection blocks run in DESCENDING jturn order, each
//    sequential-if; holds (4/9/14/19+) never cascade into the blocks below
//    because those test lower ranges;
//  - jattack 2/5/9/13/15 target ALL (scr_targetall), the rest a random
//    target (scr_randomtarget — consumes RNG in the real game via
//    choose(); the dodge scope keeps the draw for stream parity when the
//    full-fight harness lands, using the same choose(0,1,2) shape).
//
// VERIFICATION STATUS: translated from the dump, selector-level suite
// pending the whole-fight harness (knight-sim's §10.6 step). The per-attack
// dispatch parameters are the same table the 16 verified attack suites use.

import { gmlChoose } from './rng.js';

/** Enemy stats — scr_monstersetup monstertype 20. */
export function createJoker() {
  return {
    maxhp: 3500,
    hp: 3500,
    at: 10,
    df: 5,
    jturn: 0,
    jattack: 0,
    turns: 0,
    chaosdance: 0,
    hypnosiscounter: 0,
    pirouettecounter: 0,
    pfactor: 1,
    tired: 0,
    monsterstatus: 0,
    dancelv: 0,
  };
}

/** The dispatch table (obj_joker_Other_15): jattack -> launch parameters. */
export const DISPATCH = {
  0: { type: 70, damageMul: 5, graze: 2 },
  1: { type: 65, damageMul: 5, graze: 3 },
  2: { type: 49, damageMul: 4, graze: 3, all: true },
  3: { type: 75, damageMul: 6, graze: 3 },
  4: { type: 62, damageMul: 5, graze: 2, inv: 20 },
  5: { type: 50, damageMul: 4, graze: 3, all: true, turntimer: 300 },
  6: { type: 73, damageMul: 5 },
  7: { type: 68, damageMul: 5, graze: 2 },
  8: { type: 61, damageMul: 5, graze: 3, inv: 20, turntimer: 240 },
  9: { type: 48, damageMul: 4, graze: 4, all: true, turntimer: 270 },
  10: { type: 72, damageMul: 5 },
  11: { type: 76, damageMul: 6, graze: 3 },
  12: { type: 71, damageMul: 5, graze: 2 },
  13: { type: 46, damageMul: 4, graze: 4, all: true, turntimer: 330 },
  14: { type: 74, damageMul: 4 },
  15: { type: 77, damageMul: 4, turntimer: 1500 },
};

/**
 * One selection pass — everything the mnfight==1 && talked==0 block does to
 * jturn/jattack/stats. Call once per turn, BEFORE the launch. Consumes RNG
 * from `rng` exactly where the original draws.
 */
export function selectTurn(j, rng) {
  const mhpratio = j.hp / j.maxhp;

  // ---- gates: advance OUT of the holds (Step_0:11-90) ----
  if (mhpratio <= 0.8 && j.jturn === 4) {
    j.jturn = 5;
    j.dancelv = 1;
  }
  if (mhpratio <= 0.6 && j.jturn === 9) {
    j.jturn = 10;
  }
  if (mhpratio <= 0.4 && j.jturn === 14) {
    j.jturn = 15;
    j.dancelv = 3;
  }
  if (mhpratio <= 0.15 && j.jturn < 17) {
    j.jturn = 17;
    j.dancelv = 2;
  }
  if (j.hypnosiscounter >= 2 && j.jturn === 4) {
    if (j.turns >= 5 - j.hypnosiscounter) {
      j.jturn = 5;
      j.dancelv = 1;
    }
  }
  if (j.hypnosiscounter >= 4 && j.jturn === 9) {
    if (j.turns >= 11 - j.hypnosiscounter) {
      j.jturn = 10;
      j.dancelv = 1;
    }
  }
  if (j.hypnosiscounter >= 6 && j.jturn === 14) {
    if (j.turns >= 17 - j.hypnosiscounter) {
      j.jturn = 15;
      j.dancelv = 1;
    }
  }
  if (j.jturn >= 18) {
    j.dancelv = 3;
  }
  if (j.jturn >= 19) {
    if (j.turns >= 29 - j.hypnosiscounter) {
      j.tired = 1;
      j.monsterstatus = 1;
      j.dancelv = 2;
    }
  }

  // (The enemy-talk message choose() draws — rr = choose(0,1,2,3) on hold
  // turns plus nested line chooses — live in the MESSAGE layer; the
  // full-fight harness must consume them for stream parity. Deferred with
  // the battle-message translation.)

  // ---- phase-5 stat drift + selection (Step_0:203-246, descending) ----
  if (j.jturn >= 19) {
    if (j.df > -10) {
      j.df -= 3;
    }
    if (j.at < 11) {
      j.at += 0.5;
    }
    j.jattack = gmlChoose(rng, [0, 4, 7, 8, 10, 11, 12, 13, 13, 13]);
  }
  if (j.jturn >= 15 && j.jturn <= 18) {
    j.jattack = j.jturn - 3;
    j.jturn += 1;
  }
  if (j.jturn === 14) {
    j.jattack = gmlChoose(rng, [8, 9, 10, 11]);
  }
  if (j.jturn >= 10 && j.jturn <= 13) {
    j.jattack = j.jturn - 2;
    j.jturn += 1;
  }
  if (j.jturn === 9) {
    j.jattack = gmlChoose(rng, [4, 5, 6, 7]);
  }
  if (j.jturn >= 5 && j.jturn <= 8) {
    j.jattack = j.jturn - 1;
    j.jturn += 1;
  }
  if (j.jturn === 4) {
    j.jattack = gmlChoose(rng, [0, 1, 2, 3]);
  }
  if (j.jturn <= 3) {
    j.jattack = j.jturn;
    j.jturn += 1;
  }
  return j.jattack;
}

/** Other_15's per-turn side effects around the dc launch. */
export function launchParams(j) {
  const d = DISPATCH[j.jattack];
  return {
    type: d.type,
    // remat dance: AT is multiplied by pfactor for the launch only.
    damage: j.at * j.pfactor * d.damageMul,
    grazepoints: d.graze ?? 1,
    inv: d.inv ?? 60,
    target: d.all ? 3 : 0,
    turntimer: d.turntimer ?? 240,
  };
}
