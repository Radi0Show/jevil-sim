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
import { lengthdirX, lengthdirY, gmlGreaterEq, gmlLessEq } from '../gml.js';
import { jokerTeleport } from './joker-teleport.js';
import { spadering } from './spadering.js';
import { suitbomb } from './suitbomb.js';
import { carouselbullet } from './carousel.js';
import { dbulletVert } from './dbullet-vert.js';
import { clubsbulletDark } from './clubs-dark.js';
import { laserscythe, marker } from './laserscythe.js';
import { centerscythe } from './centerscythe.js';
import { bulletInherit } from '../bullets/collidebullet.js';

function box(state) {
  // obj_battlesolid.x — first live solid (the battle box).
  return state.entities.find((o) => o.alive && o.isSolid);
}

export const dbulletController = {
  name: 'obj_dbulletcontroller',
  objIndex: 241, // dump object order

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

    if (e.gmlType === 62) {
      if (e.btimer >= 40 && e.made === 0) {
        e.btimer = 0;
        e.made = 1;
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 7; j += 1) {
            const horse1 = spawn(state, carouselbullet, {
              x: gt.x + 150,
              y: (gt.y - 80) + i * 80,
            });
            horse1.siner = j * 18;
            horse1.vsin = j * 9;
            horse1.sinspeed = 1.15;
            horse1.altmode = 3;
            bulletInherit(e, horse1);
          }
        }
      }
      return;
    }

    if (e.gmlType === 61) {
      if (e.btimer >= 40 && e.made === 0) {
        e.btimer = 0;
        e.made = 1;
        let horse = 0;
        const vseed = gmlRandom(r, 300);
        for (let j = 0; j < 3; j += 1) {
          for (let i = 0; i < 3; i += 1) {
            let horse1 = spawn(state, carouselbullet, {
              x: gt.x + 150,
              y: (gt.y - 80) + i * 80,
            });
            horse1.siner = j * 42;
            horse1.vsin = 0 + vseed;
            horse1.image_index = 0;
            horse1.altmode = 2;
            horse1.sinspeed = 1.1;
            bulletInherit(e, horse1);
            horse1 = spawn(state, carouselbullet, {
              x: gt.x + 150,
              y: (gt.y - 80) + i * 80,
            });
            horse1.siner = (j * 42) + 21;
            horse1.vsin = 0 + vseed;
            horse1.image_index = 1;
            horse1.altmode = 1;
            horse1.sinspeed = 1.1;
            bulletInherit(e, horse1);
            const chance = Math.floor(gmlRandom(r, 50));
            if (chance === 1) {
              horse1.image_index = 2; // Everyman (cosmetic; shared body mask)
            }
          }
          if (horse === 0) {
            horse = 1;
          } else {
            horse = 0;
          }
        }
      }
      return;
    }

    if (e.gmlType === 72) {
      if (e.btimer >= 18) {
        e.btimer = 0;
        let dir;
        if (e.side === 1) {
          dir = gmlChoose(r, [225, 315]);
        }
        if (e.side === -1) {
          dir = gmlChoose(r, [45, 135]);
        }
        const radius = 360;
        const xx = lengthdirX(radius, dir);
        const yy = lengthdirY(radius, dir);
        const d = spawn(state, clubsbulletDark, {
          x: state.soul.x + 8 + xx,
          y: state.soul.y + 8 + yy,
        });
        d.direction = dir + 180;
        d.speed = 20;
        d.friction = 1;
        d.gmlType = 2;
        d.damage = e.damage;
        d.target = e.target;
        d.image_angle = d.direction;
        if (e.side === 1) {
          e.side = -1;
        } else {
          e.side = 1;
        }
      }
      return;
    }

    if (e.gmlType === 73) {
      if (e.btimer >= 4) {
        e.btimer = 0;
        const radius = 140 + gmlRandom(r, 40);
        const yy = radius * e.side;
        let xx = -100 + gmlRandom(r, 200);
        const num = gmlChoose(r, [0, 1, 2, 3]);
        if (num === 3) {
          xx = -10 + gmlRandom(r, 20);
        }
        if (gt) {
          const db = spawn(state, dbulletVert, {
            x: state.soul.x + 8 + xx,
            y: gt.y + 100,
          });
          db.gmlType = 1;
          db.damage = e.damage;
          db.target = e.target;
          db.timepoints = 2;
        }
      }
      return;
    }

    if (e.gmlType === 74) {
      if (e.btimer >= 9) {
        e.btimer = 0;
        const radius = 140 + gmlRandom(r, 40);
        const yy = radius * e.side;
        let xx = -100 + gmlRandom(r, 200);
        const num = gmlChoose(r, [0, 1, 2, 3]);
        if (num === 3) {
          xx = -10 + gmlRandom(r, 20);
        }
        const d = spawn(state, dbulletVert, {
          x: state.soul.x + 8 + xx,
          y: state.soul.y + 8 + yy,
        });
        d.grazepoints = 12;
        d.timepoints = 2;
        d.damage = e.damage;
        d.target = e.target;
      }
      return;
    }

    if (e.gmlType === 75 || e.gmlType === 76) {
      if (e.btimer >= 0 && e.special === 0) {
        state.audio?.cue('snd_spearappear');
        spawn(state, centerscythe, { x: 0, y: 0 });
        // obj_centerscythe.field = v assigns to EVERY instance — all four
        // exist by the time the create returns.
        for (const s of state.entities) {
          if (!s.alive || s.type.name !== 'obj_centerscythe') continue;
          s.damage = e.damage;
          s.grazepoints = e.grazepoints;
          s.timepoints = e.timepoints;
          s.inv = e.inv;
          s.target = e.target;
          s.grazed = 0;
          s.grazetimer = 0;
        }
        e.special = 1;
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
        // RIGHT-TO-LEFT arg evaluation, same as type 70 (the a71 recording's
        // stream mapping confirms: first draw of each pair = the second
        // argument). This block MISSED the original RTL fix — the replace-all
        // keyed on a comment that only existed in the type-70 block, and the
        // desync surfaced as spawn-1 position mismatch, misread for a session
        // as an f80 event because only the differ's TAIL was ever inspected.
        const xb = basexX + 100 + gmlRandom(r, 100);
        const xa = basexX - 100 - gmlRandom(r, 100);
        const jokerx = gmlChoose(r, [xa, xb]);
        const yb = basexY + gmlRandom(r, 100);
        const ya = basexY - gmlRandom(r, 100);
        const jokery = gmlChoose(r, [ya, yb]);
        const jokern = spawn(state, jokerTeleport, { x: jokerx, y: jokery });
        bulletInherit(e, jokern);
        jokern.active = 0;
        e.btimer = 0;
      }
      return;
    }

    if (e.gmlType === 77) {
      state.sp = 10;
      if (state.soul && state.soul.alive) state.soul.wspeed = 10;
      if (e.special === 0) {
        state.audio?.cue('snd_joker_byebye');
        e.prevmake = 0;
        e.special = 1;
        e.rank = 16;
        e.realtimer = 0;
        e.chase = 0;
        e.made = 0;
        e.amount = 0;
        e.jokertimer = 0;
        const darkfader = spawn(state, marker, { x: state.view.x + 320, y: state.view.y - 10 });
        darkfader.sprite_index = 'spr_tallpx';
        darkfader.depth = 2;
        darkfader.image_alpha = 0;
        darkfader.image_blend = 'c_black';
        darkfader.image_xscale = 200;
        darkfader.image_yscale = 2;
        e.darkfader = darkfader;
      }
      if (e.realtimer >= 0 && e.realtimer < 10) {
        if (e.darkfader.alive) e.darkfader.image_alpha += 0.1;
        if (gt && gt.alive) gt.image_alpha -= 0.1;
        if (state.soul && state.soul.alive) {
          state.soul.y += 16;
          state.soul.boundaryup = 160;
        }
      }
      if (e.realtimer === 10) {
        if (gt && gt.alive) {
          // with (obj_battlesolid) instance_destroy() — the arena leaves.
          gt.alive = false;
        }
      }
      if (e.realtimer === 20) {
        spawn(state, laserscythe, { x: state.view.x + 40, y: -60 });
      }
      if (e.realtimer === 40) {
        spawn(state, laserscythe, { x: state.view.x + 570, y: -60 });
      }
      if (e.realtimer >= 60 && e.amount < 30) {
        if (e.btimer >= e.rank) {
          if (e.rank > 7) {
            e.rank -= 1;
          }
          let which = Math.floor(gmlRandom(r, 5));
          if (which === e.prevmake) {
            which = Math.floor(gmlRandom(r, 5));
          }
          if (e.chase === 3) {
            which = Math.floor((state.soul.x + 8) / 90);
            e.chase = 0;
          }
          spawn(state, laserscythe, { x: state.view.x + 40 + 90 * which, y: -60 });
          if (which === 1) {
            spawn(state, laserscythe, { x: state.view.x + 40 + 450, y: -60 });
          }
          if (which === 0) {
            spawn(state, laserscythe, { x: state.view.x + 40 + 540, y: -60 });
          }
          e.prevmake = which;
          e.btimer = 0;
          e.chase += 1;
          e.amount += 1;
        }
      }
      if (e.amount >= (29 - e.made) && e.special === 1) {
        e.jokertimer = 0;
        const jokerin = spawn(state, jokerTeleport, {
          x: state.view.x + 320,
          y: state.view.y + 100,
        });
        jokerin.gmlType = 66;
        jokerin.depth = -30;
        e.special = 2;
        e.which2 = 0;
      }
      if (e.special === 2) {
        e.jokertimer += 1;
        if (e.jokertimer === 10) {
          state.audio?.cue('snd_joker_neochaos');
        }
        if (e.jokertimer === 40 || e.jokertimer === 98) {
          spawn(state, laserscythe, { x: state.view.x + 40, y: -60 });
          spawn(state, laserscythe, { x: state.view.x + 580, y: -60 });
        }
        if (e.jokertimer === 46 || e.jokertimer === 86) {
          spawn(state, laserscythe, { x: state.view.x + 130, y: -60 });
          spawn(state, laserscythe, { x: state.view.x + 490, y: -60 });
        }
        if (e.jokertimer === 52 || e.jokertimer === 80) {
          spawn(state, laserscythe, { x: state.view.x + 220, y: -60 });
          spawn(state, laserscythe, { x: state.view.x + 400, y: -60 });
        }
        if (e.jokertimer === 66 || e.jokertimer === 98) {
          spawn(state, laserscythe, { x: state.view.x + 310, y: -60 });
        }
        if (e.jokertimer === 130) {
          const lastscythe = spawn(state, laserscythe, {
            x: state.view.x + 320,
            y: -320,
          });
          e.p = 0;
          e.vol = 0;
          e.vol2 = 1;
          state.audio?.cue('snd_rumble');
          lastscythe.vspeed = 1;
          lastscythe.gravity = 0.02;
          lastscythe.image_xscale = 16;
          lastscythe.image_yscale = 16;
          lastscythe.scale = 16;
          lastscythe.rotspeed = 0;
          lastscythe.remrot = 160;
          lastscythe.image_angle = 160;
          e.lastscythe = lastscythe;
          const fadewhite = spawn(state, marker, {
            x: state.view.x + 320,
            y: state.view.y - 40,
          });
          fadewhite.sprite_index = 'spr_tallpx';
          fadewhite.image_xscale = 400;
          fadewhite.image_yscale = 2;
          fadewhite.depth = -100;
          fadewhite.image_alpha = -0.3;
          e.fadewhite = fadewhite;
        }
        if (e.jokertimer >= 131) {
          if (e.lastscythe.alive) {
            e.lastscythe.x = e.lastscythe.xstart + gmlRandom(r, 8);
          }
          if (e.fadewhite.alive) {
            e.fadewhite.image_alpha += 0.01;
          }
          e.vol += 0.01;
          // GML epsilon >=: 0.01-steps on an f32 reach 0.99999x one frame
          // before a plain JS >= would fire (a77 f581, the soul recentre).
          if (gmlGreaterEq(e.fadewhite.image_alpha, 1)) {
            if (e.darkfader.alive) e.darkfader.alive = false;
            if (e.lastscythe.alive) e.lastscythe.alive = false;
          }
          if (gmlGreaterEq(e.fadewhite.image_alpha, 1.3)) {
            e.special = 3;
          }
        }
      }
      if (e.special === 3) {
        if (state.soul && state.soul.alive) {
          state.soul.x = state.view.x + 320;
          state.soul.y = state.view.y + 120;
        }
        e.vol -= 0.1;
        if (e.fadewhite.alive) {
          e.fadewhite.image_alpha -= 0.1;
        }
        if (gmlLessEq(e.fadewhite.image_alpha, 0)) {
          state.turntimer = 11;
          e.special = 4;
        }
      }
      e.realtimer += 1;
      return;
    }

    throw new Error(`obj_dbulletcontroller type ${e.gmlType} not translated yet`);
  },
};
