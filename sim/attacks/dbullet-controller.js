// obj_dbulletcontroller — the shared spawner, chapter 1 / Jevil types.
//
//   Create : gml_Object_obj_dbulletcontroller_Create_0
//   Step   : gml_Object_obj_dbulletcontroller_Step_0  (joker == 1 blocks,
//            lines 985-1653 — one `if (type == N)` per attack)
//
// obj_joker's Other_15 creates one per turn, assigns type / target / damage
// / grazepoints (and inv for jattack 4/8), then sets joker = 1. Types are
// translated here one at a time, each landing only with its own oracle
// suite. Untranslated types throw rather than silently doing nothing.
//
// RNG: every draw site is translated in ORDER (argument evaluation is
// left-to-right; choose(a, b) evaluates both args, then draws once).
// Chapter 1's snd_play consumes nothing.

import { spawn } from '../entity.js';
import { gmlRandom, gmlChoose } from '../rng.js';
import { jokerTeleport } from './joker-teleport.js';
import { spadering } from './spadering.js';
import { suitbomb } from './suitbomb.js';
import { bulletInherit } from '../bullets/collidebullet.js';

function box(state) {
  // obj_battlesolid.x — first live solid (the battle box).
  return state.entities.find((o) => o.alive && o.isSolid);
}

export const dbulletController = {
  name: 'obj_dbulletcontroller',

  create(e, state) {
    e.btimer = 99;
    e.timermax = 12;
    e.difficulty = 1;
    e.gmlType = 1; // GML `type` — renamed: e.type is the framework's handler ref
    e.joker = 0;
    e.side = 1;
    e.damage = 100;
    e.grazepoints = 1;
    e.timepoints = 1;
    e.inv = 60;
    e.grazed = 0;
    e.grazetimer = 0;
    e.target = 0;
    e.made = 0;
    e.special = 0;
    e.miny = 150;
    e.maxy = 280;
    const gt = box(state);
    if (gt) {
      // miny/maxy from obj_growtangle sprite_height (75 * yscale).
      e.miny = gt.y - (75 * gt.image_yscale) / 2;
      e.maxy = gt.y + (75 * gt.image_yscale) / 2;
    }
    // ratio = 1 unless multiple monsters (scr_monsterpop); Jevil fights solo.
    e.ratio = 1;
  },

  step(e, state) {
    e.btimer += 1;
    if (e.joker !== 1) return;

    const r = state.gmlRng;
    const gt = box(state);

    if (e.gmlType === 70) {
      if (e.btimer >= 20 && state.turntimer >= 30) {
        const basexX = gt ? gt.x : state.view.x + 320;
        const basexY = gt ? gt.y : state.view.y + 170;
        // MEASURED (a70-fan.csv vs the seed-4242 stream): the GML VM
        // evaluates function arguments RIGHT-TO-LEFT, so the second arg's
        // random(100) draws FIRST; the choose draw then indexes args in
        // SOURCE order (u32 % argc, 0 = leftmost). Both facts are pinned by
        // the recorded first spawn (draw2 = x, draw5 = y, parity 0 = left).
        const xb = basexX + 100 + gmlRandom(r, 100);
        const xa = basexX - 100 - gmlRandom(r, 100);
        const jokerx = gmlChoose(r, [xa, xb]);
        const yb = basexY + gmlRandom(r, 100);
        const ya = basexY - gmlRandom(r, 100);
        const jokery = gmlChoose(r, [ya, yb]);
        const jokern = spawn(state, jokerTeleport, { x: jokerx, y: jokery });
        jokern.gmlType = 1;
        bulletInherit(e, jokern);
        jokern.active = 0;
        e.btimer = 0;
      }
      return;
    }

    // Suit bombs 46/48/49/50 share one block shape; per-type cadence and
    // bomb.type override differ. The random(100) here is CONDITIONAL —
    // only the chosen side's branch draws (unlike type 70's choose args).
    if (e.gmlType === 46 || e.gmlType === 48 || e.gmlType === 49 || e.gmlType === 50) {
      const cadence = e.gmlType === 49 ? 20 : 12;
      if (e.btimer >= cadence) {
        const xx = gmlChoose(r, [0, 1]);
        const basex = gt ? gt.x : state.view.x + 320;
        let idealx;
        if (xx === 0) {
          idealx = basex - 180 - gmlRandom(r, 100);
        }
        if (xx === 1) {
          idealx = basex + 180 + gmlRandom(r, 100);
        }
        const bomb = spawn(state, suitbomb, { x: idealx, y: -20 });
        bulletInherit(e, bomb);
        if (e.gmlType === 46 && bomb.gmlType === 2) {
          bomb.gmlType = gmlChoose(r, [0, 1, 2, 3]);
        }
        if (e.gmlType === 48) bomb.gmlType = 0;
        if (e.gmlType === 49) bomb.gmlType = 2;
        if (e.gmlType === 50) bomb.gmlType = 3;
        e.btimer = 0;
      }
      return;
    }

    if (e.gmlType === 65) {
      if (e.btimer >= 60) {
        const ring = spawn(state, spadering, { x: gt.x, y: gt.y });
        // Fields assigned AFTER instance_create, exactly as the original —
        // the ring's Create has already drawn startang; its first Step
        // (next frame) reads the overridden maxspade/grav.
        ring.maxspade = 10;
        ring.grav = 0.4;
        bulletInherit(e, ring);
        e.btimer = 0;
      }
      return;
    }

    if (e.gmlType === 68) {
      // with (obj_heart) wspeed = 5 — EVERY frame of the attack.
      if (state.soul && state.soul.alive) state.soul.wspeed = 5;
      if (e.btimer >= 54) {
        const ring = spawn(state, spadering, { x: gt.x, y: gt.y });
        ring.side = gmlChoose(state.gmlRng, [0, 1]);
        ring.grav = 0.45;
        ring.maxspade = 10;
        bulletInherit(e, ring);
        e.btimer = 0;
      }
      return;
    }

    if (e.gmlType === 71) {
      if (e.btimer >= 9 && state.turntimer >= 20) {
        const basexX = gt ? gt.x : state.view.x + 320;
        const basexY = gt ? gt.y : state.view.y + 170;
        const xa = basexX - 100 - gmlRandom(r, 100);
        const xb = basexX + 100 + gmlRandom(r, 100);
        const jokerx = gmlChoose(r, [xa, xb]);
        const ya = basexY - gmlRandom(r, 100);
        const yb = basexY + gmlRandom(r, 100);
        const jokery = gmlChoose(r, [ya, yb]);
        const jokern = spawn(state, jokerTeleport, { x: jokerx, y: jokery });
        bulletInherit(e, jokern);
        jokern.active = 0;
        e.btimer = 0;
      }
      return;
    }

    throw new Error(`obj_dbulletcontroller type ${e.gmlType} not translated yet`);
  },
};
