// Mirror of jevil-research tools/patches/oracle_attack.csx with type=70:
// box settled at (320,170), heart at (314,162), then the launch exactly as
// obj_joker's Other_15 does it (dc created, fields assigned, joker = 1).
//
// Alignment facts, read off the recording (traces/a70-fan.csv):
//   - one heart-only frame runs before recording starts -> invTimer -1 at
//     build, no dc yet... EXCEPT the dc is created in that same pre-frame's
//     Draw, so on row 0 the dc HAS stepped once (btimer 99 -> 100, first
//     teleport spawned, visible with image_xscale 0). Mirrored here by
//     spawning the dc at build: its first step IS frame 0.
//   - turntimer: row N shows 240 - N; the decrement lands at the START of
//     the next frame (bc-lite below), matching the oracle's post-row
//     decrement in obj_time's Draw.
//   - damage sterilized on both sides: state.damageEnabled = false
//     (hit counter + destroy-on-hit only); graze disabled (no grazebox
//     entity exists here at all).

import { spawn } from '../../sim/entity.js';
import { gmlCreate } from '../../sim/rng.js';
import { soul } from '../../sim/soul.js';
import { battlebox, settleBox } from '../../sim/battlebox.js';
import { dbulletController } from '../../sim/attacks/dbullet-controller.js';
import { real, int } from '../../sim/trace.js';

// The battlecontroller's one in-window effect, replicated (its gate
// `mnfight == 2 && timeron == 1` holds throughout a real attack window).
const bcLite = {
  name: 'bc_lite',
  objIndex: 196, // stands in for obj_battlecontroller (dump object order)
  beginStep(e, state) {
    if (state.frame > 0) state.turntimer -= 1;
  },
};

export function buildAttackScene(state, { type = 70, vel = false, turntimer = 240 } = {}) {
  state.roomHeight = 480; // the oracle resizes room_battletest to the fight room's size
  state.hp = 90;
  state.invTimer = -1;
  state.phase = String(type);
  state.view = { x: 0, y: 0 };
  state.turntimer = turntimer;
  state.damageEnabled = false;
  state.gmlRng = gmlCreate(4242);
  state.traceBulletVel = vel; // widened recorder prints b_hs/b_vs per slot

  spawn(state, bcLite);
  const gt = spawn(state, battlebox, { x: 320, y: 170 });
  settleBox(gt);
  state.soul = spawn(state, soul, { x: 314, y: 162 });

  const dc = spawn(state, dbulletController, { x: 500, y: 160 });
  dc.gmlType = type; // GML `type` (dc.type is the handler ref)
  dc.target = 0;
  dc.damage = 50;
  dc.grazepoints = 2;
  dc.inv = 60;
  dc.joker = 1;

  state.traceExtraHeader = [
    't0_x', 't0_y', 't0_con', 't0_timer', 't0_xs',
    't1_x', 't1_y', 't1_con', 't1_timer', 't1_xs',
    'tt', 'nbul', 'hits',
  ];
  state.traceExtra = (s) => {
    // Mirror the recorder exactly: its `with (obj_joker_teleport)` iterates
    // NEWEST FIRST and keeps the first two found, THEN sorts that pair by
    // id ascending. With 3+ clones alive (type 71's 9-frame cadence) that
    // is the two newest — not the two oldest.
    const tps = s.entities
      .filter((e) => e.alive && e.type.name === 'obj_joker_teleport')
      .sort((a, b) => b.seq - a.seq)
      .slice(0, 2)
      .sort((a, b) => a.seq - b.seq);
    const cells = [];
    for (let i = 0; i < 2; i++) {
      const t = tps[i];
      if (!t) {
        cells.push('', '', '', '', '');
      } else {
        cells.push(real(t.x), real(t.y), int(t.con), int(t.timer), real(t.image_xscale));
      }
    }
    const nbul = s.entities.filter((e) => e.alive && e.isBullet).length;
    cells.push(int(s.turntimer), int(nbul), int(s.counters.collisionHits));
    return cells;
  };

  return state;
}

export const ORACLE_A70_INPUT = [{ from: 0 }];


// Named builders for the scene registry.
export function buildOracleA70Scene(state) {
  return buildAttackScene(state, { type: 70, vel: false });
}
export function buildOracleA65Scene(state) {
  return buildAttackScene(state, { type: 65, vel: true });
}
export function buildOracleA68Scene(state) {
  return buildAttackScene(state, { type: 68, vel: true });
}
export function buildOracleA71Scene(state) {
  return buildAttackScene(state, { type: 71, vel: true });
}
export function buildOracleA49Scene(state) {
  return buildAttackScene(state, { type: 49, vel: true });
}
export function buildOracleA50Scene(state) {
  return buildAttackScene(state, { type: 50, vel: true, turntimer: 300 });
}
export function buildOracleA48Scene(state) {
  return buildAttackScene(state, { type: 48, vel: true, turntimer: 270 });
}
export function buildOracleA46Scene(state) {
  return buildAttackScene(state, { type: 46, vel: true, turntimer: 330 });
}
export function buildOracleA62Scene(state) {
  return buildAttackScene(state, { type: 62, vel: true });
}
export function buildOracleA61Scene(state) {
  return buildAttackScene(state, { type: 61, vel: true, turntimer: 240 });
}
export function buildOracleA75Scene(state) {
  return buildAttackScene(state, { type: 75, vel: true });
}
export function buildOracleA76Scene(state) {
  return buildAttackScene(state, { type: 76, vel: true });
}
export function buildOracleA72Scene(state) {
  return buildAttackScene(state, { type: 72, vel: true });
}
export function buildOracleA73Scene(state) {
  return buildAttackScene(state, { type: 73, vel: true });
}
export function buildOracleA74Scene(state) {
  return buildAttackScene(state, { type: 74, vel: true });
}
export function buildOracleA77Scene(state) {
  return buildAttackScene(state, { type: 77, vel: true, turntimer: 1500 });
}
