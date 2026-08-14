// obj_clubsbullet_dark — the Three-Club Attack's dark club (dc.type 72 =
// jattack 10).
//
//   Create : gml_Object_obj_clubsbullet_dark_Create_0  (14 lines)
//   Step   : gml_Object_obj_clubsbullet_dark_Step_0    (105 lines)
//
// The controller hurls it from radius 360 at a diagonal (speed 20,
// friction 1 — it decelerates to a stop over 20 frames near the board),
// then, as dc.type 72 sets gmlType 2: three volleys at dtimer 20/22/24,
// each re-aiming at the soul (move_towards_point speed 0.1 — an AIM, the
// residual 0.1 speed is real) and fanning three clubsball regularbullets
// (b at -2, c at -21, a at +17 degrees, all +initangle which steps +2 per
// volley), speed 5. Afterimage + self-destroy at dtimer 26 (renderer's
// afterimage; the destroy is the sim's).
//
// The dark club itself is a bulletparent child — no contact; only the
// balls hit. gmlType 0 (volleys at 15/19/23, speed 4) has no reachable
// creator with type left at 0 — the controller always sets 2 — but the
// block is translated for completeness since the SAME object serves both.

import { destroy, spawn } from '../entity.js';
import { bulletInherit, moveTowardsPoint } from '../bullets/collidebullet.js';
import { regularbullet } from '../bullets/regularbullet.js';

function fireBall(state, e, sprite, direction, speed) {
  // NO inherit here: type 0 assigns fields explicitly (balls keep their
  // regularbullet defaults otherwise), type 2 inherits — per the source.
  const bul = spawn(state, regularbullet, { x: e.x, y: e.y });
  bul.sprite_index = sprite;
  bul.direction = direction;
  bul.speed = speed;
  bul.image_angle = e.direction;
  return bul;
}

export const clubsbulletDark = {
  name: 'obj_clubsbullet_dark',
  objIndex: 236, // dump object order

  create(e) {
    e.builtinMotion = true;
    e.difficulty = 1;
    e.times = 0;
    e.activetimer = 0;
    e.grazed = 0;
    e.grazepoints = 1;
    e.timepoints = 1;
    e.target = 0;
    e.dont = 1;
    e.inv = 120;
    e.damage = 124;
    e.active = 0;
    e.dtimer = 0;
    e.gmlType = 0; // GML `type`
    e.initangle = 0;
    e.sprite_index = 'spr_clubsbullet_dark';
  },

  step(e, state) {
    e.dtimer += 1;
    const heart = state.soul;
    if (e.gmlType === 0) {
      if (e.dtimer === 15 || e.dtimer === 19 || e.dtimer === 23) {
        moveTowardsPoint(e, heart.x + 8, heart.y + 8, 0.1);
        for (const [spr, dd] of [['spr_clubsball_b', 0], ['spr_clubsball_c', -17], ['spr_clubsball_a', 17]]) {
          const bul = fireBall(state, e, spr, e.direction + dd, 4);
          bul.damage = e.damage;
          bul.target = e.target;
          bul.grazepoints = 2;
          bul.timepoints = 1;
        }
      }
      if (e.dtimer === 25) {
        destroy(e); // afterimage is the renderer's
      }
    }
    if (e.gmlType === 2) {
      if (e.dtimer === 20 || e.dtimer === 22 || e.dtimer === 24) {
        moveTowardsPoint(e, heart.x + 8, heart.y + 8, 0.1);
        bulletInherit(e, fireBall(state, e, 'spr_clubsball_b', (e.direction - 2) + e.initangle, 5));
        bulletInherit(e, fireBall(state, e, 'spr_clubsball_c', (e.direction - 19 - 2) + e.initangle, 5));
        bulletInherit(e, fireBall(state, e, 'spr_clubsball_a', ((e.direction + 19) - 2) + e.initangle, 5));
        e.initangle += 2;
      }
      if (e.dtimer === 26) {
        destroy(e);
      }
    }
  },
};
