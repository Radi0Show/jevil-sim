// The fight-mode turn lifecycle: obj_battlecontroller's enemy-turn
// machinery, obj_darkener, obj_returnheart, and the obj_joker fight entity
// driving sim/joker.js's selector. Dodge-only: the party's menu phase is
// replaced by a fixed, LABELED pause (state.menuPause frames) — the real
// game waits for player input there; everything else runs on dump timing.
//
// The cycle (sources cited per piece):
//   mnfight 1 (enemy talk): obj_joker Step picks the message (RNG on hold
//     turns!) and the attack; obj_darkener created; talk bubble runs
//     talkmax = 90 frames, confirm-skippable once talktimer > 15
//     (scr_blconskip(15)); at talkmax -> mnfight 2.
//   mnfight 2: joker creates obj_growtangle (regrows) + the heart returns
//     via scr_moveheart; rtimer counts, at 12: turntimer = 240 (dispatch
//     overrides after), event_user(5) launch, attacked = 1.
//   turntimer hits 0 (bc Step): destroy every bulletparent +
//     bulletgenparent descendant, darkener.darken = 0 (the box shrinks via
//     growcon 3 in the darkener's Draw), heart -> obj_returnheart (an
//     8-frame flight to Kris), reset = 1, alarm[2] = 15.
//   alarm 2 (15 frames later): reset = 0, scr_mnendturn — flags cleared,
//     DOWN AUTOHEAL ceil(maxhp/8), monsterparent attacked/talked reset.
//   [menu pause] -> mnfight 1 again.
//
// Endings: violence — HP <= 0 checked in obj_joker's Draw hurt block (ends
// on the killing hit); pacify — TIRED + Pacify. The fight page's debug
// damage key drives HP through the REAL path (knight precedent).

import { spawn, destroy } from './entity.js';
import { soul } from './soul.js';
import { battlebox } from './battlebox.js';
import { dbulletController } from './attacks/dbullet-controller.js';
import { createJoker, selectTurn, DISPATCH } from './joker.js';
import { endTurnAutoheal } from './damage.js';
import { gmlChoose } from './rng.js';

export const darkener = {
  name: 'obj_darkener',
  objIndex: 205, // dump object order

  create(e) {
    e.darken = 1;
    e.darkamt = 0;
  },

  // The box-shrink coupling lives in the DRAW event; endStep mirrors it.
  endStep(e, state) {
    if (e.darken === 1) {
      if (e.darkamt < 15) e.darkamt += 1;
    }
    if (e.darken === 0) {
      for (const gt of state.entities) {
        if (gt.alive && gt.type.name === 'obj_growtangle') {
          gt.growcon = 3;
        }
      }
      if (e.darkamt > 0) e.darkamt -= 1;
      if (e.darkamt === 0) destroy(e);
    }
  },
};

export const returnheart = {
  name: 'obj_returnheart',
  objIndex: 220, // near obj_moveheart in the dump order

  create(e, state) {
    // Flies to Kris over 8 frames. No Kris on the dodge stage — the target
    // is the party's standing spot (left of the box), same visual effect.
    e.flytime = 8;
    e.distx = 80 + 10;
    e.disty = 220 + 40;
    const dist = Math.hypot(e.distx - e.x, e.disty - e.y);
    e.componentMotion = true;
    let dir = Math.atan2(-(e.disty - e.y), e.distx - e.x);
    e.hspeed = (dist / e.flytime) * Math.cos(dir);
    e.vspeed = -(dist / e.flytime) * Math.sin(dir);
    e.alarm[0] = e.flytime;
    e.sprite_index = 'spr_dodgeheart';
  },

  alarm: {
    0: (e) => {
      destroy(e);
    },
  },
};

