// obj_carouselbullet — the Carousel (dc.type 62 = jattack 4, dc.type 61 =
// jattack 8; type 60 is unreachable content).
//
//   Create : gml_Object_obj_carouselbullet_Create_0  (26 lines)
//   Step   : gml_Object_obj_carouselbullet_Step_0    (62 lines, replaces
//            the parent's — no event_inherited, so wall_destroy is
//            vestigial and horses persist all turn)
//
// Horses ride a 2D "cylinder": x is a pure function of a running sine
// (x = box.x - sin(siner/20)*150), the sine's per-frame DERIVATIVE
// (sinsign) picks the face — front face (sinsign < 0) is white, active,
// depth 0; back face (sinsign > 0) is gray, INACTIVE, drawn behind
// (depth 21). image_xscale = sinsign * 50 clamped to ±2 gives the flip.
// Vertical bobbing y += sin(vsin/10) * 3.5 (altmode 1 subtracts).
//
// EPSILON comparisons everywhere a computed real meets a bound: sinsign
// hovers within 1e-5 of zero at the cylinder's edges, where GML's
// math_set_epsilon makes BOTH face tests false (gml.js GML_EPSILON).
//
// spr_carousel has ONE precise mask for all 3 frames (horse/duck/Everyman)
// covering only the BODY (bbox [12,18]-[25,24]) — the wiki's "only the
// bodies have hitboxes", confirmed from the data file.

import { gmlGreater, gmlLess, gmlGreaterEq } from '../gml.js';

export const carouselbullet = {
  name: 'obj_carouselbullet',
  objIndex: 275, // dump object order

  create(e) {
    e.isBullet = true;
    e.siner = 0;
    e.siner2 = 0;
    e.t = 0;
    e.componentMotion = true;
    e.hspeed = 6;
    e.vspeed = 0;
    e.sinspeed = 1;
    e.altmode = 0;
    e.altsin = 0;
    e.timer = 0;
    e.difficulty = 1;
    e.times = 0;
    e.activetimer = 0;
    e.grazed = 0;
    e.grazepoints = 10;
    e.timepoints = 10;
    e.target = 0;
    e.inv = 120;
    e.damage = 124;
    e.active = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_alpha = 0;
    e.image_speed = 0;
    e.gmlType = 0; // GML `type`
    e.con = 0;
    e.vsin = 0;
    e.wall_destroy = 0;
    e.sprite_index = 'spr_carousel';
  },

  step(e, state) {
    const gt = state.entities.find((o) => o.alive && o.isSolid);
    if (e.t <= 25) {
      e.image_alpha += 0.04;
    }
    if (e.t === 25) {
      e.active = 1;
    }
    if (e.t === 0) {
      e.maxspeed = Math.abs(e.hspeed);
      e.hspeed = 0;
    }
    e.t += 1;
    e.siner += e.sinspeed;
    const sinfactor_0 = Math.sin((e.siner - 1) / 20);
    const sinfactor = Math.sin(e.siner / 20);
    const sinsign = sinfactor - sinfactor_0;
    e.x = gt.x - sinfactor * 150;
    e.image_xscale = sinsign * 50;
    if (gmlGreater(e.image_xscale, 2)) {
      e.image_xscale = 2;
    }
    if (gmlLess(e.image_xscale, -2)) {
      e.image_xscale = -2;
    }
    if (gmlGreater(sinsign, 0)) {
      e.depth = 21;
      e.active = 0;
      e.image_blend = 'c_gray';
    }
    if (gmlLess(sinsign, 0)) {
      e.depth = 0;
      if (gmlGreaterEq(e.image_alpha, 1)) {
        e.active = 1;
      }
      e.image_blend = 'c_white';
    }
    e.vsin += 1;
    if (e.altmode === 0 || e.altmode === 2 || e.altmode === 3) {
      e.y += Math.sin(e.vsin / 10) * 3.5;
    }
    if (e.altmode === 1) {
      e.y -= Math.sin(e.vsin / 10) * 3.5;
    }
    if (e.altmode === 99) {
      e.altsin += 1;
      e.y += Math.cos(e.altsin / 20) * 2;
    }
    if (e.altmode === 99) {
      e.altsin += 1;
      e.y += Math.cos(e.altsin / 10) * 2;
    }
  },

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      throw new Error('chapter 1 damage path not yet translated');
    }
    // regularbullet_permanent: no destroy.
  },
};
