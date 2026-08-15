// Battle text — Jevil's talk bubble and the bottom flavor message.
//
//   TALK (mnfight 1): global.msg[0] feeds the enemy blcon writer — the
//   bubble left of Jevil (scr_enemyblcon picks spr_battleblcon_long_r
//   for a right-side monster), text in dotumche, '&' line breaks,
//   revealed one character per frame.
//
//   ATTACK (mnfight 2): global.battlemsg[0] — the "* ..." line in
//   mainbig at the message area, from the dispatch rr with the
//   dancelv/jturn/TIRED overrides (obj_joker Step_0:283-322).
//
// Strings resolved from the game's own lang_en.json at port time. The
// sim annotates WHICH line the verified stream picked (state.enemyLine,
// state.enemyFlavor); this module only displays.

import { loadFont, drawText } from './font.js';

const DOTUMCHE = loadFont('../assets/fonts', 'fnt_dotumche');
const MAINBIG = loadFont('../assets/fonts', 'fnt_mainbig');

// obj_joker Step_0:95-199 — global.msg[0] per jturn (talk bubbles).
const TALK = {
  0: 'CHAOS, CHAOS,&&CATCH ME&IF YOU CAN!',
  1: 'SHALL WE&PLAY THE&RING-AROUND?',
  2: 'MY HEARTS GO&OUT TO ALL&YOU SINNERS!',
  3: "HA, HA, LET'S&MAKE THE&DEVILSKNIFE.",
  5: "PIIP PIIP,&LET'S RIDE THE&CAROUSEL GAME.",
  6: 'HEE HEE,&HAVING FUN!?&JOIN THE&CLUB!',
  7: 'HEARTS,&DIAMONDS,&I CAN DO&ANYTHING!',
  8: 'WHO KEEPS&SPINNING THE&WORLD&AROUND?',
  10: 'YOU KIDS ARE&REALLY&KEEPING UP!',
  11: 'NU-HA!!&I NEVER HAD&SUCH FUN,&FUN!!',
  12: 'A BEAUTY IS&JOYING IN&MY HEART!',
  13: 'EVEN&DEVILSKNIFE&IS SMILING!',
  15: "IT'S SO&EXCITING...&I CAN'T&TAKE IT!!!",
  16: 'THIS IS IT,&BOISENGIRLS!&SEE YA!',
  17: 'ENOUGH!!&YOU KIDS&TIRED ME UP!',
  18: "KIDDING!!&HERE'S MY&FINAL CHAOS!",
};
// the hold-turn rr picks (Step_0:178-199); rr 0/2 have an alt pair.
const HOLD = {
  0: ['A CHAOS,&CHAOS!', "PLEASE, IT'S&JUST A&SIMPLE&CHAOS."],
  1: ['I CAN DO&ANYTHING!!'],
  2: ['THIS BODY&CANNOT BE&KILLED!', 'THESE&CURTAINS&ARE REALLY&ON FIRE!'],
  3: ["IT'S ALL&TOO MUCH&FUN!!!"],
};

// Step_0:283-322 — the bottom flavor with its overrides.
const FLAVOR = [
  '* The world is spinning, spinning.',
  '* The air crackles with freedom.',
  '* JEVIL is laughing incomprehensibly.',
  '* It feels like a whirlwind.',
  '* Smells like chaos.',
];
const FLAVOR_EXHAUSTED = '* JEVIL seems exhausted...?';
const FLAVOR_J16 = '* CHAOS BOMB was prepared FOR YOU.';
const FLAVOR_J18 = '* Something terrible is coming...!';
const FLAVOR_J19 = "* JEVIL's pulling out all the stops!";
const FLAVOR_TIRED = '* JEVIL is truly exhausted!';

const M = { talkKey: null, talkReveal: 0, flavorFrame: -1 };

function talkText(line) {
  if (line == null) return null;
  if (line.jturn === 4 || line.jturn === 9 || line.jturn === 14 || line.jturn === 19) {
    if (line.rr === -1 || line.rr == null) return null;
    const opts = HOLD[line.rr] ?? HOLD[3];
    return opts[(line.alt ?? 0) % opts.length] ?? opts[0];
  }
  return TALK[line.jturn] ?? null;
}

function flavorText(f) {
  if (!f) return null;
  if (f.tired) return FLAVOR_TIRED;
  if (f.jturn >= 19) return FLAVOR_J19;
  if (f.jturn === 18) return FLAVOR_J18;
  if (f.jturn === 16) return FLAVOR_J16;
  if (f.dancelv === 2) return FLAVOR_EXHAUSTED;
  return FLAVOR[f.rr] ?? FLAVOR[0];
}

function blit(ctx, sprites, name, x, y) {
  const entry = sprites.get(name);
  const img = entry?.frames?.[0];
  if (img) ctx.drawImage(img, x - entry.meta.ox, y - entry.meta.oy, img.width * 2, img.height * 2);
}

export function drawBattleMsg(ctx, sprites, state, simAdvanced) {
  if (!state.joker) return;

  // ---- talk bubble (mnfight 1) ----
  if (state.mnfight === 1 && state.enemyLine) {
    const text = talkText(state.enemyLine);
    if (text) {
      const key = `${state.enemyLine.jturn}:${state.enemyLine.rr}:${state.enemyLine.alt ?? 0}`;
      if (M.talkKey !== key) {
        M.talkKey = key;
        M.talkReveal = 0;
      }
      if (simAdvanced) M.talkReveal += 1; // typer: 1 char/frame
      // scr_enemyblcon(x - 160, y - 20, 3): the CLUBS balloon, frame 1,
      // scale 1; the writer sits at balloon (x+5, y+5) (battleblcon
      // Create), typer-81 cadence: fixed 9px advance, ~16px lines.
      const bx = 500 - 160;
      const by = 160 - 20;
      const entry = sprites.get('spr_battleblcon_clubs');
      const img = entry?.frames?.[1];
      if (img) ctx.drawImage(img, bx - entry.meta.ox, by - entry.meta.oy);
      const lines = text.split('&');
      let shown = M.talkReveal;
      let y = by + 12;
      for (const line of lines) {
        if (shown <= 0) break;
        drawText(ctx, DOTUMCHE, line.slice(0, Math.max(0, shown)), bx + 12, y,
          { color: '#000000', advance: 9 });
        shown -= line.length;
        y += 16;
      }
    }
  } else if (state.mnfight !== 1) {
    M.talkKey = null;
  }

  // ---- bottom flavor (mnfight 2, while the soul dodges) ----
  if (state.mnfight === 2 && state.enemyFlavor) {
    const text = flavorText(state.enemyFlavor);
    if (text) {
      drawText(ctx, MAINBIG, text, 40, 375, { color: '#ffffff' });
    }
  }
}
