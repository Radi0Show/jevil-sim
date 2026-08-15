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
import { HEROES } from './heroes.js';
import { createJoker, selectTurn, selectGates, DISPATCH } from './joker.js';
import { endTurnAutoheal } from './damage.js';
import { menuStep, menuBuffers, mnendturnMenu, scrAttackphase } from './menu.js';
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
  // obj_joker Draw, state-3 hurt entry (Draw_0:1-56): one reaction per
  // hurt push — body flail (visual), mhpratio gates, the laughnoise
  // choose (PRESENTATION CHANNEL — counted by the recorder's oracle_rc3,
  // so the sim must NOT draw it), and the defeat check at hp <= 0.
  drawStep(e, state) {
    if ((e.hurttimer ?? 0) > 0) {
      e.hurttimer = 0;
      const j = state.joker;
      const mhpratio = j.hp / j.maxhp;
      // laughnoise = choose(0,1,2) rides the PRESENTATION channel — the
      // pick here is frame-derived, NOT a stream draw (LABELLED: the
      // original chooses uniformly on the counted channel).
      state.audio?.cue(['snd_joker_laugh0', 'snd_joker_ha1', 'snd_joker_ha0'][state.frame % 3]);
      const prevDance = j.dancelv ?? 0;
      if (mhpratio <= 0.8 && (j.dancelv ?? 0) === 0) j.dancelv = 1;
      if (mhpratio <= 0.4 && j.jturn < 17) j.dancelv = 3;
      if (mhpratio <= 0.2 && j.jturn === 17) j.dancelv = 2;
      if ((j.dancelv ?? 0) !== prevDance) {
        // obj_joker_body Draw_0:175 — the spin-change sting.
        state.audio?.cue('snd_joker_metamorphosis');
      }
      if (mhpratio <= 0) {
        // event_user(10) + flag[241] = 6 — the violence ending; the
        // whole-fight claim window ends here.
        state.jokerDefeated = true;
      }
    }
    if (e.hurttimer !== undefined) {
      e.hurttimer -= 1;
      if (e.hurttimer < 0) e.hurttimer = 0;
    }
  },

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
      // the hold-release gates run BEFORE the message draws (Step_0
      // order: gates 11-90, messages 95-199, selection 213+).
      selectGates(j);
      const jt = j.jturn;
      state.enemyLine = { jturn: jt, rr: -1 };
      // per-turn message voice lines (Step_0:95-200): chaos at 0, ANYTHING
      // at 7; the hold-message rr plays chaos (0) or ANYTHING (1) below.
      if (jt === 0) state.audio?.cue('snd_joker_chaos');
      if (jt === 7) state.audio?.cue('snd_joker_anything');
      if (jt === 4 || jt === 9 || jt === 14 || jt === 19) {
        const rr = gmlChoose(state.gmlRng, [0, 1, 2, 3]);
        state.enemyLine.rr = rr;
        if (rr === 0) {
          state.enemyLine.alt = gmlChoose(state.gmlRng, [0, 1]);
          state.audio?.cue('snd_joker_chaos'); // Step_0:184
        }
        if (rr === 1) state.audio?.cue('snd_joker_anything'); // Step_0:189
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
        state.lastMytarget = t;
        e.mytarget = t;
      }

      if (!state.entities.some((o) => o.alive && o.type.name === 'obj_darkener')) {
        spawn(state, darkener, { x: 0, y: 0 });
      }
      e.talked = 1;
      e.talktimer = 0;
    }

    // scr_blconskip(15): the talk bubble runs to talkmax, skippable past
    // frame 15 on the CONFIRM EDGE (button1_p, not the held level).
    if (e.talked === 1 && state.mnfight === 1) {
      e.rtimer = 0;
      if (state.menuEdges?.confirm && e.talktimer > 15) {
        e.talktimer = e.talkmax;
      }
      e.talktimer += 1;
      if (e.talktimer >= e.talkmax) {
        state.mnfight = 2;
      }
      if (state.mnfight === 2) {
        // scr_moveheart: the heart FLIES IN from Kris's chest — an
        // 8-frame obj_moveheart transit to (view+310, view+160), the
        // heart born there by its alarm. The soul therefore does not
        // exist (no inv countdown, no graze pair) for the first ~9
        // frames of the bullet phase — the fullfight diff caught the
        // probe stages' instant (314,162) spawn both late and 4px off.
        if (!state.entities.some((o) => o.alive && o.type.name === 'obj_moveheart')
            && (!state.soul || !state.soul.alive)) {
          spawn(state, moveheart, { x: 80 + 10, y: 100 + 40 });
        }
        if (!state.entities.some((o) => o.alive && o.type.name === 'obj_growtangle')) {
          spawn(state, battlebox, { x: state.view.x + 320, y: state.view.y + 170 });
        }
      }
    }

    // ---- myfight 3: the ACT resolution machine (Step_0:227-616) ----
    // VERIFIED SCOPE: Check (acting 1) and Hypnosis (acting 3) — the
    // pacifist route. Pirouette's chaos-dance wheel (acting 2) is
    // translated for its draw pattern but its heal slots spawn
    // obj_healanim star sprays (step-phase RNG) that stay UNMODELED —
    // the pacify script never pirouettes; the differ flags any drift.
    if (state.myfight === 3) {
      if (e.acting === 1 && e.actcon === undefined) e.actcon = 0;
      if (e.acting === 1 && e.actcon === 0) {
        e.actcon = 1; // Check: message only
      }
      if (e.acting === 3 && (e.actcon ?? 0) === 0) {
        const j = state.joker;
        if (j.at > 10) j.at -= 0.5;
        state.audio?.cue('snd_hypnosis'); // Step_0:574
        // obj_hypnofx: its Draw's initsiner random(400) rides the
        // presentation channel (wrapped in the recorder).
        gmlChoose(state.gmlRng, [0, 1, 2]); // aaa — the hypnosis line pick
        // the >= 9 check reads the PRE-increment counter (Step_0:595-599
        // runs before the += 1): TIRED via this path needs a TENTH cast.
        if (j.hypnosiscounter >= 9) j.monsterstatus = 1;
        j.pfactor = 0.7;
        j.hypnosis = 1;
        j.hypnosiscounter += 1;
        e.actcon = 1;
      }
      if ((e.actcon ?? 0) === 1 && !(state.writerBusy?.(state.frame))) {
        e.actcon = 0;
        e.acting = 0;
        scrAttackphase(state);
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
        state.audio?.cue('snd_joker_anything'); // Other_15:57/95
        const dc = spawn(state, dbulletController, { x: e.x, y: e.y });
        dc.gmlType = d.type;
        dc.target = e.mytarget ?? 0;
        dc.damage = j.at * j.pfactor * d.damageMul;
        dc.grazepoints = d.graze ?? 1;
        dc.joker = 1;
        if (d.turntimer) state.turntimer = d.turntimer;
        // the dispatch flavor line: rr = choose(0,1,2,3,4) AFTER
        // event_user(5) — one draw per enemy turn (Step_0:281); no nested
        // draws in any branch (lines 283-322 are fixed lang strings).
        // The pick is ANNOTATED for the renderer's battle message.
        state.enemyFlavor = {
          frame: state.frame,
          rr: gmlChoose(state.gmlRng, [0, 1, 2, 3, 4]),
          jturn: j.jturn,
          dancelv: j.dancelv ?? 0,
          tired: j.monsterstatus === 1,
        };
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

/**
 * obj_moveheart — the heart's flight from Kris to the box. flytime 8,
 * move_towards_point(dist/8); the alarm snaps to the destination, creates
 * obj_heart there, and dies. No heartmarker on this stage, so the
 * destination is the default (view+310, view+160).
 */
export const moveheart = {
  name: 'obj_moveheart',
  objIndex: 219,
  builtinMotion: true,
  create(e, state) {
    e.flytime = 8;
    e.distx = state.view.x + 310;
    e.disty = state.view.y + 160;
    const dist = Math.hypot(e.distx - e.x, e.disty - e.y);
    e.speed = dist / e.flytime;
    let dir = (Math.atan2(-(e.disty - e.y), e.distx - e.x) * 180) / Math.PI;
    if (dir < 0) dir += 360;
    e.direction = dir;
    e.alarm[0] = e.flytime;
  },
  alarm: {
    0: (e, state) => {
      e.x = e.distx;
      e.y = e.disty;
      state.soul = spawn(state, soul, { x: e.distx, y: e.disty });
      state.grazeEnabled = true;
      destroy(e);
    },
  },
};

/** obj_battlecontroller, dodge scope: timer, teardown, turn reset. */
export const battlecontroller = {
  name: 'obj_battlecontroller',
  objIndex: 196,

  create(e, state) {
    e.timeron = 1;
    e.reset = 0;
    // menu input buffers (obj_battlecontroller Create lines 11-14).
    e.lbuffer = 0;
    e.rbuffer = 0;
    e.onebuffer = 0;
    e.twobuffer = 0;
    // the menu globals bc's Create resets (myfight/mnfight/charturn/cursors).
    state.myfight = 0;
    state.mnfight = 0;
    state.bmenuno = 0;
    state.charturn = 0;
    state.bmenucoord0 = [0, 0, 0];
    state.acting = [0, 0, 0];
    state.temptension = [0, 0, 0];
  },

  step(e, state) {
    // The button row sits ABOVE the turn timer in the original Step.
    menuStep(e, state);
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
    // Step-bottom buffer decrements (lines 849-852).
    menuBuffers(e);
  },

  alarm: {
    2: (e, state) => {
      // scr_mnendturn: cursor/phase resets and the REAL menu (sim/menu.js),
      // down autoheal with its writer draws, monster flags cleared.
      e.reset = 0;
      endTurnAutoheal(state);
      mnendturnMenu(state);
      const joker = state.entities.find((o) => o.alive && o.type.name === 'obj_joker');
      if (joker) {
        joker.attacked = 0;
        joker.talked = 0;
        joker.acting = 0;
      }
    },
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
  // heroes ahead of the attackpress in the drawStep walk (runner depth
  // order) — same creation order the verified fullfight scene uses.
  for (const h of HEROES) spawn(state, h, { x: 80, y: 100 });
  spawn(state, jokerFight, { x: 500, y: 160 });
  return state;
}
