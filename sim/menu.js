// The chapter 1 battle menu — DEFEND-path translation.
//
//   gml_Object_obj_battlecontroller_Step_0   myfight-0 button row
//   scr_nexthero / scr_prevhero / scr_endturn / scr_attackphase
//   gml_Object_obj_attackpress_Create_0/Draw_0   (no-fighter path)
//
// SCOPE: everything the defend-only whole-fight exercises, verbatim: the
// five-button row with its crossed input buffers, DEFEND (+40 TP,
// charaction 10), hero advance/retreat, end-of-turn commit, and the
// attack-press interlude that hands the frame to the enemy turn. The
// FIGHT / ACT / ITEM / SPARE submenus are NOT translated: picking one
// sets bmenuno exactly as the original does and then the submenu waits
// forever — the whole-fight differ, not silence, is what flags a stray
// open. (ITEM with an empty bag is a faithful no-op: the original gates
// on tempitem[0] != 0.)
//
// INPUT: the menu runs on EDGES (left_p/right_p/button1_p/button2_p =
// global.input_pressed), not held state — stepFrame computes
// state.menuEdges from this frame's input vs the previous frame's, the
// same 0->1 rule obj_time's Begin Step poll produces. The four buffers
// cross-gate exactly as the original: a LEFT sets rbuffer, a RIGHT sets
// lbuffer, confirm sets onebuffer but checks twobuffer, cancel the
// reverse — all decremented once at the very bottom of the Step.
// obj_battlecontroller's Create zeroes all four, so the first press is
// accepted from the controller's second step on.

import { spawn, destroy } from './entity.js';
import { gmlChoose } from './rng.js';
import { scrTensionheal } from './graze.js';

/** scr_charcan — down, mid-ACT, or an empty slot cannot take a turn. */
function scrCharcan(state, slot) {
  const p = state.party;
  if (p.hp[p.char[slot]] <= 0) return false;
  if (state.acting?.[slot] === 1) return false;
  if (p.char[slot] === 0) return false;
  return true;
}

/** scr_nexthero — advance the raised panel, or commit the turn. */
export function scrNexthero(state) {
  const p = state.party;
  let moveswapped = 0;
  if (state.charturn === 0) {
    moveswapped = 1;
    if (p.charmove[1] === 1 && scrCharcan(state, 1)) {
      state.charturn = 1;
    } else if (p.charmove[2] === 1 && scrCharcan(state, 2)) {
      state.charturn = 2;
    } else {
      scrEndturn(state);
    }
  }
  if (state.charturn === 1 && moveswapped === 0) {
    moveswapped = 1;
    if (scrCharcan(state, 2) && (state.acting?.[1] ?? 0) === 0) {
      state.charturn = 2;
    } else {
      scrEndturn(state);
    }
  }
  if (state.charturn === 2 && moveswapped === 0) {
    scrEndturn(state);
  }
  if (moveswapped === 1) {
    state.bmenuno = 0;
  }
  // tempitem / temptension carry-forward: the scenario has no items, and
  // tension snapshots only matter to scr_prevhero's restore below.
  if (state.charturn > 0) {
    state.temptension[state.charturn] = state.tension;
  }
}

/** scr_prevhero — cancel back, undoing the previous panel's choice. */
export function scrPrevhero(state) {
  const p = state.party;
  let moveswapped = 0;
  if (state.charturn === 1) {
    if (p.charmove[0] === 1) {
      state.charturn = 0;
      moveswapped = 1;
    }
  } else if (state.charturn === 2) {
    moveswapped = 1;
    if (p.charmove[1] === 1 && (state.acting?.[1] ?? 0) === 0) {
      state.charturn = 1;
    } else if (p.charmove[0] === 1) {
      state.charturn = 0;
    }
  }
  if (moveswapped === 1) {
    state.bmenuno = 0;
    p.chartarget && (p.chartarget[state.charturn] = 0);
    p.charaction[state.charturn] = 0;
    p.charspecial[state.charturn] = 0;
  }
  if (state.charturn === 0) {
    state.acting = [0, 0, 0];
    p.charaction[1] = 0;
    p.charspecial[1] = 0;
    state.tension = state.temptension[0];
  } else {
    state.tension = state.temptension[state.charturn];
  }
}

/** scr_endturn — commit the chosen actions and enter the attack phase. */
export function scrEndturn(state) {
  const p = state.party;
  // item write-back: bagless scenario, nothing to move.
  state.attacking = 0;
  for (let i = 0; i < 3; i += 1) {
    if (p.charaction[i] === 1) state.attacking = 1;
  }
  if ((state.acting?.[0] ?? 0) === 0) {
    scrAttackphase(state);
  } else {
    state.charturn = 3;
    state.myfight = 3; // ACT resolution phase — outside the defend path
  }
}

/** scr_attackphase — the press bar, even when nobody chose FIGHT. */
export function scrAttackphase(state) {
  const p = state.party;
  let fightphase = 1;
  state.charturn = 3;
  for (let i = 0; i < 3; i += 1) {
    if (p.charaction[i] === 4 || p.charaction[i] === 2) fightphase = 0;
  }
  if (state.myfight === 4) fightphase = 1;
  if (fightphase === 1) {
    state.myfight = 1;
    spawn(state, attackpress, { x: 2, y: 365 });
  } else {
    state.myfight = 4; // obj_spellphase — outside the defend path
  }
}

