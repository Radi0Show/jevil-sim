// obj_dbullet_vert — the rising diamonds (dc.type 73 = jattack 6 "Diamond
// Release", dc.type 74 = jattack 14 "Diamond Release II", the fakeout with
// grazepoints 12).
//
//   Create : gml_Object_obj_dbullet_vert_Create_0  (46 lines — clamps its
//            spawn y into view band [20, 460], defaults, suicide without a
//            heart; type = 0)
//   Draw   : gml_Object_obj_dbullet_vert_Draw_0    (71 lines — ALL the
//            behaviour lives in the DRAW event)
//
// Draw-event translation: the logic runs in endStep (draw follows step and
// motion in the frame; velocity writes take effect next frame either way).
// `dont = 1` from Create skips the FIRST draw — the object is created
// mid-frame and GameMaker draws it that same frame, so the skip is load-
// bearing; endStep on the spawn frame reproduces it exactly.
//
// type 1 (dc 73): during fade-in every frame vspeed = 3, gravity = -0.5 —
// launched downward, gravity flings it up through the board.
// type 0 (dc 74): at full alpha aims vertically at the heart (above:
// vspeed 1 grav -0.2; below: vspeed -2 grav 1), then speed clamps at 8.
// Destroys beyond view y +500 / -20. Parent obj_collidebullet -> destroy
// on hit; active starts 0 (harmless while faded).

import { destroy } from '../entity.js';
import { gmlGreater } from '../gml.js';

export const dbulletVert = {
  name: 'obj_dbullet_vert',
  objIndex: 238, // dump object order

  create(e, state) {
    e.isBullet = true;
    e.componentMotion = true;
    e.hspeed = 0;
    e.vspeed = 0;
    if (e.y < state.view.y + 20) {
      e.y = state.view.y + 20;
    }
    if (e.y > state.view.y + 460) {
      e.y = state.view.y + 460;
    }
    e.difficulty = 1;
    e.times = 0;
    e.activetimer = 0;
    e.grazed = 0;
    e.grazepoints = 5;
    e.timepoints = 5;
    e.target = 0;
    e.dont = 1;
    e.inv = 120;
    e.damage = 124;
    e.active = 0;
    e.image_alpha = 0;
    if (!state.soul || !state.soul.alive) {
      destroy(e);
    }
    e.gmlType = 0; // GML `type`
    e.sprite_index = 'spr_diamondbullet_vert';
  },

  endStep(e, state) {
    if (e.dont === 0) {
      if (e.active === 0) {
        if (e.image_alpha < 1) {
          e.image_alpha += 0.1;
          if (e.gmlType === 1) {
            e.vspeed = 3;
            e.gravity = -0.5;
          }
        } else {
          if (e.gmlType === 0) {
            if (state.soul.y + 8 < e.y) {
              e.vspeed = 1;
              e.gravity = -0.2;
            } else {
              e.vspeed = -2;
              e.gravity = 1;
            }
          }
          e.active = 1;
        }
      }
      if (e.gmlType === 0) {
        // GML epsilon comparison; speed is the component magnitude.
        if (gmlGreater(e.speed, 8)) {
          // Rescale components to magnitude 8, preserving direction.
          const mag = Math.sqrt(e.hspeed * e.hspeed + e.vspeed * e.vspeed);
          if (mag > 0) {
            e.hspeed = (e.hspeed / mag) * 8;
            e.vspeed = (e.vspeed / mag) * 8;
          }
          e.speed = 8;
        }
      }
      if (e.y > state.view.y + 500) {
        destroy(e);
      }
      if (e.y < state.view.y - 20) {
        destroy(e);
      }
    }
    e.dont = 0;
  },

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      throw new Error('chapter 1 damage path not yet translated');
    }
    destroy(b);
  },
};
