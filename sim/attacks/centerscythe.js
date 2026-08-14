// obj_centerscythe — the Devilsknife (dc.type 75 = jattack 3, dc.type 76 =
// jattack 11; unused types 55-58 are the bigscythe family, not this).
//
//   Create : gml_Object_obj_centerscythe_Create_0  (90 lines)
//   Step   : gml_Object_obj_centerscythe_Step_0    (117 lines)
//
// Four scythes pendulum-swinging through the box centre on slowly rotating
// axes (length = cos(sine/18) * radius, position via SCRIPT lengthdir — f64
// trig, no mover residue). The FIRST instance created is KING
// (instance_number == 1): its Create spawns the other three (dir offsets
// 180/90/270 ADDED to the king's random base), then broadcasts
// mydir/sinespeed/dirspeed/insanity to ALL instances (GML object.field = v
// assigns to every instance). Type 76 (insanity 0) adds the king's
// side-scythe sequence: a big red collidebullet with mask_index
// spr_joker_scythebody_mask spinning in at alternating sides every 46
// frames.
//
// RNG per instance Create, IN ORDER: dir = random(70), dirspeed =
// 1.5 * choose(1, -1), and for dc.type 76 only scythesidex = choose(1, -1).
// The king's create runs its own draws, THEN spawns s2/s3/s4 (each drawing
// the same pattern) — 8 draws for type 75, 12 for type 76 per launch.
//
// Parent obj_regularbullet_permanent -> damages without destroying; the
// object-definition mask is spr_joker_scythebody_mask.

import { spawn, destroy } from '../entity.js';
import { gmlRandom, gmlChoose } from '../rng.js';
import { gmlGreater, gmlLess } from '../gml.js';
import { lengthdirX, lengthdirY } from '../gml.js';
import { bulletInherit } from '../bullets/collidebullet.js';
import { collidebullet } from '../bullets/collidebullet.js';

function scytheCreate(e, state) {
  e.isBullet = true;
  e.grazed = 0;
  e.grazepoints = 3;
  e.timepoints = 2;
  e.target = 0;
  e.inv = 120;
  e.damage = 124;
  e.grazetimer = 0;
  e.active = 0;
  e.image_alpha = 0;
  e.image_xscale = 1;
  e.image_yscale = 1;
  e.rotspeed = 0;
  e.insanity = 1;
  e.chasecon = 1;
  e.chasetimer = 0;
  e.centerx = 320;
  e.centery = 120;
  const gt = state.entities.find((o) => o.alive && o.isSolid);
  if (gt) {
    e.centerx = gt.x;
    e.centery = gt.y;
  }
  e.radius = 150;
  e.sine = 0;
  e.sinespeed = 1.4;
  e.dir = gmlRandom(state.gmlRng, 70);
  e.dirspeed = 1.5 * gmlChoose(state.gmlRng, [1, -1]);
  e.un = 0;
  e.scythetimer = -5;
  e.scythesidex = 1;
  e.swingnoise = 0;
  e.noisebuffer = 0;
  e.gmlType = 0; // GML `type`
  const dc = state.entities.find(
    (o) => o.alive && o.type.name === 'obj_dbulletcontroller',
  );
  if (dc && dc.gmlType === 76) {
    e.gmlType = 1;
  }
  e.king = 0;
  if (e.gmlType === 1) {
    e.image_xscale = 1;
    e.image_yscale = 1;
    e.insanity = 0;
    e.sinespeed = 1.3;
    e.scythesidex = gmlChoose(state.gmlRng, [1, -1]);
  }
  e.sprite_index = 'spr_joker_scythebody';
  e.mask_index = 'spr_joker_scythebody_mask';

  const others = state.entities.filter(
    (o) => o.alive && o.type.name === 'obj_centerscythe' && o !== e,
  );
  if (others.length === 0) {
    e.king = 1;
    e.x = e.centerx - e.radius;
    e.y = e.centery;
    const s2 = spawn(state, centerscythe, { x: e.centerx + e.radius, y: e.centery });
    s2.sine = 0;
    s2.dir = 180;
    s2.un = 1;
    const s3 = spawn(state, centerscythe, { x: e.centerx, y: e.centery - e.radius });
    s3.sine = 0;
    s3.dir = 90;
    s3.un = 0;
    const s4 = spawn(state, centerscythe, { x: e.centerx, y: e.centery + e.radius });
    s4.sine = 0;
    s4.dir = 270;
    s4.un = 1;
    // obj_centerscythe.field = v assigns to EVERY instance.
    const all = [e, s2, s3, s4];
    for (const s of all) {
      s.mydir = e.dir;
      s.sinespeed = e.sinespeed;
      s.dirspeed = e.dirspeed;
      s.insanity = e.insanity;
    }
    for (const s of all) {
      if (s.dir !== s.mydir) {
        s.dir += s.mydir;
      }
      s.x = s.centerx - lengthdirX(s.radius, s.dir);
      s.y = s.centery - lengthdirY(s.radius, s.dir);
    }
  }
  e.wall_destroy = 0;
}

