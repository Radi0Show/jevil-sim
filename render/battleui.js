// Chapter 1 battle UI — ported from the GML draw code, steady-state only.
//
//   scr_charbox           the three hero boxes: buttons, head, nameplate,
//                         HP readout (spr_numbersfontsmall) and HP bar
//   obj_battlecontroller  Draw_0:49-55 — the bottom band and rails
//   obj_tensionbar        Draw_0 — the TP bar with apparent/current chase
//
// Approximations, LABELLED:
//   - bp is pinned at bpy (152): the intro slide of the band is not run
//     (the fight scenes start mid-battle).
//   - Menu strings are the fight's own (JEVIL, act/spell names) resolved
//     through lang_en.json at port time; monstercomment is omitted.
//   - faceaction (head expressions) stays 0 outside hurt frames; the
//     sim does not carry the faceaction presentation variable.
//   - scr_selectionmatrix's breathing side-lines are reduced to its top
//     strip; the sine sweep is cosmetic and stays renderer-local.

import { loadFont, drawText, textWidth } from './font.js';

const BPY = 152;
const FNT = loadFont('../assets/fonts', 'fnt_mainbig');

// Fight-static display strings (scr_monstersetup type 20 + scr_spellinfo,
// resolved through the game's own lang_en.json).
const MONSTER_NAME = 'JEVIL';
const ACT_NAMES = ['Check', 'Pirouette', 'Hypnosis'];
const ACT_COSTS = [0, 50, 125];
const SPELL_NAMES = { 2: 'Heal Prayer', 3: 'Pacify' };
const AQUA_BLUE = 'rgb(0,179,255)'; // merge(c_aqua, c_blue, 0.3)
const HP_COLORS = ['#00ffff', '#ff00ff', '#00ff00']; // c_aqua, c_fuchsia, c_lime
// merge(merge(c_purple, c_black, 0.7), c_dkgray, 0.5) from bc's Create.
const BCOLOR = 'rgb(45,19,45)';

const state2 = {
  mmy: [0, 0, 0],
  tpApparent: null,
  tpCurrent: null,
  tpChangetimer: 15,
  sSiner: 0,
  dmgSeen: 0,
  dmgLive: [], // {x, y, damage, type, born}
};

function frameOf(sprites, name, idx) {
  const e = sprites.get(name);
  if (!e || !e.frames.length) return null;
  return { img: e.frames[Math.abs(Math.floor(idx)) % e.frames.length], meta: e.meta };
}

function blit(ctx, sprites, name, idx, x, y, alpha = 1) {
  const f = frameOf(sprites, name, idx);
  if (!f || !f.img) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(f.img, x - f.meta.ox, y - f.meta.oy);
  ctx.restore();
}

/** hpfont: font_add_sprite_ext(spr_numbersfontsmall, "0123456789-+", 0, 2) */
const HP_CHARS = '0123456789-+';
function drawHpNumber(ctx, sprites, text, xRight, yTop) {
  const entry = sprites.get('spr_numbersfontsmall');
  if (!entry) return;
  const sep = 2;
  const w = entry.meta.w;
  let x = xRight - String(text).length * (w + sep);
  for (const ch of String(text)) {
    const idx = HP_CHARS.indexOf(ch);
    if (idx >= 0 && entry.frames[idx]) ctx.drawImage(entry.frames[idx], x, yTop);
    x += w + sep;
  }
}

/** damagefont: font_add_sprite_ext(spr_numbersfontbig, "0123456789", 20, 0) */
function drawDmgNumber(ctx, sprites, text, xCenter, yTop, alpha) {
  const entry = sprites.get('spr_numbersfontbig');
  if (!entry) return;
  const w = 20;
  const s = String(text);
  let x = xCenter - (s.length * w) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const ch of s) {
    const idx = '0123456789'.indexOf(ch);
    if (idx >= 0 && entry.frames[idx]) ctx.drawImage(entry.frames[idx], x, yTop);
    x += w;
  }
  ctx.restore();
}