/** obj_joker, fight edition: the per-turn state machine around selectTurn. */
export const jokerFight = {
  name: 'obj_joker',
  objIndex: 292, // dump object order

  create(e, state) {
    e.j = state.joker; // shared stats object (created by the scene)
    e.talked = 0;
    e.attacked = 0;
    e.rtimer = 0;
    e.talktimer = 0;
    e.talkmax = 90;
    e.pendingLaunch = null;
    e.x = 500;
    e.y = 160;
  },

  step(e, state) {
    const j = e.j;

    // ---- mnfight 1: enemy talk + selection ----
    if (state.mnfight === 1 && e.talked === 0) {
      // Per-turn invc restore (Step_0:4-9; pirouette exception out of scope).
      state.invc = state.reminvc ?? 1;

      // Message selection consumes RNG on the hold turns BEFORE the attack
      // choose (stream order matters): rr = choose(0,1,2,3), and rr 0/2
      // draw one more choose between two lines.
      const jt = j.jturn;
      state.enemyLine = { jturn: jt, rr: -1 };
      if (jt === 4 || jt === 9 || jt === 14 || jt >= 19) {
        const rr = gmlChoose(state.gmlRng, [0, 1, 2, 3]);
        state.enemyLine.rr = rr;
        if (rr === 0) {
          state.enemyLine.alt = gmlChoose(state.gmlRng, [0, 1]);
        }
        if (rr === 2) {
          state.enemyLine.alt = gmlChoose(state.gmlRng, [0, 1]);
        }
      }

      selectTurn(j, state.gmlRng);

      // Targeting (Step_0:247-254): 2/5/9/13/15 hit everyone, the rest a
      // random target (consumes RNG).
      if ([2, 5, 9, 13, 15].includes(j.jattack)) {
        e.mytarget = 3;
      } else {
        // scr_randomtarget on a healthy party: one draw (rerolls only on
        // untargetable slots).
        let t = gmlChoose(state.gmlRng, [0, 1, 2]);
        const p = state.party;
        const able = !(p.charcantarget[0] === 0 && p.charcantarget[1] === 0 && p.charcantarget[2] === 0);
        if (able) {
          while (p.charcantarget[t] === 0) t = gmlChoose(state.gmlRng, [0, 1, 2]);
        } else {
          t = 3;
        }
        e.mytarget = t;
      }

      if (!state.entities.some((o) => o.alive && o.type.name === 'obj_darkener')) {
        spawn(state, darkener, { x: 0, y: 0 });
      }
      e.talked = 1;
      e.talktimer = 0;
    }

    // scr_blconskip(15): the talk bubble runs to talkmax, confirm-skippable.
    if (e.talked === 1 && state.mnfight === 1) {
      e.rtimer = 0;
      if (state.input?.confirm && e.talktimer > 15) {
        e.talktimer = e.talkmax;
      }
      e.talktimer += 1;
      if (e.talktimer >= e.talkmax) {
        state.mnfight = 2;
      }
      if (state.mnfight === 2) {
        if (!state.entities.some((o) => o.alive && o.type.name === 'obj_growtangle')) {
          spawn(state, battlebox, { x: state.view.x + 320, y: state.view.y + 170 });
        }
        if (!state.soul || !state.soul.alive) {
          // scr_moveheart: the heart re-enters for the bullet phase.
          state.soul = spawn(state, soul, { x: 314, y: 162 });
          state.grazeEnabled = true;
        }
      }
    }

    // ---- mnfight 2: rtimer -> dispatch (Step_0:272-328) ----
    if (state.mnfight === 2 && e.attacked === 0) {
      e.rtimer += 1;
      if (e.rtimer === 12) {
        state.turntimer = 240;
        // event_user(5) — Other_15's launch, with pfactor applied to AT for
        // the launch only.
        const d = DISPATCH[j.jattack];
        const dc = spawn(state, dbulletController, { x: e.x, y: e.y });
        dc.gmlType = d.type;
        dc.target = e.mytarget ?? 0;
        dc.damage = j.at * j.pfactor * d.damageMul;
        dc.grazepoints = d.graze ?? 1;
        dc.joker = 1;
        if (d.turntimer) state.turntimer = d.turntimer;
        j.pfactor = 1;
        j.turns += 1;
        j.chaosdance += 1;
        if (j.chaosdance >= 9) j.chaosdance = 0;
        e.attacked = 1;
      } else if (e.rtimer < 12) {
        state.turntimer = 120;
      }
    }
  },
};

/** obj_battlecontroller, dodge scope: timer, teardown, turn reset. */
export const battlecontroller = {
  name: 'obj_battlecontroller',
  objIndex: 196,

  create(e) {
    e.timeron = 1;
    e.reset = 0;
    e.menuPauseLeft = 0;
  },

  step(e, state) {
    if (state.mnfight === 2 && e.timeron === 1) {
      state.turntimer -= 1;
      if (state.turntimer <= 0 && e.reset === 0) {
        for (const o of state.entities) {
          if (!o.alive) continue;
          const n = o.type.name;
          // bulletparent + bulletgenparent descendants.
          if (o.isBullet || n === 'obj_joker_teleport' || n === 'obj_spadering' ||
              n === 'obj_suitbomb' || n === 'obj_heartbomb_blast' ||
              n === 'obj_clubsbullet_dark' || n === 'obj_dbulletcontroller') {
            o.alive = false;
          }
          if (n === 'obj_darkener') o.darken = 0;
        }
        if (state.soul && state.soul.alive) {
          spawn(state, returnheart, { x: state.soul.x, y: state.soul.y });
          destroy(state.soul);
          state.grazeEnabled = false;
        }
        e.reset = 1;
        e.alarm[2] = 15;
      }
    }
  },

  alarm: {
    2: (e, state) => {
      // scr_mnendturn, dodge scope: flags reset, down autoheal, then the
      // LABELED menu pause standing in for the party phase.
      e.reset = 0;
      endTurnAutoheal(state);
      const p = state.party;
      for (let i = 0; i < 3; i += 1) {
        p.targeted[i] = 0;
        p.charaction[i] = 0;
        p.charspecial[i] = 0;
      }
      const joker = state.entities.find((o) => o.alive && o.type.name === 'obj_joker');
      if (joker) {
        joker.attacked = 0;
        joker.talked = 0;
      }
      state.mnfight = 0;
      e.menuPauseLeft = state.menuPause ?? 60;
    },
  },

  endStep(e, state) {
    if (state.mnfight === 0 && e.menuPauseLeft > 0) {
      e.menuPauseLeft -= 1;
      if (e.menuPauseLeft === 0) {
        state.mnfight = 1;
      }
    }
  },
};

/** Build the full dodge-only fight. */
export function buildFightScene(state, { menuPause = 60 } = {}) {
  state.hp = 90;
  state.invTimer = 0;
  state.phase = 'fight';
  state.view = { x: 0, y: 0 };
  state.roomHeight = 480;
  state.turntimer = 999;
  state.damageEnabled = true;
  state.grazeEnabled = false;
  state.menuPause = menuPause;
  state.reminvc = 1;
  state.mnfight = 1; // straight into the first enemy turn
  state.joker = createJoker();

  spawn(state, battlecontroller);
  spawn(state, jokerFight, { x: 500, y: 160 });
  return state;
}
