// The chapter 1 graze system — obj_grazebox's collision event, verbatim.
//
//   gml_Object_obj_grazebox_Collision_obj_collidebullet (42 lines)
//
// The 50x50 graze square (spr_grazemask, AxisAlignedRect, origin-centred)
// rides the heart at (+10, +10) — ONE FRAME BEHIND, because the box
// repositions in its End Step (stepFrame keeps state.grazePrev for exactly
// this). Per overlapping bullet, gated on global.inv < 0:
//
//   first contact (grazed == 0): tension += grazepoints;
//     turntimer -= timepoints when turntimer >= 10; grazenoise; the box's
//     flash timer to 10
//   trickle (grazed == 1): tension += grazepoints/20;
//     turntimer -= timepoints/20 when >= 10; flash timer bumps
//
// scr_tensionheal clamps at maxtension (250). Bullets carry grazed
// per-instance; permanent bullets re-arm it themselves (obj_centerscythe
// clears grazed after 30 frames; obj_laserscythe converts grazed == 1 into
// controller `made += 0.2`).

import { GRAZE_MASK, SPRITE_MASKS, masksOverlap } from './masks.js';

export function scrTensionheal(state, amount) {
  state.tension += amount;
  if (state.tension > state.maxtension) {
    state.tension = state.maxtension;
  }
}

function grazes(e, gx, gy) {
  const mask = e.mask ?? SPRITE_MASKS[e.mask_index ?? e.sprite_index] ?? null;
  if (!mask) return false;
  return masksOverlap(
    GRAZE_MASK, gx, gy,
    mask, e.x, e.y, e.image_xscale ?? 1, e.image_yscale ?? 1, e.image_angle ?? 0,
  );
}

/** One bullet's graze pair — called from the per-bullet collision walk. */
export function grazeBullet(state, b) {
  if (!state.grazeEnabled) return;
  if (!state.grazePrev) return;
  const { x: gx, y: gy } = state.grazePrev;
  {
    if (!b.alive || !b.isBullet) return;
    if (b.grazepoints === undefined) return;
    if (!grazes(b, gx, gy)) return;

    if (state.invTimer < 0) {
      if (b.grazed === 1) {
        scrTensionheal(state, b.grazepoints / 20);
        if (state.turntimer >= 10) {
          state.turntimer -= b.timepoints / 20;
        }
        if (state.grazeFlash >= 0 && state.grazeFlash < 4) {
          state.grazeFlash = 3;
        }
        if (state.grazeFlash < 2) {
          state.grazeFlash = 2;
        }
      }
      if (b.grazed === 0) {
        b.grazed = 1;
        scrTensionheal(state, b.grazepoints);
        if (state.turntimer >= 10) {
          state.turntimer -= b.timepoints;
        }
        state.audio?.cue('snd_graze'); // bc grazenoise relay (Step_0:829-831)
        state.grazeFlash = 10;
      }
    }
  }
}
