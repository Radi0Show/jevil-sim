// obj_shake — the screen shake, translated as GAMEPLAY, not presentation.
//
//   Create : gml_Object_obj_shake_Create_0   (fields only)
//   Step   : gml_Object_obj_shake_Step_0     (active 0 -> latch camera,
//            view += (shakex, shakey), arm alarm[0] = shakespeed)
//   Alarm 0: gml_Object_obj_shake_Alarm_0    (view = camera + shake*sign,
//            decay toward 0, flip sign, re-arm; destroy at 0)
//   Destroy: gml_Object_obj_shake_Destroy_0  (restore the stored camera)
//
// WHY GAMEPLAY: FINAL CHAOS's rank scythes spawn at view_xview + 40 + 90k
// (obj_dbulletcontroller type 77), and the pillar hit that precedes a
// spawn leaves the view at +4 on the spawn frame — the oracle's scythe
// lands at x 404 where a fixed view spawns at 400 (fullfight-pacify
// f6164). obj_shake's index (147) precedes the controller's (241), so its
// Step moves the view BEFORE the same frame's spawns read it.
//
// global.flag[12] (screen-shake off) is 0 on the harness's fresh file, so
// the flag gate is compiled in as always-armed.

import { destroy } from './entity.js';

function restoreView(e, state) {
  state.view.x = e.camerax;
  state.view.y = e.cameray;
}

export const shake = {
  name: 'obj_shake',
  objIndex: 147, // dump object order

  create(e) {
    e.camera = 0;
    e.shakespeed = 1;
    e.shakesign = 1;
    e.shakex = 4;
    e.shakey = 4;
    e.siner = 0;
    e.active = 0;
    e.permashake = 0;
  },

  step(e, state) {
    if (e.active === 0) {
      e.camerax = state.view.x;
      e.cameray = state.view.y;
      state.view.x = e.camerax + e.shakex;
      state.view.y = e.cameray + e.shakey;
      e.shakesign = -e.shakesign;
      e.active = 1;
      e.alarm[0] = e.shakespeed;
    }
  },

  alarm: {
    0: (e, state) => {
      state.view.x = e.camerax + e.shakex * e.shakesign;
      state.view.y = e.cameray + e.shakey * e.shakesign;
      if (e.permashake === 0) {
        if (e.shakex > 0) e.shakex -= 1;
        if (e.shakey > 0) e.shakey -= 1;
      }
      e.shakesign = -e.shakesign;
      e.alarm[0] = e.shakespeed;
      if (e.shakex === 0 && e.shakey === 0) {
        restoreView(e, state); // Destroy event
        destroy(e);
      }
    },
  },
};

/** GML `instance_create(0, 0, obj_shake)`, with the caller's gate choice. */
export function spawnShake(state, spawnFn, { gated = false } = {}) {
  if (gated && state.entities.some((o) => o.alive && o.type === shake)) return;
  spawnFn(state, shake, { x: 0, y: 0 });
}
