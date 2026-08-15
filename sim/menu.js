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

/** scr_spellconsumeb — pay, mark the caster, advance. */
export function scrSpellconsumeb(state) {
  const p = state.party;
  state.tension -= state.pendingSpellCost ?? 0;
  p.charaction[state.charturn] = 2;
  const coord2 = state.bmenucoord2 ?? [0, 0, 0];
  const SPELLS = { 1: 0, 2: 4, 3: [3, 2][coord2[state.charturn]] ?? 0 };
  p.charspecial[state.charturn] = SPELLS[p.char[state.charturn]] ?? 0;
  scrNexthero(state);
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
    state.myfight = 4;
    spawn(state, spellphase, { x: 0, y: 0 });
  }
}

/**
 * obj_spellphase — the spell resolution queue. The pacify scope: one
 * caster (Ralsei), one spell. scr_spell case 3 on a TIRED monster runs
 * event_user(10) + scr_monsterdefeat — the PACIFY ENDING; on a lively
 * one it spawns the fail anim. spelltimer counts against spelldelay and
 * the spell writer must clear (the wr channel) before scr_attackphase.
 */
export const spellphase = {
  name: 'obj_spellphase',
  objIndex: 191,
  create(e, state) {
    // obj_spellphase Create, verbatim fields.
    e.spelltimer = 0;
    e.spellmax = 40;
    e.spelltotal = 0;
    e.char = 0;
    e.castyet = 0;
    e.re_castyet = 0;
    e.active = 0;
    e.alarm[0] = 5;
    e.using = [0, 0, 0];
    e.gotspell = [0, 0, 0];
    e.gotitem = [0, 0, 0];
  },
  alarm: {
    // Alarm_0 (+5 from create): scan charaction, put the first caster in
    // the spell pose (state 2 — the hero draw arms alarm[4] = 15, whose
    // handler runs scr_spell), raise the announcement writer (replayed by
    // the wr channel), arm the step loop. Measured on fullfight-pacify:
    // myfight 4 at f7065, wr up at f7070, jturn -1 at f7085 = +5 + 15.
    0: (e, state) => {
      const p = state.party;
      for (let xyz = 0; xyz < 3; xyz += 1) {
        e.using[xyz] = 0;
        e.gotspell[xyz] = 0;
        e.gotitem[xyz] = 0;
        if (p.charaction[xyz] === 2) {
          e.spelltotal += 1;
          e.using[xyz] = 1;
          e.gotspell[xyz] = 1;
          if (e.castyet === 0) {
            const hero = state.entities.find(
              (o) => o.alive && o.slot === xyz && o.type.objIndex >= 213 && o.type.objIndex <= 215);
            if (hero) {
              hero.state = 2;
              hero.attacktimer = 0;
              hero.itemed = 0;
            }
            e.castyet = 1;
            e.char = xyz + 1;
            // scr_spelltext + scr_battletext_default: the announcement
            // writer — its lifetime rides the wr channel.
          }
        }
        if (p.charaction[xyz] === 4) {
          e.spelltotal += 1;
          e.using[xyz] = 1;
          e.gotitem[xyz] = 1;
          if (e.castyet === 0) {
            const hero = state.entities.find(
              (o) => o.alive && o.slot === xyz && o.type.objIndex >= 213 && o.type.objIndex <= 215);
            if (hero) {
              hero.state = 4;
              hero.attacktimer = 0;
              hero.itemed = 0;
            }
            e.castyet = 1;
            e.char = xyz + 1;
          }
        }
      }
      e.active = 1;
      state.spelldelay = 90;
    },
  },
  step(e, state) {
    if (e.active !== 1) return;
    e.spelltimer += 1;
    if (e.spelltimer >= state.spelldelay && !(state.writerBusy?.(state.frame))) {
      if (e.char >= 3 || e.spelltotal === 1) {
        scrAttackphase(state);
        destroy(e);
      } else {
        // multi-caster re-queue (Step_0:23-68) — outside the pacify
        // scenario (one caster); translated when a scenario needs it.
        scrAttackphase(state);
        destroy(e);
      }
    }
  },
};

/**
 * scr_spell — the effect switch, called from the CASTER's Alarm_4
 * (obj_heroparent_Alarm_4: faceaction, scr_spell, state = 0), 15 frames
 * after the first state-2 draw armed it.
 */
