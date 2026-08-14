// Pre-oracle soul scenes: the chapter 1 soul, alone, walked into walls.
//
// Two variants of wall:
//   - the VIEW BOUNDARY (fully determined by the Step source: view origin,
//     640 wide, sprite_width 20 — the soul stops with its left edge at 620);
//   - the BATTLE BOX (obj_growtangle settled at (320,170) scale 2 — the
//     hollow-ring precise mask, calibrated in sim/masks.js).
//
// These prove determinism and internal consistency only. The oracle trace
// (jevil-research traces/t3-*) is what settles them against the real game.

import { spawn } from '../../sim/entity.js';
import { soul } from '../../sim/soul.js';
import { battlebox, settleBox } from '../../sim/battlebox.js';

/**
 * @param {object} state
 * @param {{x?: number, y?: number, box?: boolean}} opts
 */
export function buildSoulWallScene(state, { x = 320, y = 160, box = false } = {}) {
  state.hp = 90;
  state.invTimer = 0;
  state.phase = 'freemove';
  state.view = { x: 0, y: 0 };

  if (box) {
    // The game creates the box at (view+320, view+170) — obj_joker Step.
    const gt = spawn(state, battlebox, { x: 320, y: 170 });
    settleBox(gt);
    // Heart placed like the game's scr_moveheart handoff: box centre-ish.
    state.soul = spawn(state, soul, { x: 314, y: 162 });
  } else {
    state.soul = spawn(state, soul, { x, y });
  }
  return state;
}

export function buildSoulBoxScene(state) {
  return buildSoulWallScene(state, { box: true });
}

// Hold right, forever. Without the box the soul advances 4px/frame from 320
// and stops dead at 620 (320 + 640 - 20, view at origin); with the box it
// rests against the ring's interior.
export const HOLD_RIGHT = [{ from: 0, right: true }];

// Focus applied mid-travel, well before the wall, so the ceil() halving is
// visible as a change in speed rather than hidden behind the clamp. Pressed
// at frame 20 — not held from frame 0 — because holding it at create time
// latches disableslow and the halving never engages at all.
export const HOLD_RIGHT_THEN_FOCUS = [
  { from: 0, right: true },
  { from: 20, right: true, focus: true },
];

// Down-right diagonal into the corner. Confirms the axes clamp independently
// and that neither is normalised.
export const DIAGONAL_INTO_CORNER = [{ from: 0, right: true, down: true }];
