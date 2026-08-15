// ITEMS — chapter 1's table and the battle-use path.
//
// Names/descs verbatim from scr_iteminfo (lang_en.json); targets from its
// itemtarget column (0 unusable, 1 ally-select, 2 instant/team); battle
// effects from scr_spell's 200+ cases — NOT scr_itemuse, which is the
// overworld branch (LancerCookie famously heals 4 overworld and 50 in
// battle; the sim uses the battle value because the fight does).
//
// scr_heal is the funnel every heal goes through: no heal above maxhp,
// clamp at maxhp, and a heal that brings a downed ally to >= 0 revives
// them at no less than ceil(maxhp / 6).

import { gmlRandom } from './rng.js';
import { scrRevive } from './damage.js';

export const ITEMS = {
  1: { name: 'Dark Candy', desc: 'Heals#40HP', target: 1 },
  2: { name: 'ReviveMint', desc: 'Heal#Downed#Ally', target: 1 },
  3: { name: 'Glowshard', desc: 'Sell#at#shops', target: 0 },
  4: { name: 'Manual', desc: 'Read#out of#battle', target: 2 },
  5: { name: 'BrokenCake', desc: 'Heals#20HP', target: 1 },
  6: { name: 'Top Cake', desc: 'Heals#team#160HP', target: 2 },
  7: { name: 'Spincake', desc: 'Heals#team#80HP', target: 2 },
  8: { name: 'Darkburger', desc: 'Heals#70HP', target: 1 },
  9: { name: 'LancerCookie', desc: 'Heals#50HP', target: 1 },
  10: { name: 'GigaSalad', desc: 'Heals#4HP', target: 1 },
  11: { name: 'ClubsSandwich', desc: 'Heals#team#30HP', target: 2 },
  12: { name: 'HeartsDonut', desc: 'Healing#varies', target: 1 },
  13: { name: 'ChocDiamond', desc: 'Healing#varies', target: 1 },
  14: { name: 'Favwich', desc: 'Heals#ALL HP', target: 1 },
  15: { name: 'RouxlsRoux', desc: 'Heals#50 HP', target: 1 },
};

/**
 * The interactive fight's bag (13 slots, index 12 the shift spare) —
 * the specified loadout: 1 Top Cake, 2 ReviveMints, 9 Darkburgers.
 */
export function freshInventory() {
  return [6, 2, 2, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0];
}

/** scr_heal(slot, amount) — the funnel; returns the hp gained. */
export function scrHeal(state, slot, amount) {
  const p = state.party;
  const ch = p.char[slot];
  const cur = p.hp[ch];
  const belowzero = cur <= 0;
  const abovemax = cur > p.maxhp[ch];
  if (!abovemax) {
    p.hp[ch] += amount;
    if (p.hp[ch] > p.maxhp[ch]) p.hp[ch] = p.maxhp[ch];
  }
  if (belowzero && p.hp[ch] >= 0) {
    const floor6 = Math.ceil(p.maxhp[ch] / 6);
    if (p.hp[ch] < floor6) p.hp[ch] = floor6;
    scrRevive(p, slot);
  }
  state.audio?.cue('snd_power');
  return p.hp[ch] - cur;
}

/** scr_healitemspell — heal + the REAL dmgwriter (random(600), delay 8). */
export function scrHealitemspell(state, slot, amount) {
  const healed = scrHeal(state, slot, amount);
  gmlRandom(state.gmlRng, 600);
  if (!state.dmgwriters) state.dmgwriters = [];
  state.dmgwriters.push({ delaytimer: 0, delay: 8 });
  state.dmgNumbers?.push({ slot, damage: healed, type: 3 });
  state.spelldelay = 15;
}

/** scr_healallitemspell — the team loop. */
export function scrHealallitemspell(state, amount) {
  for (let i = 0; i < 3; i += 1) {
    if (state.party.char[i] !== 0) scrHealitemspell(state, i, amount);
  }
}

/**
 * scr_spell cases 200-215 — the battle item effects. `star` is
 * global.chartarget[caster] (the ally picked in bmenuno 7, or the
 * caster for instant items).
 */
export function scrItemspell(state, itemId, star) {
  const p = state.party;
  switch (itemId) {
    case 1: scrHealitemspell(state, star, 40); break;
    case 2: {
      const ch = p.char[star];
      let amt = Math.ceil(p.maxhp[ch] / 2);
      if (p.hp[ch] <= 0) amt = Math.ceil(p.maxhp[ch]) + Math.abs(p.hp[ch]);
      scrHealitemspell(state, star, amt);
      break;
    }
    case 5: scrHealitemspell(state, star, 20); break;
    case 6: scrHealallitemspell(state, 160); break;
    case 7: scrHealallitemspell(state, 80); break;
    case 8: scrHealitemspell(state, star, 70); break;
    case 9: scrHealitemspell(state, star, 50); break;
    case 10: scrHealitemspell(state, star, 4); break;
    case 11: scrHealallitemspell(state, 30); break;
    case 12: scrHealitemspell(state, star, [0, 10, 90, 60][p.char[star]] ?? 10); break;
    case 13: scrHealitemspell(state, star, [0, 80, 30, 30][p.char[star]] ?? 30); break;
    case 14: scrHealitemspell(state, star, 500); break;
    case 15: scrHealitemspell(state, star, 50); break;
    default: break; // 3 Glowshard / 4 Manual: nothing in battle
  }
  state.spelldelay = 10;
}
