// obj_joker_teleport — Jevil's teleporting clone.
//
//   Create : gml_Object_obj_joker_teleport_Create_0  (41 lines)
//   Step   : gml_Object_obj_joker_teleport_Step_0    (97 lines)
//
// Launched by obj_dbulletcontroller types 70 (jokern.type = 1, five-spade
// fan) and 71 (default type 0, single aimed diamond). NOT a collidebullet
// child (parent obj_bulletparent), so the clone itself never collides with
// the soul — only the bullets it fires do.
//
// Lifecycle: con 0 appear (image_xscale += 0.4 to 2), con 1 wait 8 frames
// then FIRE (image_index 1), con 2 wait 10, con 4 vanish (xscale -= 0.4,
// yscale += 0.2) and destroy at xscale <= 0. The f32 narrowing of the
// xscale ramp is load-bearing for the exact destroy frame.
//
// Sounds (snd_swing on appear/vanish, snd_joker_oh at fire when type < 3)
// consume NO RNG in chapter 1 (snd_play is a bare audio_play_sound); cues
// are recorded on state for the audio layer.

import { spawn, destroy } from '../entity.js';
import { gmlGreater } from '../gml.js';
import { collidebullet, bulletInherit, moveTowardsPoint } from '../bullets/collidebullet.js';

export const jokerTeleport = {
  name: 'obj_joker_teleport',
  objIndex: 276, // dump object order

  create(e, state) {
    e.fire = 0;
    e.special = 0;
    e.con = 0;
    e.image_xscale = 0;
    e.image_speed = 0;
    e.timer = 0;
    e.image_yscale = 2;
    e.gmlType = 0; // GML `type` — renamed: e.type is the framework's handler ref
    e.damage = 100;
    e.grazed = 0;
    e.grazepoints = 4;
    e.timepoints = 2;
    e.inv = 60;
    e.grazetimer = 0;
    e.target = 0;
    e.sndcon = 0;
    e.sprite_index = 'spr_joker_teleport';
    // if (x < view.x + WView/2) sprite_index = spr_joker_teleport_r
    if (e.x < state.view.x + 320) {
      e.sprite_index = 'spr_joker_teleport_r';
    }
  },

  step(e, state) {
    if (e.con === 0) {
      if (e.sndcon === 0) {
        state.audio?.cue('snd_swing');
        e.sndcon = 1;
      }
      e.image_index = 0;
      if (e.image_xscale < 2) {
        e.image_xscale += 0.4;
      } else {
        e.image_xscale = 2;
        e.con = 1;
        e.timer = 0;
      }
    }
    if (e.con === 1) {
      e.timer += 1;
      if (e.timer >= 8) {
        if (e.sndcon === 1 && e.gmlType < 3) {
          state.audio?.cue('snd_joker_oh');
          e.sndcon = 2;
        }
        e.image_index = 1;
        e.con = 2;
        e.timer = 0;
        const heart = state.soul;
        if (e.gmlType === 0) {
          const bullet = spawn(state, collidebullet, { x: e.x, y: e.y });
          bullet.sprite_index = 'spr_diamondbullet';
          bullet.active = 1;
          bulletInherit(e, bullet);
          moveTowardsPoint(bullet, heart.x + 10, heart.y + 10, 8);
          bullet.image_angle = bullet.direction;
          bullet.image_xscale = 0.7;
          bullet.image_yscale = 0.7;
        }
        if (e.gmlType === 1) {
          for (let i = 0; i < 5; i += 1) {
            const bullet = spawn(state, collidebullet, { x: e.x, y: e.y });
            bullet.sprite_index = 'spr_spadebullet';
            bullet.active = 1;
            bullet.offset = 18 * i;
            bulletInherit(e, bullet);
            moveTowardsPoint(bullet, heart.x + 10, heart.y + 10, 4.5);
            bullet.direction = (bullet.direction - 36) + bullet.offset;
            bullet.image_angle = bullet.direction;
            bullet.image_xscale = 0.4;
            bullet.image_yscale = 0.4;
          }
        }
      }
    }
    if (e.con === 2) {
      e.timer += 1;
      if (e.timer >= 10) {
        e.con = 4;
        e.timer = 0;
      }
    }
    if (e.con === 4) {
      if (e.sndcon === 2) {
        state.audio?.cue('snd_swing');
        e.sndcon = 3;
      }
      // GML epsilon comparison — see gml.js GML_EPSILON (measured here).
      if (gmlGreater(e.image_xscale, 0)) {
        e.image_xscale -= 0.4;
        e.image_yscale += 0.2;
      } else {
        e.image_xscale = 0;
        e.con = 0;
        destroy(e);
      }
    }
  },
};
