// The chapter 1 party damage system.
//
//   scr_damage        gml_GlobalScript_scr_damage       (runs in the
//                     BULLET's scope: damage/target are its fields)
//   scr_damage_all    gml_GlobalScript_scr_damage_all
//   scr_dead/revive   the five-globals down state (slot-indexed)
//   scr_heal          heal + the revive floor ceil(maxhp/6)
//   turn-end autoheal scr_mnendturn: every downed member heals
//                     ceil(maxhp/8) at end of turn
//
// MEASURED FACTS this encodes:
//   - i-frames are ALWAYS global.invc * 40. Bullet `inv` fields are
//     WRITE-ONLY in chapter 1 (no reader anywhere in the dump) — the
//     dispatch table's dc.inv = 20 for jattack 4/8 is an ORIGINAL BUG.
//   - target redirection: a hit on a downed member rerolls
//     choose(0,1,2) until it lands on a targetable slot — CONSUMES RNG.
//   - DF reduction ceil(damage - battledf*3), DEFEND ceil(2/3), floor 1.
//   - down: hp = round(-maxhp/2), scr_dead. An ALREADY-down member hit
//     directly takes round(tdamage/4) more.
//   - the target==3 (AOE) branch inside scr_damage: DEFEND halves
//     (ceil/2, NOT 2/3); a member crossing 0 gets
//     round(-global.maxhp[0]/2) — maxhp[0] is 0, so AOE downs land at
//     EXACTLY 0 HP, and scr_dead is NEVER called for them (both
//     ORIGINAL BUGS, preserved; hp 0 members remain targetable).
//
// Party defaults: fresh chapter 1 file — hp 90/110/70 (Kris/Susie/Ralsei),
// base df 2, no equipment bonuses (battledf 2 each). Labeled constant per
// the dodge-only posture.

import { gmlChoose, gmlRandom } from './rng.js';

export function freshParty() {
  return {
    char: [1, 2, 3], // slot -> character id (Kris, Susie, Ralsei)
    hp: [0, 90, 110, 70], // CHARACTER-indexed (hp[0] unused, = 0)
    maxhp: [0, 90, 110, 70],
    battledf: [2, 2, 2], // slot-indexed
    charaction: [0, 0, 0], // 10 = DEFEND
    charcantarget: [1, 1, 1],
    charmove: [1, 1, 1],
    chardead: [0, 0, 0],
    charspecial: [0, 0, 0],
    targeted: [0, 0, 0],
  };
}

export function scrDead(p, slot) {
  p.charmove[slot] = 0;
  p.charcantarget[slot] = 0;
  p.chardead[slot] = 1;
  p.charaction[slot] = 0;
  p.charspecial[slot] = 0;
}

export function scrRevive(p, slot) {
  p.charmove[slot] = 1;
  p.charcantarget[slot] = 1;
  p.chardead[slot] = 0;
}

/** scr_heal(slot, amount) — returns the HP actually gained. */
export function scrHeal(state, slot, amount) {
  const p = state.party;
  const t = p.char[slot];
  const cur = p.hp[t];
  const belowzero = p.hp[t] <= 0;
  const abovemax = p.hp[t] > p.maxhp[t];
  if (!abovemax) {
    p.hp[t] += amount;
    if (p.hp[t] > p.maxhp[t]) p.hp[t] = p.maxhp[t];
  }
  if (belowzero && p.hp[t] >= 0) {
    if (p.hp[t] < Math.ceil(p.maxhp[t] / 6)) {
      p.hp[t] = Math.ceil(p.maxhp[t] / 6);
    }
    scrRevive(p, slot);
  }
  state.audio?.cue('snd_power');
  return p.hp[t] - cur;
}

/** scr_randomtarget — consumes RNG. Returns the slot (or 3 if none). */
export function scrRandomtarget(state) {
  const p = state.party;
  const able = !(p.charcantarget[0] === 0 && p.charcantarget[1] === 0 && p.charcantarget[2] === 0);
  let mytarget = gmlChoose(state.gmlRng, [0, 1, 2]);
  if (able) {
    while (p.charcantarget[mytarget] === 0) {
      mytarget = gmlChoose(state.gmlRng, [0, 1, 2]);
    }
  } else {
    mytarget = 3;
  }
  // ORIGINAL: `global.targeted[mytarget] = 1` UNGUARDED — a whole-party-
  // untargetable roll writes targeted[3] (the array grows; no reader uses
  // index 3). Faithful, not redirected.
  p.targeted[mytarget] = 1;
  state.lastMytarget = mytarget;
  return mytarget;
}

/**
 * scr_damage, in the bullet's scope. Mutates party/inv; sets state.gameOver
 * when the whole party is down.
 */
