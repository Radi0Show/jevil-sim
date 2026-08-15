// Live damage + graze scenes — mirrors of oracle_live_probe.csx: the same
// stage as the attack scenes but with the REAL chapter 1 damage and graze
// paths running (nothing sterilized). The trace matches the probe's header:
//   frame,soul_x,soul_y,hp1,hp2,hp3,inv,tension,tt,nbul,gameover

import { spawn } from '../../sim/entity.js';
import { gmlCreate } from '../../sim/rng.js';
import { soul } from '../../sim/soul.js';
import { battlebox, settleBox } from '../../sim/battlebox.js';
import { dbulletController } from '../../sim/attacks/dbullet-controller.js';
import { real, int } from '../../sim/trace.js';

const bcLite = {
  name: 'bc_lite',
  objIndex: 196,
  beginStep(e, state) {
    if (state.frame > 0) state.turntimer -= 1;
  },
};

export function buildLiveScene(state, { type = 70, grazepoints = 2 } = {}) {
  // One heart-only frame runs before recording starts (the probe's state
  // 1.5), same as the attack scenes: row 0 shows inv -2.
  state.invTimer = -1;
  state.phase = 'live';
  state.view = { x: 0, y: 0 };
  state.roomHeight = 480;
  state.turntimer = 240;
  state.damageEnabled = true;
  state.grazeEnabled = true;
  state.gmlRng = gmlCreate(4242);

  // The probe stage never runs obj_battlecontroller, so the party is the
  // FRESH-FILE state (scr_gamestart): Kris alone — char [1,0,0] — and
  // charcantarget all 0 (only scr_revive ever sets one). That makes the
  // wipe a one-down affair (the f124 gameover with Susie/Ralsei untouched)
  // and sends the redirect straight to target 3 (the latent
  // charinstance[3] crash the probe absorbs with a fourth marker).
  state.party.char = [1, 0, 0];
  state.party.charcantarget = [0, 0, 0];

  spawn(state, bcLite);
  const gt = spawn(state, battlebox, { x: 320, y: 170 });
  settleBox(gt);
  state.soul = spawn(state, soul, { x: 314, y: 162 });

  const dc = spawn(state, dbulletController, { x: 500, y: 160 });
  dc.gmlType = type;
  dc.target = 0;
  dc.damage = 50;
  dc.grazepoints = grazepoints;
  dc.joker = 1;

  state.traceCustom = {
    header: ['frame', 'soul_x', 'soul_y', 'hp1', 'hp2', 'hp3', 'inv', 'tension', 'tt', 'nbul', 'gameover'],
    row: (s) => {
      const p = s.party;
      const nbul = s.entities.filter((e) => e.alive && e.isBullet).length;
      return [
        int(s.frame),
        real(s.soul && s.soul.alive ? s.soul.x : 0),
        real(s.soul && s.soul.alive ? s.soul.y : 0),
        int(p.hp[1]), int(p.hp[2]), int(p.hp[3]),
        int(s.invTimer),
        real(s.tension),
        real(s.turntimer),
        int(nbul),
        int(s.gameOver ? 1 : 0),
      ];
    },
  };
  return state;
}

export function buildLive70Scene(state) {
  return buildLiveScene(state, { type: 70, grazepoints: 2 });
}
export function buildLive65Scene(state) {
  return buildLiveScene(state, { type: 65, grazepoints: 3 });
}
export const LIVE_INPUT = [{ from: 0 }];
