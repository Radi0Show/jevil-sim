// The whole-fight scene — mirror of oracle_fullfight_ch1.csx.
//
// t0 = the frame obj_battlecontroller is created in the real game
// (random_set_seed there, trace row 0 there). The scenario is the
// recorder's: fresh-file stats, full party [Kris, Susie, Ralsei], no
// items, everyone manual, tension 0. The menu is REAL (sim/menu.js); the
// scene starts at mnfight 0 with the button row live, exactly as bc's
// Create leaves the globals.
//
// Input comes as per-frame masks (the recorder's oracle_inputs.txt
// format): bit 1 left, 2 right, 4 up, 8 down, 16 confirm, 32 cancel.
// The soul's focus-slow is button2_h — the CANCEL bit, chapter 1's
// actual mapping (obj_heart Step line 44).

import { spawn } from '../../sim/entity.js';
import { gmlCreate, gmlRandom } from '../../sim/rng.js';
import { battlecontroller, jokerFight } from '../../sim/fight.js';
import { HEROES } from '../../sim/heroes.js';
import { createJoker } from '../../sim/joker.js';
import { freshParty } from '../../sim/damage.js';
import { real, int } from '../../sim/trace.js';

export function maskToInput(m) {
  return {
    left: !!(m & 1),
    right: !!(m & 2),
    up: !!(m & 4),
    down: !!(m & 8),
    confirm: !!(m & 16),
    cancel: !!(m & 32),
    focus: !!(m & 32),
  };
}

export function buildFullFightScene(state, { seed = 4242, txtDraws = null, mode = 'defend', at = 30 } = {}) {
  state.phase = 'fullfight';
  state.view = { x: 0, y: 0 };
  state.roomHeight = 480;
  state.turntimer = 0; // recorder-initialized; first armed by the turn
  state.invTimer = 0;
  state.invc = 1;
  state.reminvc = 1;
  state.tension = 0;
  state.maxtension = 250;
  state.damageEnabled = true;
  state.grazeEnabled = false; // armed per enemy turn with the heart
  state.party = freshParty();
  state.gmlRng = gmlCreate(seed);
  // THE TEXT-JITTER SIDE-CHANNEL. The battle writers call random(shake)
  // twice per drawn character per frame with shake == 0 — visually inert,
  // but random(0) CONSUMES WELL512 state in this runner (measured: the
  // first volley matches only at stream offset 5,618). The per-frame
  // counts are recorded by the oracle (txt column) and REPLAYED here —
  // knight's shuffle precedent: the real draws still ran in the
  // recording, so the stream is the real game's; what is taken as given
  // is only the writers' reveal pacing. A native reveal-engine
  // translation can replace this later without touching anything else.
  state.txtDraws = txtDraws;
  // seed-frame boundary: draws between random_set_seed and trace row 0
  // (the seed lands mid-draw-phase) — fitted constant, see verify notes.
  for (let k = 0; k < (globalThis.BOOT_TAIL ?? 0); k++) gmlRandom(state.gmlRng, 0);
  state.joker = createJoker();

  if (mode === 'fight') {
    // FIGHT scenario: boosted AT (battleat = at + no items) and the
    // immortal-party pin — the recorder's mode=1.
    state.party.battleat = [at, at, at];
    state.immortalParty = true;
  } else {
    state.party.battleat = [10, 10, 10]; // fresh at, unused by defend
  }
  state.monsters = [1, 0, 0];

  spawn(state, battlecontroller);
  // heroes carry the FIGHT swing (creation order puts them ahead of the
  // attackpress in the drawStep walk — the runner's depth order).
  for (const h of HEROES) spawn(state, h, { x: 80 + 10 * h.objIndex, y: 100 });
  spawn(state, jokerFight, { x: 500, y: 160 });
  state.fightMode = mode;

  const barCols = mode === 'fight';
  state.traceCustom = {
    header: ['frame', 'soul_x', 'soul_y', 'hp1', 'hp2', 'hp3', 'inv', 'tension', 'tt',
      'jturn', 'jattack', 'myfight', 'mnfight', 'bmenuno', 'charturn',
      'ca0', 'ca1', 'ca2', 'jhp', 'nbul', 'gameover', 'mt', 'txt',
      ...(barCols ? ['bf0', 'bc0', 'bf1', 'bc1', 'bf2', 'bc2', 'p0', 'p1', 'p2'] : []),
      'b0x', 'b0y', 'b1x', 'b1y', 'b2x', 'b2y', 'b3x', 'b3y', 'b4x', 'b4y', 'b5x', 'b5y'],
    row: (s) => {
      const p = s.party;
      const j = s.joker;
      const nbul = s.entities.filter((e) => e.alive && e.isBullet).length;
      // the recorder writes EMPTY soul cells when obj_heart is absent
      // (menu phase) — `frame,,,hp1...`, not zeros.
      const soulAlive = s.soul && s.soul.alive;
      return [
        int(s.frame),
        soulAlive ? real(s.soul.x) : '',
        soulAlive ? real(s.soul.y) : '',
        int(p.hp[1]), int(p.hp[2]), int(p.hp[3]),
        int(s.invTimer),
        real(s.tension),
        real(s.turntimer),
        // scr_monsterdefeat destroys obj_joker — the recorder echoes -1.
        int(s.jokerDefeated ? -1 : j.jturn), int(s.jokerDefeated ? -1 : j.jattack),
        int(s.myfight), int(s.mnfight), int(s.bmenuno), int(s.charturn),
        int(p.charaction[0]), int(p.charaction[1]), int(p.charaction[2]),
        int(j.hp),
        int(nbul),
        int(s.gameOver ? 1 : 0),
        int(s.lastMytarget ?? -1),
        int(s.txtDraws?.get(s.frame) ?? 0),
        ...(barCols ? (() => {
          const bd = s.lastBoltData;
          const cells = [];
          for (let k = 0; k < 3; k++) {
            if (bd && bd.boltframe[k] !== undefined) cells.push(int(bd.boltframe[k]), int(bd.boltchar[k]));
            else cells.push(int(-1), int(-1));
          }
          for (let k = 0; k < 3; k++) {
            const hero = s.entities.find((h) => h.alive && h.slot === k && h.type.alarm?.[1]);
            cells.push(int(hero && hero.points !== undefined ? hero.points : -1));
          }
          return cells;
        })() : []),
        // six bullet slots in `with` order (newest first), blank when
        // absent — the recorder's iteration order.
        ...(() => {
          // the recorder's with(obj_collidebullet) walk: object-index
          // buckets ascending, newest-first within each (measured: the
          // type-74 mix lists the regularbullet spades before the newer
          // vert diamonds; same-type volleys list newest first).
          const bs = s.entities.filter((e) => e.alive && e.isBullet)
            .sort((a, z) => (a.type.objIndex ?? 999) - (z.type.objIndex ?? 999) || z.seq - a.seq)
            .slice(0, 6);
          const cells = [];
          for (let k = 0; k < 6; k++) {
            if (bs[k]) cells.push(real(bs[k].x), real(bs[k].y));
            else cells.push('', '');
          }
          return cells;
        })(),
      ];
    },
  };
  return state;
}