/**
 * obj_attackpress, no-fighter path. Runs in the DRAW event (stepFrame's
 * draw-phase hook), which is why the enemy turn starts a fixed FOUR draws
 * after scr_endturn: created mid-step, its first draw is that same frame;
 * timermax is 3 when havechar is all zero; posttimer > 3 flips
 * mnfight = 1 / myfight = -1 on the fourth draw, and the fade destroys
 * the instance ~13 draws later.
 *
 * Create ALWAYS draws the bolt-order shuffle — choose(0,1,2), then (with
 * boltorder[0] forced back to 0 by the no-char override) choose(1,2) —
 * two RNG draws per turn that a menu-less sim would silently skip.
 */
export const attackpress = {
  name: 'obj_attackpress',
  objIndex: 190,
  create(e, state) {
    const p = state.party;
    const havechar = [0, 1, 2].map((i) => (p.charaction[i] === 1 ? 1 : 0));
    if (havechar.some((h) => h === 1)) {
      // FIGHT chose — the press bar proper is outside the defend path.
      // The spawn still happens so the differ sees the frozen phase.
      e.unsupportedFight = true;
    }
    const b0 = gmlChoose(state.gmlRng, [0, 1, 2]);
    let boltorder0 = b0;
    if (havechar[1] === 0 && havechar[2] === 0) boltorder0 = 0;
    if (boltorder0 === 2) gmlChoose(state.gmlRng, [0, 1]);
    else if (boltorder0 === 1) gmlChoose(state.gmlRng, [0, 2]);
    else gmlChoose(state.gmlRng, [1, 2]);
    if (havechar[1] === 1 && havechar[2] === 0) gmlChoose(state.gmlRng, [0, 1]);
    e.maxdelay = 0;
    e.maxdelaytimer = 0;
    e.active = 0;
    e.posttimer = 0;
    e.timermax = havechar.every((h) => h === 0) ? 3 : 50;
    e.fade = 0;
    e.fadeamt = 0;
  },
  drawStep(e, state) {
    if (e.unsupportedFight) return; // labeled: press bar untranslated
    e.maxdelaytimer += 1;
    if (e.maxdelaytimer >= e.maxdelay) e.active = 1;
    if (e.active !== 1) return;
    // no-char branch: fakefade + the posttimer snap (inert at timermax 3).
    if (e.posttimer < e.timermax - 35) e.posttimer = e.timermax - 34;
    // goahead is unconditional with no fighters alive on the bar.
    e.posttimer += 1;
    if (e.posttimer > e.timermax && e.fade === 0) {
      state.mnfight = 1;
      state.myfight = -1;
      e.fade = 1;
    }
    if (e.fade === 1) {
      e.fadeamt += 0.08;
      if (e.fadeamt > 1) destroy(e);
    }
  },
};

/**
 * The myfight-0 button row. Called from obj_battlecontroller's step, ahead
 * of the mnfight-2 timer block, exactly where the original keeps it.
 */
export function menuStep(e, state) {
  if (state.myfight !== 0) return;
  if (state.bmenuno !== 0) return; // an open submenu waits (labeled above)
  const p = state.party;
  const inp = state.menuEdges;
  if (!inp) return;
  const coord = state.bmenucoord0;

  if (inp.left && e.lbuffer < 0) {
    coord[state.charturn] = coord[state.charturn] === 0 ? 4 : coord[state.charturn] - 1;
    e.rbuffer = 1;
  }
  if (inp.right && e.rbuffer < 0) {
    coord[state.charturn] = coord[state.charturn] === 4 ? 0 : coord[state.charturn] + 1;
    e.lbuffer = 1;
  }
  if (inp.confirm && e.twobuffer < 0) {
    e.onebuffer = 1;
    const c = coord[state.charturn];
    if (c === 0) state.bmenuno = 1; // FIGHT target select
    if (c === 1) state.bmenuno = p.char[state.charturn] === 1 ? 11 : 2; // ACT / MAGIC
    // c === 2 (ITEM): gated on the bag being non-empty — it is empty.
    if (c === 3) state.bmenuno = 12; // SPARE
    if (c === 4) {
      scrTensionheal(state, 40);
      p.charaction[state.charturn] = 10;
      scrNexthero(state);
    }
  }
  if (inp.cancel && e.onebuffer < 0 && state.charturn > 0) {
    e.twobuffer = 1;
    scrPrevhero(state);
  }
}

/** The Step-bottom buffer decrements (lines 849-852 of the original). */
export function menuBuffers(e) {
  e.onebuffer -= 1;
  e.twobuffer -= 1;
  e.lbuffer -= 1;
  e.rbuffer -= 1;
}

/** scr_mnendturn's menu-side resets (the damage side lives in fight.js). */
export function mnendturnMenu(state) {
  const p = state.party;
  // scr_battlecursor_memory_reset — flag[14] is 0 in the scenario.
  state.bmenucoord0 = [0, 0, 0];
  state.mnfight = 0;
  state.myfight = 0;
  state.bmenuno = 0;
  state.charturn = 0;
  // downed or auto members skip their panel.
  if (p.charmove[0] === 0) state.charturn = 1;
  if (state.charturn === 1 && p.charmove[1] === 0) state.charturn = 2;
  let skip = 0;
  if (state.charturn === 2 && p.charmove[2] === 0) skip = 1;
  state.acting = [0, 0, 0];
  state.temptension = [state.tension, state.tension, state.tension];
  for (let i = 0; i < 3; i += 1) {
    p.charspecial[i] = 0;
    p.targeted[i] = 0;
    p.charaction[i] = 0;
  }
  if (skip === 1) {
    scrEndturn(state);
  }
}