export function scrDamage(state, b) {
  const p = state.party;
  if (!(state.invTimer < 0)) return;

  let target = b.target;
  // (scr_damage_cache — an event-system snapshot; no event manager here.)
  if (target < 3) {
    if (p.hp[p.char[target]] <= 0) {
      target = scrRandomtarget(state);
      b.target = target;
    }
  }
  let chartarget = 3;
  let tdamage = b.damage;
  if (target < 3) {
    tdamage = Math.ceil(tdamage - p.battledf[target] * 3);
    chartarget = p.char[target];
    if (p.charaction[target] === 10) {
      tdamage = Math.ceil((2 * tdamage) / 3);
    }
    if (tdamage < 1) {
      tdamage = 1;
    }
  }
  // obj_shake / charinstance hurt pose / dmgwriter killactive: renderer's.
  state.shake = 8;
  let hpdiff = tdamage;
  let doomtype = -1;
  if (state.soul && state.soul.alive) {
    state.soul.dmgnoise = 1;
  }
  if (target < 3) {
    if (p.hp[chartarget] <= 0) {
      doomtype = 4;
      p.hp[chartarget] -= Math.round(tdamage / 4);
      hpdiff = Math.round(tdamage / 4);
    } else {
      p.hp[chartarget] -= tdamage;
      if (p.hp[chartarget] <= 0) {
        hpdiff = Math.abs(p.hp[chartarget] - p.maxhp[chartarget] / 2);
        doomtype = 4;
        p.hp[chartarget] = Math.round(-p.maxhp[chartarget] / 2);
        scrDead(p, target);
      }
    }
    // instance_create(obj_dmgwriter): its Create draws round(random(600))
    // into `damage` (immediately overwritten — but the draw is consumed),
    // and its Draw event draws -5 - random(2) on its SECOND draw frame.
    // The stream shift is real: skipping these desyncs every spawn after
    // the first hit (live-65/70 graze frames caught it).
    gmlRandom(state.gmlRng, 600);
    if (!state.dmgwriters) state.dmgwriters = [];
    state.dmgwriters.push({ delaytimer: 0 });
    state.dmgNumbers?.push({ slot: target, damage: hpdiff, type: doomtype });
  }
  if (target === 3) {
    for (let hpi = 0; hpi < 3; hpi += 1) {
      const ct = p.char[hpi];
      if (p.hp[ct] >= 0) {
        if (p.charaction[hpi] === 10) {
          p.hp[ct] -= Math.ceil(tdamage / 2);
        } else {
          p.hp[ct] -= tdamage;
        }
        if (p.hp[ct] <= 0) {
          // ORIGINAL BUG (preserved): maxhp[0] is 0, so AOE downs land at
          // exactly 0 HP — and scr_dead is never called here.
          p.hp[ct] = Math.round(-p.maxhp[0] / 2);
        }
      }
    }
  }
  state.invTimer = state.invc * 40;
  let gameover = 1;
  for (let i = 0; i < 3; i++) {
    if (p.char[i] !== 0 && p.hp[p.char[i]] > 0) gameover = 0;
  }
  if (gameover === 1) {
    state.gameOver = true; // scr_gameover
  }
}

/** scr_damage_all — three redirected hits with the inv gate reopened. */
export function scrDamageAll(state, b) {
  const p = state.party;
  if (!(state.invTimer < 0)) return;
  const remdamage = b.damage;
  const temptarget = b.target;
  for (let ti = 0; ti < 3; ti += 1) {
    state.invTimer = -1;
    b.damage = remdamage;
    b.target = ti;
    if (p.hp[p.char[ti]] > 0 && p.char[ti] !== 0) {
      scrDamage(state, b);
    }
  }
  state.invTimer = state.invc * 40;
  b.target = temptarget;
}

/**
 * scr_mnendturn's down-autoheal: every downed member gets ceil(maxhp/8),
 * announced by a REAL obj_dmgwriter (delay 1, type 3) — created BEFORE
 * scr_heal runs, so its round(random(600)) draw precedes any heal effect,
 * and its -5 - random(2) draw lands in the same frame's draw phase.
 */
export function endTurnAutoheal(state) {
  const p = state.party;
  for (let i = 0; i < 3; i += 1) {
    const t = p.char[i];
    if (t !== 0 && p.hp[t] <= 0) {
      gmlRandom(state.gmlRng, 600);
      if (!state.dmgwriters) state.dmgwriters = [];
      state.dmgwriters.push({ delaytimer: 0, delay: 1 });
      scrHeal(state, i, Math.ceil(p.maxhp[t] / 8));
    }
  }
}