export function drawBattleUI(ctx, sprites, state, simAdvanced = true) {
  if (!sprites) return;
  const bp = BPY;
  const p = state.party;
  if (!p) return;

  // ---- bottom band (bc Draw_0:49-55) ----
  ctx.fillStyle = '#000';
  ctx.fillRect(-10, 480 - bp, 710, 481 - (480 - bp));
  ctx.fillStyle = BCOLOR;
  ctx.fillRect(-10, 480 - bp - 2, 710, 2);
  ctx.fillRect(-10, 480 - bp + 34, 710, 2);

  const inMenu = state.myfight === 0 && state.mnfight === 0;

  // ---- the three charboxes (scr_charbox) ----
  for (let c = 0; c < 3; c += 1) {
    const xchunk = [0, 212, 424][c];
    const selected = state.charturn === c && inMenu;

    // mmy rise ramp (charbox lines 50-77), renderer-local, 30Hz.
    const m = state2.mmy;
    if (!simAdvanced) {
      // hold — ramps advance once per sim frame
    } else if (selected) {
      if (m[c] > -32) m[c] -= 2;
      if (m[c] > -24) m[c] -= 4;
      if (m[c] > -16) m[c] -= 6;
      if (m[c] > -8) m[c] -= 8;
      if (m[c] < -32) m[c] = -64;
    } else if (m[c] < -14) {
      m[c] += 15;
    } else {
      m[c] = 0;
    }
    const mmy = m[c];
    const charcolor = HP_COLORS[c];

    // selectionmatrix top strip (approximation, see header).
    if (selected) {
      state2.sSiner += 2;
      ctx.fillStyle = charcolor;
      ctx.fillRect(xchunk, 480 - bp, 210, 3);
    }

    // GML DRAW ORDER (scr_charbox:80-150): the buttons draw FIRST, at a
    // FIXED y (485 - bp, no mmy) — then the box outline and the black
    // inner fill draw OVER them. An unrisen box hides its buttons behind
    // the fill; the rise (mmy) lifts the fill away and reveals them.
    // Drawing buttons last/moving made every box show its buttons over
    // the head row — the "menus stacked on each other" mess.
    const btc = [0, 0, 0, 0, 0];
    if (selected && state.bmenuno === 0) {
      btc[state.bmenucoord0?.[c] ?? 0] = 1;
    }
    const by = 485 - bp;
    blit(ctx, sprites, 'spr_btfight', btc[0], xchunk + 15, by);
    blit(ctx, sprites, c === 0 ? 'spr_btact' : 'spr_bttech', btc[1], xchunk + 50, by);
    blit(ctx, sprites, 'spr_btitem', btc[2], xchunk + 85, by);
    blit(ctx, sprites, 'spr_btspare', btc[3], xchunk + 120, by);
    blit(ctx, sprites, 'spr_btdefend', btc[4], xchunk + 155, by);
    // Pacify glow on Ralsei's MAGIC button when the boss is TIRED.
    if (c === 2 && selected && state.joker?.monsterstatus === 1 && state.tension >= 40) {
      const a = 0.4 + Math.sin(state.frame / 6) * 0.4;
      blit(ctx, sprites, 'spr_bttech', 1, xchunk + 50, by, Math.max(0, a));
    }

    // box outline + black fill AFTER the buttons (they cover them).
    ctx.fillStyle = selected ? charcolor : BCOLOR;
    ctx.fillRect(xchunk, 480 - bp - 2 + mmy, 212, (480 - bp) - (480 - bp - 2 + mmy) + 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(xchunk + 2, 480 - bp + mmy, 208, 33);

    // head + nameplate + HP block (b_offset 336, fighting == 1)
    const bo = 336 + mmy;
    const head = ['spr_headkris', 'spr_headsusie', 'spr_headralsei'][c];
    const bname = ['spr_bnamekris', 'spr_bnamesusie', 'spr_bnameralsei'][c];
    blit(ctx, sprites, head, 0, 13 + xchunk, bo);
    blit(ctx, sprites, bname, 0, 51 + xchunk, bo + 3);
    blit(ctx, sprites, 'spr_hpname', 0, 109 + xchunk, bo + 11);

    const hp = p.hp[p.char[c]];
    const maxhp = p.maxhp[p.char[c]];
    drawHpNumber(ctx, sprites, hp, 160 + xchunk, bo - 2);
    blit(ctx, sprites, 'spr_hpslash', 0, 159 + xchunk, bo - 4);
    drawHpNumber(ctx, sprites, maxhp, 205 + xchunk, bo - 2);

    ctx.fillStyle = '#800000'; // c_maroon
    ctx.fillRect(128 + xchunk, bo + 11, 75, 8);
    if (hp > 0 && maxhp > 0) {
      ctx.fillStyle = charcolor;
      ctx.fillRect(128 + xchunk, bo + 11, Math.ceil((hp / maxhp) * 75), 8);
    }
  }

  // ---- tension bar (obj_tensionbar Draw_0; rest position x=51, y=40) ----
  {
    const x = 51;
    const y = 40;
    const H = 196;
    const W = 25;
    if (state2.tpApparent === null) {
      state2.tpApparent = state.tension ?? 0;
      state2.tpCurrent = state.tension ?? 0;
    }
    let ap = state2.tpApparent;
    let cur = state2.tpCurrent;
    const t = state.tension ?? 0;
    if (!simAdvanced) { ap = state2.tpApparent; cur = state2.tpCurrent; }
    else if (Math.abs(ap - t) < 20) ap = t;
    if (simAdvanced && ap < t) ap += 20;
    if (simAdvanced && ap > t) ap -= 20;
    if (simAdvanced && ap !== cur) {
      state2.tpChangetimer += 1;
      if (state2.tpChangetimer > 15) {
        const d = ap - cur;
        if (d > 0) cur += 2;
        if (d > 10) cur += 2;
        if (d > 25) cur += 3;
        if (d > 50) cur += 4;
        if (d > 100) cur += 5;
        if (d < 0) cur -= 2;
        if (d < -10) cur -= 2;
        if (d < -25) cur -= 3;
        if (d < -50) cur -= 4;
        if (d < -100) cur -= 5;
        if (Math.abs(ap - cur) < 3) cur = ap;
      }
    } else {
      state2.tpChangetimer = 15;
    }
    state2.tpApparent = ap;
    state2.tpCurrent = cur;

    const maxt = 250;
    blit(ctx, sprites, 'spr_tplogo', 0, x - 30, y + 30);
    blit(ctx, sprites, 'spr_tensionbar', 1, x, y);
    const maxed = Math.floor((ap / maxt) * 100) >= 100;
    const fill = (v, color) => {
      const top = y + H - (v / maxt) * H;
      ctx.fillStyle = color;
      ctx.fillRect(x + 3, top, W - 4, y + H - 1 - top);
    };
    if (cur > 0 || ap > 0) {
      if (ap < cur) {
        fill(cur, '#ff0000');
        fill(ap, '#ffa000');
      } else if (ap > cur) {
        fill(ap, '#ffffff');
        fill(cur, maxed ? '#ffd000' : '#ffa000');
      } else {
        fill(cur, maxed ? '#ffd000' : '#ffa000');
      }
    }
    if (ap > 20 && ap < maxt) {
      blit(ctx, sprites, 'spr_tensionmarker', 0, x + 3, y + H - (cur / maxt) * H);
    }
    blit(ctx, sprites, 'spr_tensionbar', 0, x, y);
    // TP percent (mainbig, per obj_tensionbar Draw_0:9-20).
    const tamt = Math.floor((ap / maxt) * 100);
    if (tamt < 100) {
      drawText(ctx, FNT, String(tamt), x - 30, y + 70, { color: '#ffffff' });
      drawText(ctx, FNT, '%', x - 25, y + 95, { color: '#ffffff' });
    } else {
      drawText(ctx, FNT, 'M', x - 28, y + 70, { color: '#ffff00' });
      drawText(ctx, FNT, 'A', x - 24, y + 90, { color: '#ffff00' });
      drawText(ctx, FNT, 'X', x - 20, y + 110, { color: '#ffff00' });
    }
  }

  // ---- menu text lists (bc Draw_0:57-330, mainbig) ----
  if (inMenu) {
    const bm = state.bmenuno;
    // monster target list (bmenuno 1 FIGHT / 3 spell target / 11 ACT target)
    if (bm === 1 || bm === 3 || bm === 11) {
      blit(ctx, sprites, 'spr_heart', 0, 55, 385); // one monster: coord 0
      const tired = state.joker?.monsterstatus === 1;
      const nameColor = tired ? AQUA_BLUE : '#ffffff';
      drawText(ctx, FNT, MONSTER_NAME, 80, 375, { color: nameColor });
      const nw = textWidth(FNT, MONSTER_NAME);
      if (tired) blit(ctx, sprites, 'spr_tiredmark', 0, 80 + nw + 40, 385);
      ctx.fillStyle = '#800000';
      ctx.fillRect(510, 380, 80, 15);
      const jr = state.joker ? state.joker.hp / state.joker.maxhp : 1;
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(510, 380, Math.max(0, jr) * 80, 15);
    }
    // ACT list (bmenuno 9): two-column layout, gray when TP < cost.
    if (bm === 9) {
      const coord = state.bmenucoord9?.[state.charturn] ?? 0;
      const icx = (coord % 2 === 1) ? 240 : 10;
      const icy = 385 + Math.floor(coord / 2) * 30;
      blit(ctx, sprites, 'spr_heart', 0, icx, icy);
      for (let i = 0; i < ACT_NAMES.length; i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const affordable = state.tension >= ACT_COSTS[i];
        drawText(ctx, FNT, ACT_NAMES[i], col ? 260 : 30, 375 + row * 30,
          { color: affordable ? '#ffffff' : '#808080' });
      }
    }
    // spell list (bmenuno 2): Ralsei's slots; Pacify glows aqua on TIRED.
    if (bm === 2) {
      const coord = state.bmenucoord2?.[state.charturn] ?? 0;
      const icx = (coord % 2 === 1) ? 230 : 10;
      const icy = 385 + Math.floor(coord / 2) * 30;
      blit(ctx, sprites, 'spr_heart', 0, icx, icy);
      const spells = p.char[state.charturn] === 3 ? [3, 2] : [2];
      const costs = { 3: 40, 2: 32 };
      for (let i = 0; i < spells.length; i += 1) {
        const id = spells[i];
        let color = '#ffffff';
        if (state.tension < costs[id]) color = '#808080';
        else if (id === 3 && state.joker?.monsterstatus === 1) color = AQUA_BLUE;
        drawText(ctx, FNT, SPELL_NAMES[id], (i % 2) ? 260 : 30, 375 + Math.floor(i / 2) * 30, { color });
      }
      const selId = spells[coord] ?? spells[0];
      const pct = Math.round(((costs[selId] ?? 0) / 250) * 100);
      drawText(ctx, FNT, `${pct}% TP`, 500, 440, { color: '#ffa000' });
    }
  }

  // ---- attack bar (obj_attackpress Draw_0, one-button flag[13]=0) ----
  {
    const ap = state.entities.find((o) => o.alive && o.type.name === 'obj_attackpress');
    if (ap && ap.active === 1 && ap.bolttotal !== undefined) {
      const x = ap.x;
      const y = ap.y;
      const boltspeed = 8; // attackpress Create:141
      const CHAR_COLOR = { 1: '#0000ff', 2: '#a020f0', 3: '#00a000' };
      for (let i = 0; i < 3; i += 1) {
        if (i === 1 || i === 2) {
          ctx.fillStyle = BCOLOR;
          ctx.fillRect(x, y + 38 * i, 300, 2);
        }
        if (!ap.havechar || ap.havechar[i] !== 1) continue;
        const j = p.char[i];
        ctx.strokeStyle = CHAR_COLOR[j] ?? '#ffffff';
        ctx.strokeRect(x + 78.5, y + 38 * i + 0.5, 2 + 15 * boltspeed, 36);
        ctx.strokeRect(x + 79.5, y + 38 * i + 1.5, 15 * boltspeed, 34);
        blit(ctx, sprites, 'spr_pressfront', j - 1, x, y + 38 * i);
        blit(ctx, sprites, 'spr_pressfront_b', 0, x, y + 38 * i);
        blit(ctx, sprites, 'spr_pressspot', j - 1, x + 80, y + 38 * i);
      }
      for (let i = 0; i < ap.bolttotal; i += 1) {
        if (ap.boltalive?.[i] !== 1) continue;
        const rel = ap.boltframe[i] - ap.boltx;
        let alpha = 1;
        if (rel < 0) alpha = 1 + rel / 3;
        if (alpha <= 0) continue;
        blit(ctx, sprites, 'spr_attackspot', 0,
          x + 80 + rel * boltspeed, y + 38 * ap.boltchar[i], alpha);
      }
    }
  }

  // ---- damage numbers (obj_dmgwriter, renderer-side lifetimes) ----
  {
    const nums = state.dmgNumbers ?? [];
    while (state2.dmgSeen < nums.length) {
      const n = nums[state2.dmgSeen];
      state2.dmgSeen += 1;
      // party hits float over the hurt hero's charbox; type 3 heals green.
      const xc = [106, 318, 530][n.slot] ?? 320;
      state2.dmgLive.push({ ...n, x: xc, y: 300, born: state.frame });
    }
    state2.dmgLive = state2.dmgLive.filter((n) => state.frame - n.born < 40);
    for (const n of state2.dmgLive) {
      const age = state.frame - n.born;
      const rise = Math.min(age * 2, 16);
      const alpha = age < 30 ? 1 : 1 - (age - 30) / 10;
      drawDmgNumber(ctx, sprites, n.damage, n.x, n.y - rise, alpha);
    }
  }
}

/** Reset renderer-local UI state (scene rebuilds). */
export function resetBattleUI() {
  state2.mmy = [0, 0, 0];
  state2.tpApparent = null;
  state2.tpCurrent = null;
  state2.tpChangetimer = 15;
  state2.dmgSeen = 0;
  state2.dmgLive = [];
}
