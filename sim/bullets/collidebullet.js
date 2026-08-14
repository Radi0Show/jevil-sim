// obj_collidebullet — chapter 1's bare contact bullet.
//
// The object has NO Create and NO Step of its own (parent obj_bulletparent
// is codeless too): every field is assigned by whoever spawns it, it moves
// only by built-in speed/direction, and — measured fact of chapter 1 — it
// NEVER despawns offscreen. Plain collidebullets fly forever until they hit
// (Other_15 destroys them) or the turn teardown destroys every bulletparent.
//
//   Other_15 : gml_Object_obj_collidebullet_Other_15
//     if (active == 1) { target != 3 ? scr_damage() : scr_damage_all();
//                        instance_destroy(); }
//
// Contact uses the DEFAULT mask (mask_index -1 = own sprite): runCollisions
// falls back to SPRITE_MASKS[sprite_index], so the spawner's sprite choice
// decides the hitbox (spr_spadebullet / spr_diamondbullet are registered).
//
// The damage path itself (scr_damage / scr_damage_all — chapter 1 targeting,
// DEFEND 2/3, DF*3, floor 1) lands with its own suite; until then
// state.damageEnabled === false mirrors the sterilized oracle recorder
// (hit counter + destroy, no party effects).

import { destroy } from '../entity.js';
import { scrDamage, scrDamageAll } from '../damage.js';

export const collidebullet = {
  name: 'obj_collidebullet',
  objIndex: 201, // dump object order

  create(e) {
    e.isBullet = true;
    e.builtinMotion = true;
    // No defaults — the original has no Create. Spawners assign
    // sprite_index, active, damage, grazepoints, timepoints, inv, target,
    // grazed, grazetimer (scr_bullet_inherit) and the motion fields.
  },

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      if (b.target !== 3) {
        scrDamage(state, b);
      } else {
        scrDamageAll(state, b);
      }
    }
    destroy(b);
  },
};

/** scr_bullet_inherit, called with the SPAWNER's fields (dc scope). */
export function bulletInherit(spawner, b) {
  b.damage = spawner.damage;
  b.grazepoints = spawner.grazepoints;
  b.timepoints = spawner.timepoints;
  b.inv = spawner.inv;
  b.target = spawner.target;
  b.grazed = 0;
  b.grazetimer = 0;
}

/** GML move_towards_point: aim direction at (tx, ty), set speed. */
export function moveTowardsPoint(e, tx, ty, spd) {
  let dir = (Math.atan2(-(ty - e.y), tx - e.x) * 180) / Math.PI;
  if (dir < 0) dir += 360;
  e.direction = dir;
  e.speed = spd;
}
