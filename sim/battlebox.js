// The battle box — CHAPTER 1's obj_growtangle.
//
//   Create : gml_Object_obj_growtangle_Create_0  (11 lines)
//   Step   : gml_Object_obj_growtangle_Step_0    (grow/shrink ramp)
//   Step_2 : gml_Object_obj_growtangle_Step_2    (moving-box heart clamp,
//            keep == 1 only — not modelled until an attack needs it)
//
// obj_growtangle's parent object is obj_battlesolid, so the box itself is
// what place_meeting(…, obj_battlesolid) hits: the hollow-ring precise mask
// of spr_battlebg_0, scaled by image_xscale/yscale, origin centred (37,37).
//
// CHAPTER 1 vs chapter 3: no maxxscale/maxyscale fields and no custom-arena
// sprite swap — the target is always scale 2 (`image_xscale = 2 * (timer /
// maxtimer)`), and the grow-in spins image_angle 180 -> 360 over 15 frames
// exactly like chapter 3's default box.
//
// This module models the box ALREADY GROWN (scale 2, angle 0), the steady
// state every attack plays out in. The 15-frame grow-in is deliberately not
// modelled for collision until it gets its own oracle study (knight-sim's
// t3 pinned the alignment for chapter 3; chapter 1 gets its own trace).

import { mergeColor } from './gml.js';
import { destroy } from './entity.js';
import { BATTLEBG_MASK } from './masks.js';

/** Put a box straight into its settled state. */
export function settleBox(gt) {
  gt.growcon = 2;
  gt.timer = gt.maxtimer;
  gt.image_xscale = 2;
  gt.image_yscale = 2;
  gt.image_angle = 0;
  gt.image_alpha = 1;
  gt.fullgrow = 1;
  return gt;
}

export const battlebox = {
  name: 'obj_growtangle',
  objIndex: 311, // dump object order

  create(e) {
    // obj_growtangle Create, verbatim fields.
    e.image_xscale = 0;
    e.image_yscale = 0;
    e.image_alpha = 0.3;
    e.timer = 0;
    e.maxtimer = 15;
    e.growcon = 1;
    e.image_speed = 0;
    // merge_color(c_green, c_lime, 0.5) — c_green RGB(0,128,0), c_lime
    // RGB(0,255,0).
    e.image_blend = mergeColor([0, 128, 0], [0, 255, 0], 0.5);
    e.fullgrow = 0;
    e.keep = 0;
    e.megakeep = 0;

    e.isSolid = true; // parent: obj_battlesolid
    e.mask = BATTLEBG_MASK;
    e.sprite_index = 'spr_battlebg_0';
    e.xstart = e.x;
    e.ystart = e.y;
  },

  step(e) {
    // obj_growtangle Step_0, verbatim. Afterimages are cosmetic (renderer
    // reads timer/growcon); they consume no RNG.
    let growth = 0;
    if (e.timer < e.maxtimer && e.growcon === 1) {
      growth = 1;
    }
    if (e.timer > 0 && e.growcon === 3) {
      growth = 1;
    }
    if (growth === 1) {
      if (e.growcon === 1) e.timer += 1;
      if (e.growcon === 3) e.timer -= 1;
      e.image_xscale = 2 * (e.timer / e.maxtimer);
      e.image_yscale = 2 * (e.timer / e.maxtimer);
      e.image_angle = 180 + 180 * (e.timer / e.maxtimer);
      e.image_alpha = 0.5 + (e.timer / e.maxtimer) * 0.5;
      if (e.timer >= e.maxtimer && e.growcon === 1) {
        e.growcon = 2;
        e.image_angle = 0;
      }
      if (e.timer <= 0 && e.growcon === 3) {
        // instance_destroy() — as in the GML. A shrunk box that lingers
        // makes the next attack's "a growtangle exists" check skip the
        // fresh spawn, and the whole attack plays with NO wall mask
        // (caught by fullfight-pacify's FINAL CHAOS descent: the runner's
        // heart ejects +10 off the box's bottom band, the sim's slid
        // through a scale-0 ghost).
        destroy(e);
      }
    }
  },
};
