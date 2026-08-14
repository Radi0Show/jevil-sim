// The soul. Translated from CHAPTER 1's obj_heart.
//
//   Create : gml_Object_obj_heart_Create_0   (14 lines)
//   Step   : gml_Object_obj_heart_Step_0     (lines 1-256 — the whole event)
//
// Translated line-for-line, in source order. Rules 3 and 4 apply throughout:
// expressions are not split or factored, and `ceil` stays `ceil`. Where the
// original reads a global, the equivalent lives on `state`.
//
// CHAPTER 1 vs the knight-sim (chapter 3) soul, from the dumps:
//   - no `canmove` gate, no `global.flag[22]` focus kill-switch, no yellow
//     soul (`color`) — none of those exist in this Step;
//   - wspeed is a persistent instance variable (dc types 68/77 assign it for
//     a turn; each turn's fresh heart resets it to global.sp), never
//     reassigned per frame by the enemy;
//   - the X-resolution block tests place_meeting TWICE before the slide loop
//     (a doubled `if` in the source — preserved, it is harmless but real);
//   - after the commit: dmgnoise handling, `global.inv -= 1`, image_speed
//     bookkeeping, heartx/hearty export.
//
// Out of scope (dodge-first): snd_hurt1 playback itself — the dmgnoise FLAG
// logic is kept (state.dmgnoise consumers cue audio), the sound call is the
// renderer's.
//
// obj_heart Create also creates obj_grazebox at (x+10, y+10); the grazebox
// entity arrives with the graze translation — stepFrame already tracks
// `state.grazePrev` at the same offset.

import { placeMeetingSolid } from './collision.js';

// obj_heart's VISIBLE sprite is spr_dodgeheart, 20x20, origin (0,0) — so
// sprite_width/sprite_height in the boundary clamps are both 20. Distinct
// from the collision mask (spr_dodgeheartmask), which is heart-shaped and
// inset; the boundary clamp uses the sprite, collision uses the mask.
const SPRITE_WIDTH = 20;
const SPRITE_HEIGHT = 20;