export function scrSpell(state, spellId) {
  if (spellId === 3) {
    if (state.joker.monsterstatus === 1) {
      // flag[51] = 3; event_user(10): Other_20 — the spare anim,
      // scr_monsterdefeat, obj_joker destroyed with hp intact.
      state.jokerDefeated = true;
      state.jokerPacified = true;
    }
    // else: obj_pacifyspell fail anim (cosmetic)
    state.spelldelay = 20;
  } else {
    state.spelldelay = 15; // other spells: outside the pacify scope
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
    e.havechar = havechar;
    // boltorder: the pair of draws ALWAYS runs; with a full FIGHT roster
    // the no-char override never fires and the chain keys off the real
    // first draw. (havechar[1] && !havechar[2] would add a third.)
    let boltorder0 = gmlChoose(state.gmlRng, [0, 1, 2]);
    if (havechar[1] === 0 && havechar[2] === 0) boltorder0 = 0;
    if (boltorder0 === 2) gmlChoose(state.gmlRng, [0, 1]);
    else if (boltorder0 === 1) gmlChoose(state.gmlRng, [0, 2]);
    else gmlChoose(state.gmlRng, [1, 2]);
    if (havechar[1] === 1 && havechar[2] === 0) gmlChoose(state.gmlRng, [0, 1]);

    // mymethod 1 bolt build: charbolt 1 per fighter; boltchar by
    // rejection-sampled choose; boltframe walk seeded by lastbolt = -1
    // (the FIRST bolt lands at 30 - 1 = 29 — original quirk); diff 12
    // with flag[13] == 0.
    const charbolt = havechar.map((h) => (h === 1 ? 1 : 0));
    const bolttotal = charbolt[0] + charbolt[1] + charbolt[2];
    e.bolttotal = bolttotal;
    e.boltchar = [];
    e.boltframe = [];
    e.boltalive = [];
    const boltuse = [0, 0, 0];
    const diff = 12;
    for (let i = 0; i < bolttotal; i += 1) {
      e.boltalive[i] = 1;
      let c = gmlChoose(state.gmlRng, [0, 1, 2]);
      while (havechar[c] === 0) c = gmlChoose(state.gmlRng, [0, 1, 2]);
      while (boltuse[c] >= charbolt[c]) {
        c = gmlChoose(state.gmlRng, [0, 1, 2]);
        while (havechar[c] === 0) c = gmlChoose(state.gmlRng, [0, 1, 2]);
      }
      e.boltchar[i] = c;
      boltuse[c] += 1;
    }
    let boltxoff = 0;
    let lastbolt = -1;
    for (let i = 0; i < bolttotal; i += 1) {
      boltxoff += lastbolt;
      e.boltframe[i] = 30 + boltxoff;
      if (i < bolttotal - 1) {
        if (lastbolt !== 0 && e.boltchar[i] !== e.boltchar[i + 1]) {
          lastbolt = gmlChoose(state.gmlRng, [0, diff, diff * 1.5]);
        } else {
          lastbolt = gmlChoose(state.gmlRng, [diff, diff * 1.5]);
        }
      } else {
        lastbolt = gmlChoose(state.gmlRng, [diff, diff * 1.5]);
      }
    }
    // trace echo for the oracle's bf/bc columns
    state.lastBoltData = { frame: state.frame, boltframe: [...e.boltframe], boltchar: [...e.boltchar] };

    e.points = [0, 0, 0];
    e.attackedH = [0, 0, 0];
    e.maxdelay = 0;
    e.maxdelaytimer = 0;
    e.active = 0;
    e.posttimer = 0;
    e.boltx = 0;
    e.timermax = havechar.every((h) => h === 0) ? 3 : 50;
    e.fade = 0;
    e.fadeamt = 0;
  },
  drawStep(e, state) {
    const monsterAlive = state.joker.hp > 0 ? 1 : 0;
    e.maxdelaytimer += 1;
    if (e.maxdelaytimer >= e.maxdelay) e.active = 1;
    if (e.active !== 1) return;

    // bolt walk: expiry past the window, live counts per hero, and the
    // Other_11 handoff when a hero's bolts are spent.
    const boltcount = [0, 0, 0];
    for (let i = 0; i < e.bolttotal; i += 1) {
      if (e.boltframe[i] - e.boltx < -5) e.boltalive[i] = 0;
      if (e.boltalive[i] === 1) boltcount[e.boltchar[i]] += 1;
    }
    for (let i = 0; i < 3; i += 1) {
      if (boltcount[i] === 0 && e.havechar[i] === 1 && e.attackedH[i] === 0) {
        e.attackedH[i] = 1;
        // event_user(1): hand the points to the hero, start the swing.
        if (monsterAlive) {
          const hero = state.entities.find((h) => h.alive && h.slot === i && h.type.alarm?.[1]);
          if (hero) {
            hero.points = e.points[i];
            hero.state = 1;
            hero.attacked = 0;
          }
        }
        // ORIGINAL BUG (preserved): Other_11's own `for (i = 0; i < 3...)`
        // runs in the ap's scope and CLOBBERS this loop's i to 3 — only
        // ONE handoff resolves per draw frame, so two heroes whose bolts
        // die together (the dual press) swing on CONSECUTIVE frames
        // (measured: hs columns f1018/f1019, damage f1029/f1030).
        break;
      }
    }

    // the one-button press (flag[13] = 0): nearest live bolt in the
    // -5..+15 window, dual on an exact tie.
    if (monsterAlive && state.menuEdges?.confirm) {
      let qualify = -1;
      let topclose = 999;
      let dual = -1;
      for (let i = 0; i < e.bolttotal; i += 1) {
        if (e.boltalive[i] !== 1) continue;
        const close = e.boltframe[i] - e.boltx;
        if (close < 15 && close > -5) {
          if (close === topclose) dual = i;
          if (close < topclose) { topclose = close; qualify = i; }
        }
      }
      const award = (idx) => {
        const bc = e.boltchar[idx];
        const pp = Math.abs(topclose);
        if (pp === 0) e.points[bc] += 150;
        else if (pp === 1) e.points[bc] += 120;
        else if (pp === 2) e.points[bc] += 110;
        else e.points[bc] += 100 - pp * 2;
        e.boltalive[idx] = 0;
      };
      if (qualify !== -1) {
        award(qualify);
        if (dual !== -1) award(dual);
      }
    }

    if (monsterAlive === 0) {
      // the monster died mid-bar: fakefade + the snap forward.
      if (e.posttimer < e.timermax - 35) e.posttimer = e.timermax - 34;
    }
    e.boltx += 1;

    let goahead = 0;
    if ((e.attackedH[0] === 1 || e.havechar[0] === 0)
      && (e.attackedH[1] === 1 || e.havechar[1] === 0)
      && (e.attackedH[2] === 1 || e.havechar[2] === 0)) goahead = 1;
    if (monsterAlive === 0) goahead = 1;
    if (goahead === 1) {
      e.posttimer += 1;
      if (e.posttimer > e.timermax && e.fade === 0) {
        if (monsterAlive) {
          state.mnfight = 1;
          state.myfight = -1;
        } else {
          state.jokerDefeated = true; // scr_wincombat — claim window ends
        }
        e.fade = 1;
      }
      if (e.fade === 1) {
        e.fadeamt += 0.08;
        if (e.fadeamt > 1) destroy(e);
      }
    }
  },
};

