import { spawnShake } from './shake.js';
import { scrSpell } from './menu.js';
import { spawn } from './entity.js';
// The battle heroes — FIGHT-swing scope.
//
//   gml_Object_obj_heroparent_Draw_0    state-1 first draw: attacked = 1,
//                                       alarm[1] = 10 (sound + crit
//                                       fairies — fairy randoms ride the
//                                       presentation channel)
//   gml_Object_obj_heroparent_Alarm_1   scr_retarget, the enemy dmgwriter
//                                       (delay 8 — or 2 on a miss), the
//                                       DETERMINISTIC damage formula, the
//                                       monster hurt push
//
// damage = round(battleat * points / 20 - monsterdf * 3), floored at 0.
// No RNG in the roll; the writer's create/draw randoms are the only
// stream traffic, plus one laughnoise choose per hurt on the enemy side
// (channeled — it picks a sound).
//
// The heroes draw BEFORE the attackpress (depth 200/180/160 vs 0), so a
// swing handed off during the bar's draw starts its own first state-1
// draw the NEXT frame — the damage lands at handoff + 11. The sim's
// drawStep hook runs entities in creation order (heroes precede the ap),
// which reproduces exactly that.

import { gmlRandom } from './rng.js';
import { scrTensionheal } from './graze.js';

function jokerEntity(state) {
  return state.entities.find((o) => o.alive && o.type.name === 'obj_joker');
}

/** The enemy-side hurt push (scr_damage_enemy's monster half). */
function hurtJoker(state, amt) {
  // presentation annotation (no RNG, no logged column): the body's
  // condition-1 head swing scales with the hit (obj_joker Draw_0:6-11).
  state.lastHurt = { frame: state.frame, amt };
  const j = state.joker;
  j.hp -= 0; // hp already subtracted by the caller; this is the reaction
  if (amt > 0) {
    state.jokerHurtAmt = amt;
    state.jokerHurtTimer = 30;
    state.jokerHurtPending = true; // consumed by the joker's next draw
  }
}

function makeHero(slot, objIndex, name) {
  return {
    name,
    objIndex,
    create(e) {
      e.slot = slot;
      e.state = 0;
      e.attacked = 0;
      e.points = 0; // heroparent Create line 3
      e.cancelattack = 0;
    },
    drawStep(e, state) {
      if (e.state === 1 && e.attacked === 0) {
        // first swing draw: sound, crit fairies (channel), then the timer.
        // Kris's slash voice is his alone (Draw_0:53-56); a perfect bar
        // (150) stings on any hero (Draw_0 crit block).
        if (e.type.objIndex === 213) state.audio?.cue('snd_laz_c');
        if (e.points === 150) state.audio?.cue('snd_criticalswing');
        e.attacked = 1;
        e.alarm[1] = 10;
      }
      if (e.state === 2 && (e.hurt ?? 0) === 0) {
        // spell pose (Draw_0:99-121): first draw arms the strike alarm.
        if ((e.itemed ?? 0) === 0) {
          e.itemed = 1;
          e.alarm[4] = 15;
        }
      }
    },
    alarm: {
      // Alarm_4: the spell strike (faceaction, scr_spell, back to idle).
      4: (e, state) => {
        scrSpell(state, state.party.charspecial[e.slot]);
        e.state = 0;
        e.attacktimer = 0;
      },
      1: (e, state) => {
        // scr_retarget: single living monster — target stays 0; cancel
        // only when nothing lives.
        if (state.joker.hp <= 0) e.cancelattack = 1;
        if (e.cancelattack === 0) {
          // enemy dmgwriter: created FIRST (random(600)), delay 8 — or 2
          // when the swing misses (damage 0).
          gmlRandom(state.gmlRng, 600);
          const p = state.party;
          let damage = Math.round((p.battleat[e.slot] * e.points) / 20 - state.joker.df * 3);
          if (damage < 0) damage = 0;
          if (!state.dmgwriters) state.dmgwriters = [];
          state.dmgwriters.push({ delaytimer: 0, delay: damage === 0 ? 2 : 8 });
          state.joker.hp -= damage;
          if (damage > 0) {
            // TP on a landed hit: monstertype 20 (Jevil) pays
            // round(points / 15) — two-thirds of the normal /10 (the
            // wiki's claim, now dump-verified).
            scrTensionheal(state, Math.round(e.points / 15));
            // obj_basicattack spawn jitter: instance_create's args are
            // evaluated RIGHT-TO-LEFT, so the y random(6) draws before
            // the x one. The sprite itself is RNG-free.
            gmlRandom(state.gmlRng, 6);
            gmlRandom(state.gmlRng, 6);
            // Susie's connect ALONE screen-shakes (Alarm_1:54-61,
            // object_index == obj_herosusie): snd_impact + obj_shake.
            if (e.type.objIndex === 214) {
              state.audio?.cue('snd_impact'); // Alarm_1:59
              spawnShake(state, spawn, { gated: false });
            }
            // bc damagenoise relay — the enemy-hit thud.
            state.audio?.cue('snd_damage');
            hurtJoker(state, damage);
            const jk = jokerEntity(state);
            if (jk) jk.hurttimer = 30;
          }
        }
        e.state = 0;
        e.attacked = 0;
      },
    },
  };
}

// party [Kris, Susie, Ralsei] -> obj_herokris 213 / herosusie 214 /
// heroralsei 215 (dump object order).
export const heroKris = makeHero(0, 213, 'obj_herokris');
export const heroSusie = makeHero(1, 214, 'obj_herosusie');
export const heroRalsei = makeHero(2, 215, 'obj_heroralsei');
export const HEROES = [heroKris, heroSusie, heroRalsei];
