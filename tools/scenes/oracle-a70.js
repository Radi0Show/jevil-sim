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
  beginStep(e, state) {
    if (state.frame > 0) state.turntimer -= 1;
  },
};

export function buildOracleA70Scene(state, { type = 70 } = {}) {
  state.hp = 90;
  state.invTimer = -1;
  state.phase = String(type);
  state.view = { x: 0, y: 0 };
  state.turntimer = 240;
  state.damageEnabled = false;
  state.gmlRng = gmlCreate(4242);

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
    const tps = s.entities
      .filter((e) => e.alive && e.type.name === 'obj_joker_teleport')
      .sort((a, b) => a.seq - b.seq)
      .slice(0, 2);
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