export const centerscythe = {
  name: 'obj_centerscythe',
  objIndex: 272, // dump object order
  create: scytheCreate,

  step(e, state) {
    if (e.chasecon === 1) {
      e.image_alpha += 0.04;
      if (e.image_alpha >= 1) {
        e.image_alpha = 1;
        e.chasecon = 2;
        e.active = 1;
      }
    }
    if (e.chasecon === 2) {
      if (e.un === 0) {
        if (e.rotspeed <= 10) {
          e.rotspeed += 1;
        }
      }
      if (e.un === 1) {
        if (e.rotspeed >= -10) {
          e.rotspeed -= 1;
        }
      }
      e.sine += e.sinespeed;
      e.dir += e.dirspeed;
      if (e.insanity === 1) {
        // GML epsilon bounds: the f64 sum of 0.01-steps lands within 1e-5
        // of +-3 and the runner stops one increment earlier than a plain
        // comparison (a75 f177: 0.04px scythe drift growing from there).
        if (gmlGreater(e.dirspeed, 0) && gmlLess(e.dirspeed, 3)) {
          e.dirspeed += 0.01;
        }
        if (gmlLess(e.dirspeed, 0) && gmlGreater(e.dirspeed, -3)) {
          e.dirspeed -= 0.01;
        }
      }
      e.length = Math.cos(e.sine / 18) * e.radius;
      e.x = e.centerx - lengthdirX(e.length, e.dir);
      e.y = e.centery - lengthdirY(e.length, e.dir);
      if (e.king === 1) {
        e.noisebuffer -= 1;
        if (Math.abs(e.length) <= 8 && e.noisebuffer < 0) {
          state.audio?.cue('snd_swing');
          e.noisebuffer = 10;
        }
      }
    }
    if (e.king === 1) {
      if (e.gmlType === 1) {
        e.scythetimer += 1;
        if (e.scythetimer === 60) {
          state.audio?.cue('snd_spearappear');
          const sbul = spawn(state, collidebullet, {
            x: e.centerx + e.radius * e.scythesidex,
            y: e.centery + 60 * e.scythesidex,
          });
          sbul.image_xscale = 2;
          sbul.image_yscale = 2;
          sbul.image_alpha = 0;
          sbul.sprite_index = 'spr_joker_scythebody';
          sbul.mask_index = 'spr_joker_scythebody_mask';
          sbul.image_blend = 'c_red';
          sbul.active = 1;
          bulletInherit(e, sbul);
          e.sbul = sbul;
        }
        if (e.scythetimer >= 60 && e.scythetimer < 70) {
          if (e.sbul && e.sbul.alive) {
            e.sbul.image_angle = (e.sbul.image_angle ?? 0) + 10 * e.scythesidex;
            e.sbul.image_alpha += 0.1;
          }
        }
        if (e.scythetimer >= 85 && e.scythetimer < 90) {
          if (e.sbul && e.sbul.alive) {
            e.sbul.componentMotion = true;
            e.sbul.hspeed = (e.sbul.hspeed ?? 0) - 3 * e.scythesidex;
            e.sbul.vspeed = e.sbul.vspeed ?? 0;
          }
        }
        if (e.scythetimer >= 100 && e.scythetimer < 105) {
          if (e.sbul && e.sbul.alive) {
            e.sbul.image_alpha -= 0.2;
          }
        }
        if (e.scythetimer >= 105) {
          if (e.sbul && e.sbul.alive) {
            destroy(e.sbul);
          }
          if (e.scythesidex === -1) {
            e.scythesidex = 1;
          } else {
            e.scythesidex = -1;
          }
          e.scythetimer = 59;
        }
      }
    }
    e.image_angle = (e.image_angle ?? 0) + e.rotspeed;
    if (e.grazed === 1) {
      e.grazetimer += 1;
      if (e.grazetimer >= 30) {
        e.grazed = 0;
        e.grazetimer = 0;
      }
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
