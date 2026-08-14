// The practice scene: one attack on repeat, instant restart — the
// Bad-Time-Simulator posture (PLAYBOOK §0). Runs the same lab
// configuration the verifiers use (damage sterilized: contact destroys
// the bullet and counts, party HP untouched — the damage system lands
// with its own suite), which the page LABELS.
//
// The launch mirrors obj_joker's Other_15 exactly: dc created, fields
// assigned per the dispatch table, joker = 1; turntimer per attack.

import { spawn } from '../entity.js';
import { gmlCreate } from '../rng.js';
import { soul } from '../soul.js';
import { battlebox, settleBox } from '../battlebox.js';
import { dbulletController } from '../attacks/dbullet-controller.js';

// jattack dispatch table (obj_joker_Other_15) + wiki's player-facing names.
// verified: has a green oracle suite today.
export const ATTACKS = [
  { jattack: 0, type: 70, name: 'Five-Spade Attack', tt: 240, damage: 50, graze: 2, inv: 60, verified: true },
  { jattack: 1, type: 65, name: 'Spade Spirals', tt: 240, damage: 50, graze: 3, inv: 60, verified: true },
  { jattack: 2, type: 49, name: 'Heart Bombs', tt: 240, damage: 40, graze: 3, inv: 60, verified: true },
  { jattack: 3, type: 75, name: 'Spinning Scythes', tt: 240, damage: 60, graze: 3, inv: 60, verified: false },
  { jattack: 4, type: 62, name: 'Carousel Attack', tt: 240, damage: 50, graze: 2, inv: 20, verified: false },
  { jattack: 5, type: 50, name: 'Club Bombs', tt: 300, damage: 40, graze: 3, inv: 60, verified: true },
  { jattack: 6, type: 73, name: 'Diamond Release', tt: 240, damage: 50, graze: 1, inv: 60, verified: false },
  { jattack: 7, type: 68, name: 'Spade Spirals II', tt: 240, damage: 50, graze: 2, inv: 60, verified: true },
  { jattack: 8, type: 61, name: 'Carousel Attack II', tt: 240, damage: 50, graze: 3, inv: 20, verified: false },
  { jattack: 9, type: 48, name: 'Spade Bombs', tt: 270, damage: 40, graze: 4, inv: 60, verified: true },
  { jattack: 10, type: 72, name: 'Three-Club Attack', tt: 240, damage: 50, graze: 1, inv: 60, verified: false },
  { jattack: 11, type: 76, name: 'Spinning Scythes II', tt: 240, damage: 60, graze: 3, inv: 60, verified: false },
  { jattack: 12, type: 71, name: 'Diamond Tossing', tt: 240, damage: 50, graze: 2, inv: 60, verified: true },
  { jattack: 13, type: 46, name: 'Chaos Bomb', tt: 330, damage: 40, graze: 4, inv: 60, verified: true },
  { jattack: 14, type: 74, name: 'Diamond Release II', tt: 240, damage: 40, graze: 1, inv: 60, verified: false },
  { jattack: 15, type: 77, name: 'FINAL CHAOS', tt: 1500, damage: 40, graze: 1, inv: 60, verified: false },
];

const bcLite = {
  name: 'bc_lite',
  objIndex: 196, // obj_battlecontroller stand-in
  beginStep(e, state) {
    if (state.frame > state.launchFrame) state.turntimer -= 1;
  },
};

export function buildPracticeScene(state, { attackIndex = 0 } = {}) {
  const atk = ATTACKS[attackIndex] ?? ATTACKS[0];
  state.hp = 90;
  state.invTimer = 0;
  state.phase = atk.name;
  state.view = { x: 0, y: 0 };
  state.roomHeight = 480;
  state.turntimer = atk.tt;
  state.launchFrame = 0;
  state.damageEnabled = false;
  state.gmlRng = gmlCreate(state.seed);
  state.attack = atk;

  spawn(state, bcLite);
  const gt = spawn(state, battlebox, { x: 320, y: 170 });
  settleBox(gt);
  state.soul = spawn(state, soul, { x: 314, y: 162 });

  const dc = spawn(state, dbulletController, { x: 500, y: 160 });
  dc.gmlType = atk.type;
  dc.target = 0;
  dc.damage = atk.damage;
  dc.grazepoints = atk.graze;
  dc.inv = atk.inv;
  dc.joker = 1;

  return state;
}