export const soul = {
  name: 'obj_heart',
  objIndex: 313, // dump object order

  create(e, state) {
    // global.sp = 4; wspeed = global.sp;
    state.sp = 4;
    e.wspeed = state.sp;

    e.image_speed = 0;
    e.fly = 0;
    e.darken = 1;
    e.darkamt = 0;
    e.dmgnoise = 0;
    // instance_create(x + 10, y + 10, obj_grazebox) — see module header.
    e.boundaryup = 0;

    // disableslow latches here if focus is ALREADY held at create time, and is
    // only cleared by releasing focus. Holding focus through the transition
    // into the fight therefore does not slow the opening frames.
    e.disableslow = 0;
    if (state.input && state.input.focus) {
      e.disableslow = 1;
    }
  },

  step(e, state) {
    const input = state.input;

    e.wallcheck = 0;
    let press_l = 0;
    let press_r = 0;
    let press_d = 0;
    let press_u = 0;
    let bkx = 0;
    let bky = 0;
    let bkxy = 0;
    e.jelly = 2;

    if (input.left) press_l = 1;
    if (input.right) press_r = 1;
    if (input.up) press_u = 1;
    if (input.down) press_d = 1;

    let px = 0;
    let py = 0;

    // Axes are set independently — no normalisation. A diagonal moves wspeed
    // on both axes. Assignment order: left after right, down before up, so
    // opposite holds resolve left / up.
    if (press_r === 1) px = e.wspeed;
    if (press_l === 1) px = -e.wspeed;
    if (press_d === 1) py = e.wspeed;
    if (press_u === 1) py = -e.wspeed;

    if (input.focus) {
      if (e.disableslow === 0) {
        px = Math.ceil(px * 0.5);
        py = Math.ceil(py * 0.5);
      }
    } else {
      e.disableslow = 0;
    }

    // ---- collision resolution against obj_battlesolid ----------------------
    // Source order: the early xymeet probe, then X alone (corner-slide on the
    // Y axis first), then Y alone (corner-slide on X), then the diagonal
    // walk-down. Each pass may slide the soul to escape.

    let xmeet = 0;
    let ymeet = 0;
    let xymeet = 0;
    if (placeMeetingSolid(state, e.x + px, e.y + py)) {
      xymeet = 1;
    }

    if (placeMeetingSolid(state, e.x + px, e.y)) {
      // The doubled test is in the original. Preserved as one nested check.
      if (placeMeetingSolid(state, e.x + px, e.y)) {
        for (let g = e.wspeed; g > 0; g -= 1) {
          let mvd = 0;
          if (press_d === 0 && !placeMeetingSolid(state, e.x + px, e.y - g)) {
            e.y -= g;
            py = 0;
            break;
          }
          if (press_u === 0 && mvd === 0 && !placeMeetingSolid(state, e.x + px, e.y + g)) {
            e.y += g;
            py = 0;
            break;
          }
        }
      }
      xmeet = 1;
      bkx = 0;
      if (px > 0) {
        for (let i = px; i >= 0; i -= 1) {
          if (!placeMeetingSolid(state, e.x + i, e.y)) {
            px = i;
            bkx = 1;
            break;
          }
        }
      }
      if (px < 0) {
        for (let i = px; i <= 0; i += 1) {
          if (!placeMeetingSolid(state, e.x + i, e.y)) {
            px = i;
            bkx = 1;
            break;
          }
        }
      }
      if (bkx === 0) px = 0;
    }

    if (placeMeetingSolid(state, e.x, e.y + py)) {
      ymeet = 1;
      bky = 0;
      if (placeMeetingSolid(state, e.x, e.y + py)) {
        for (let g = e.wspeed; g > 0; g -= 1) {
          let mvd = 0;
          if (press_r === 0 && !placeMeetingSolid(state, e.x - g, e.y + py)) {
            e.x -= g;
            px = 0;
            break;
          }
          if (mvd === 0 && press_l === 0 && !placeMeetingSolid(state, e.x + g, e.y + py)) {
            e.x += g;
            px = 0;
            break;
          }
        }
      }
      if (py > 0) {
        for (let i = py; i >= 0; i -= 1) {
          if (!placeMeetingSolid(state, e.x, e.y + i)) {
            py = i;
            bky = 1;
            break;
          }
        }
      }
      if (py < 0) {
        for (let i = py; i <= 0; i += 1) {
          if (!placeMeetingSolid(state, e.x, e.y + i)) {
            py = i;
            bky = 1;
            break;
          }
        }
      }
      if (bky === 0) py = 0;
    }

    if (placeMeetingSolid(state, e.x + px, e.y + py)) {
      xymeet = 1;
      bkxy = 0;
      let i = px;
      let j = py;
      while (j !== 0 || i !== 0) {
        if (!placeMeetingSolid(state, e.x + i, e.y + j)) {
          px = i;
          py = j;
          bkxy = 1;
          break;
        }
        if (Math.abs(j) >= 1) {
          if (j > 0) j -= 1;
          if (j < 0) j += 1;
        } else {
          j = 0;
        }
        if (Math.abs(i) >= 1) {
          if (i > 0) i -= 1;
          if (i < 0) i += 1;
        } else {
          i = 0;
        }
      }
      if (bkxy === 0) {
        px = 0;
        py = 0;
      }
    }

    // ---- view boundary clamp ----------------------------------------------
    // __view_get(e__VW.XView, 0) / YView. The soul is clamped to a 640x320
    // region measured from the view origin, with `boundaryup` extending the
    // floor (type 77 sets it to 160 for the full-screen phase).

    if (e.x + px >= state.view.x + 640 - SPRITE_WIDTH) {
      px = state.view.x + 640 - SPRITE_WIDTH - e.x;
    }
    if (e.x + px <= 0) {
      px = -e.x;
    }
    if (e.y + py <= 0) {
      py = -e.y;
    }
    if (e.y + py >= state.view.y + 320 - SPRITE_HEIGHT + e.boundaryup) {
      py = state.view.y + 320 - SPRITE_HEIGHT - e.y + e.boundaryup;
    }

    // Single commit point, after every resolution pass.
    e.x += px;
    e.y += py;

    // dmgnoise: set by the damage path, consumed here (the sound itself is
    // the renderer's; the FLAG semantics are the sim's).
    if (e.dmgnoise === 1) {
      e.dmgnoise = 0;
      state.dmgnoiseCue = (state.dmgnoiseCue ?? 0) + 1;
    }

    // global.inv -= 1. Unclamped in the original — it goes negative and stays
    // there between hits. Do not "fix" this to a floor of zero.
    state.invTimer -= 1;
    if (state.invTimer > 0) {
      e.image_speed = 0.25;
    } else {
      e.image_speed = 0;
      e.image_index = 0;
    }

    state.heartx = e.x + 2 - state.view.x;
    state.hearty = e.y + 2 - state.view.y;
  },
};
