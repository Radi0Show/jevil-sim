// obj_laserscythe — FINAL CHAOS's falling Devilsknife (dc.type 77 only).
//
//   Create   : gml_Object_obj_laserscythe_Create_0  (spinning fall,
//              image_angle = random(360) — ONE DRAW per scythe)
//   Step     : gml_Object_obj_laserscythe_Step_0    (fall -> explode into a
//              light pillar at room_height - 100 -> collapse)
//   Other_15 : BESPOKE pillar damage (30% party HP cut, or scr_damage_all
//              when average HP < 10) — sterilized identically on both sides
//              until the damage system lands
//   Draw     : cosmetic (remembered scythe drawn while the pillar body is
//              spr_tallpx)
//
// The pillar phase: mask/sprite swap to spr_tallpx (a 2px-wide full-height
// strip scaled out to xscale 32 then back), y = 0, active toggles with the
// expansion. GRAZE feeds the controller (`made += 0.2` shortens the attack)
// — inert in the sterilized lab config, verified with the graze system.
//
// room_height is 480 in the fight room; the harness resizes
// room_battletest to match (state.roomHeight here).

import { destroy } from '../entity.js';
import { gmlRandom } from '../rng.js';

export const laserscythe = {
  name: 'obj_laserscythe',
  objIndex: 273, // dump object order

  create(e, state) {
    e.isBullet = true;
    e.componentMotion = true;
    e.grazed = 0;
    e.grazepoints = 15;
    e.timepoints = 0;
    e.target = 0;
    e.inv = 120;
    e.damage = 124;
    e.active = 1;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_angle = gmlRandom(state.gmlRng, 360);
    e.rotspeed = 14;
    e.hspeed = 0;
    e.vspeed = 5;
    e.mask_index = 'spr_joker_scythebody_mask';
    e.gravity = 1;
    e.explode = 0;
    e.explodetimer = 0;
    e.remrot = e.image_angle;
    e.remy = e.y;
    e.remx = e.x;
    e.scale = 2;
    e.sprite_index = 'spr_joker_scythebody';
  },

  step(e, state) {
    const roomHeight = state.roomHeight ?? 480;
    if (e.explode === 0) {
      e.remx = e.x;
      e.remy = e.y;
      e.image_angle += e.rotspeed;
      e.remrot = e.image_angle;
    }
    if (e.y >= roomHeight - 100 && e.explode === 0) {
      state.audio?.cue('snd_scytheburst');
      e.remx = e.x;
      e.remy = e.y;
      e.explode = 1;
      e.explodetimer = 0;
      e.remrot = e.image_angle;
      e.image_angle = 0;
      e.speed = 0;
      e.hspeed = 0;
      e.vspeed = 0;
      e.gravity = 0;
      e.mask_index = 'spr_tallpx';
      e.sprite_index = 'spr_tallpx';
      e.grazed = 0;
      e.y = 0;
      e.depth = (e.depth ?? 0) + 1;
    }
    if (e.explode === 1) {
      e.active = 0;
      e.image_xscale += 8;
      if (e.image_xscale >= 16) {
        e.active = 1;
      }
      if (e.image_xscale >= 32) {
        e.explode = 2;
      }
    }
    if (e.explode === 2) {
      e.image_xscale -= 4;
      if (e.image_xscale <= 16) {
        e.image_alpha -= 0.25;
        e.active = 0;
      }
      if (e.image_xscale <= 0) {
        destroy(e);
      }
    }
    if (e.grazed === 1) {
      for (const dc of state.entities) {
        if (dc.alive && dc.type.name === 'obj_dbulletcontroller') {
          dc.made += 0.2;
        }
      }
      e.grazed = 2;
    }
  },

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      // Bespoke pillar damage — lands with the damage system:
      // inv = invc*40; average party HP >= 10 -> each standing member to
      // ceil(hp * 0.7); else scr_damage_all().
      throw new Error('laserscythe pillar damage not yet translated');
    }
    // Sterilized recorder counts without destroying (laserscythe has no
    // destroy-on-hit).
  },
};

/** scr_dark_marker / obj_marker — inert visual carrier whose fields the
 *  type-77 controller reads (darkfader/fadewhite alphas). No events. */
export const marker = {
  name: 'obj_marker',
  objIndex: 86, // dump object order
};