/**
 * The myfight-0 button row. Called from obj_battlecontroller's step, ahead
 * of the mnfight-2 timer block, exactly where the original keeps it.
 */
export function menuStep(e, state) {
  if (state.myfight !== 0) return;
  const p = state.party;
  const inp = state.menuEdges;
  if (!inp) return;
  const coord = state.bmenucoord0;

  // ---- bmenuno 11: the ACT target column (single monster) ----
  // confirm -> bmenuno 9 with the actcoord snap-down; cancel -> row.
  if (state.bmenuno === 11) {
    if (inp.cancel && e.onebuffer < 0) {
      e.twobuffer = 1;
      state.bmenuno = 0;
      return;
    }
    if (inp.confirm && e.twobuffer < 0) {
      e.onebuffer = 1;
      state.bmenuno = 9;
      // actcoord snap: walk the cursor down past disabled acts (all of
      // Jevil's three acts are canact, so this is a no-op here).
      return;
    }
    return;
  }

  // ---- bmenuno 9: the ACT list (Jevil: Check 0 / Pirouette 1 / Hypnosis 2) ----
  if (state.bmenuno === 9) {
    const coord9 = state.bmenucoord9 ?? (state.bmenucoord9 = [0, 0, 0]);
    const canact = [1, 1, 1]; // scr_monstersetup type 20
    const actcost = [0, 50, 125];
    const actactor = [1, 1, 4]; // [check n/a] pirouette Kris, hypnosis both
    const c = () => coord9[state.charturn];
    if (inp.right) {
      // grid: even coord moves +1 if the odd neighbour exists
      if (c() % 2 === 0 && c() < 5 && canact[c() + 1]) coord9[state.charturn] += 1;
      else if (c() % 2 === 1) coord9[state.charturn] -= 1;
    }
    if (inp.left) {
      if (c() % 2 === 0 && canact[c() + 1]) coord9[state.charturn] += 1;
      else if (c() % 2 === 1) coord9[state.charturn] -= 1;
    }
    if (inp.down) {
      if (c() < 4 && canact[c() + 2]) coord9[state.charturn] += 2;
    }
    if (inp.up) {
      if (c() > 1) coord9[state.charturn] -= 2;
    }
    if (inp.confirm && canact[c()] === 1 && state.tension >= actcost[c()] && e.onebuffer < 0) {
      e.onebuffer = 2;
      state.bmenuno = 0;
      state.tension -= actcost[c()];
      const j = state.entities.find((o) => o.alive && o.type.name === 'obj_joker');
      if (j) j.acting = c() + 1; // 1 Check, 2 Pirouette, 3 Hypnosis
      state.acting[0] = 1;
      if (actactor[c()] === 4) {
        state.acting[1] = 1;
        state.acting[2] = 1;
      }
      for (let i = 0; i < 3; i += 1) {
        if (state.acting[i] === 1) p.charaction[i] = 9;
      }
      scrNexthero(state);
      return;
    }
    if (inp.cancel && e.onebuffer < 0) {
      e.twobuffer = 1;
      state.bmenuno = 11;
      return;
    }
    return;
  }

  // ---- bmenuno 2: the spell list (Ralsei: 0 Pacify c40 / 1 Heal c32) ----
  if (state.bmenuno === 2) {
    const coord2 = state.bmenucoord2 ?? (state.bmenucoord2 = [0, 0, 0]);
    // navigation elided: the pacify script confirms slot 0 directly.
    const spellId = p.char[state.charturn] === 3 ? [3, 2][coord2[state.charturn]] : 0;
    const SPELL_COST = { 3: 40, 2: 32 };
    const SPELL_TARGET = { 3: 2, 2: 1 };
    if (inp.confirm && spellId !== 0 && e.onebuffer < 0) {
      if ((SPELL_COST[spellId] ?? 0) <= state.tension) {
        e.onebuffer = 2;
        state.bmenuno = 0;
        state.pendingSpellCost = SPELL_COST[spellId] ?? 0;
        if (SPELL_TARGET[spellId] === 2) state.bmenuno = 3; // enemy target
        else if (SPELL_TARGET[spellId] === 1) state.bmenuno = 8; // ally
        else scrSpellconsumeb(state);
      }
      return;
    }
    if (inp.cancel && e.onebuffer < 0) {
      e.twobuffer = 1;
      state.bmenuno = 0;
      return;
    }
    return;
  }

  // ---- bmenuno 3: the spell's enemy target ----
  if (state.bmenuno === 3) {
    if (inp.cancel && e.onebuffer < 0) {
      e.twobuffer = 1;
      state.bmenuno = 2;
      return;
    }
    if (inp.confirm && e.onebuffer < 0) {
      e.onebuffer = 1;
      p.chartarget && (p.chartarget[state.charturn] = 0);
      scrSpellconsumeb(state);
    }
    return;
  }

  // ---- bmenuno 1: the FIGHT target column ----
  // (Step_0's grouped 7/1/8/3/11/12 block, single-monster scope: the
  // cursor pins to slot 0 — Jevil is the only monster — so up/down are
  // no-ops and confirm locks charaction 1. Cancel returns to the row.)
  if (state.bmenuno === 1) {
    if (inp.cancel && e.onebuffer < 0) {
      e.twobuffer = 1;
      state.bmenuno = 0;
      return;
    }
    if (inp.confirm && e.onebuffer < 0) {
      e.onebuffer = 1;
      p.chartarget && (p.chartarget[state.charturn] = 0);
      p.charaction[state.charturn] = 1;
      scrNexthero(state);
    }
    return;
  }
  if (state.bmenuno !== 0) return; // other submenus wait (labeled above)

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
  state.bmenucoord9 = [0, 0, 0];
  state.bmenucoord2 = [0, 0, 0];
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
