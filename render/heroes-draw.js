// The three battle heroes — obj_heroparent's Draw, renderer edition.
//
// Sprite tables verbatim from obj_heroparent_Create_0 (Kris defaults at
// lines 21-42, Susie 80-111, Ralsei 112-137; ch1 fresh file: Susie armed).
// The sim's hero entities carry gameplay state (state 0/1/2, slot, points);
// pose timers (siner, attacktimer) are presentation and live here.
//
// Placement: scr_encountersetup:7-8 — heromakex 80, heromakey 50 + 80*i.
//
// Approximations, LABELLED:
//   - hurt/defeat/victory poses are wired but the immortal harness
//     scenarios never show most of them.
//   - image_blend combat darkening (obj_darkener fade) is a flat step,
//     not the 15-frame ramp.

const TABLES = [
  { // Kris (armed)
    idle: 'spr_krisb_idle', attackready: 'spr_krisb_attackready',
    attack: 'spr_krisb_attack', act: 'spr_krisb_act', actready: 'spr_krisb_actready',
    defend: 'spr_krisb_attackready', hurt: 'spr_krisb_hurt', defeat: 'spr_krisb_defeat',
    spellready: 'spr_ralseib_spellready', spell: 'spr_ralseib_spell',
    attackframes: 3, attackspeed: 1,
  },
  { // Susie (armed)
    idle: 'spr_susieb_idle', attackready: 'spr_susieb_attackready',
    attack: 'spr_susieb_attack', act: 'spr_susieb_act', actready: 'spr_susieb_actready',
    defend: 'spr_susieb_defend', hurt: 'spr_susieb_hurt', defeat: 'spr_susieb_defeat',
    spellready: 'spr_susieb_spellready', spell: 'spr_susieb_spell',
    attackframes: 5, attackspeed: 0.5,
  },
  { // Ralsei
    idle: 'spr_ralseib_idle', attackready: 'spr_ralseib_attackready',
    attack: 'spr_ralseib_attack', act: 'spr_ralseib_act', actready: 'spr_ralseib_actready',
    defend: 'spr_ralseib_defend', hurt: 'spr_ralsei_shock', defeat: 'spr_ralseib_defeat', // shock not yet packed — misses draw nothing
    spellready: 'spr_ralseib_spellready', spell: 'spr_ralseib_spell',
    attackframes: 5, attackspeed: 0.5,
  },
];

const anim = [
  { siner: 0, attacktimer: 0 },
  { siner: 0, attacktimer: 0 },
  { siner: 0, attacktimer: 0 },
];

export function heroX() { return 80; }
export function heroY(slot) { return 50 + 80 * slot; }

/**
 * Draw one hero entity. Returns true (always handles them).
 * blitFn(name, idx, x, y) is the caller's origin-aware sprite blit.
 */
export function drawHero(e, state, blitFn, simAdvanced = true) {
  const slot = e.slot ?? 0;
  const t = TABLES[slot];
  const a = anim[slot];
  const p = state.party;
  const x = heroX();
  const y = heroY(slot);

  let sprite = t.idle;
  let index;

  const st = e.state ?? 0;
  if (st === 1) {
    // the swing: attacktimer walks the frames, clamps at the last
    // (Draw_0:87-98), attackspeed per hero.
    sprite = t.attack;
    index = Math.min(a.attacktimer, t.attackframes);
    if (simAdvanced) a.attacktimer += t.attackspeed;
  } else if (st === 2) {
    sprite = t.spell;
    index = Math.min(a.attacktimer * 0.5, 7);
    if (simAdvanced) a.attacktimer += 1;
  } else {
    a.attacktimer = 0;
    // state 0: pose by the chosen action while the round resolves
    // (faceaction analog — charaction 1 fight / 9 act / 2 spell /
    // 10 defend), idle otherwise; index = siner / 5 (Draw_0:44).
    const ca = p?.charaction?.[slot] ?? 0;
    if (ca === 1) sprite = t.attackready;
    if (ca === 9) sprite = t.actready;
    if (ca === 2) sprite = t.spellready;
    if (ca === 10) sprite = t.defend;
    index = a.siner / 5;
    if (simAdvanced) a.siner += 1;
  }
  blitFn(sprite, index, x, y);
  return true;
}
