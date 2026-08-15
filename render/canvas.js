// Canvas renderer. Reads sim state, never writes to it.
//
// FIRST-PASS ART POLICY (knight-sim precedent): every shape is drawn from
// the COLLISION MASKS the physics uses — what you see is exactly what you
// collide with, and no extracted sprites are distributed. Entities without
// a registered mask draw as outline markers. Sprite art can land later
// without touching sim/.

import { HEART_MASK, BATTLEBG_MASK, SPRITE_MASKS } from '../sim/masks.js';
import { spriteFor } from './sprites.js';
import { tinted } from './draw/gm.js';
import { drawBattleUI } from './battleui.js';
import { drawHero } from './heroes-draw.js';
import { drawJokerbg } from './jokerbg.js';
import { drawJokerBody } from './jokerbody.js';
import { drawBattleMsg } from './battlemsg.js';

const VIEW_W = 640;
const VIEW_H = 480;

// GML colour constants the sim stores as strings; draw_self multiplies.
// c_white multiplies to a no-op, so it maps to null.
const BLEND_NAMES = {
  c_white: null,
  c_gray: [128, 128, 128],
  c_ltgray: [192, 192, 192],
  c_red: [255, 0, 0],
  c_black: [0, 0, 0],
};

const maskCanvasCache = new Map();

/** Rasterize a mask's pixels once onto an offscreen canvas. */
function maskCanvas(mask, color) {
  const key = mask.name + '|' + color;
  let c = maskCanvasCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = mask.w;
    c.height = mask.h;
    const mctx = c.getContext('2d');
    mctx.fillStyle = color;
    for (let y = 0; y < mask.h; y++) {
      for (let x = 0; x < mask.w; x++) {
        if (mask.px[y][x]) mctx.fillRect(x, y, 1, 1);
      }
    }
    maskCanvasCache.set(key, c);
  }
  return c;
}

function drawMasked(ctx, mask, e, color) {
  const alpha = Math.max(0, Math.min(1, e.image_alpha ?? 1));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(e.x, e.y);
  ctx.rotate(-((e.image_angle ?? 0) * Math.PI) / 180);
  ctx.scale(e.image_xscale ?? 1, e.image_yscale ?? 1);
  ctx.drawImage(maskCanvas(mask, color), -mask.originX, -mask.originY);
  ctx.restore();
}

function colorFor(e) {
  if (e.active !== 1) return '#8a8a9a';
  if (e.image_blend === 'c_red') return '#ff4040';
  if (e.image_blend === 'c_gray') return '#8a8a9a';
  if (e.image_blend === 'c_ltgray') return '#c8c8d8';
  return '#ffffff';
}

export function createRenderer(canvas, sprites = null) {
  let darkAmt = 0;
  let lastSimFrame = -1;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /**
   * GameMaker's draw_self(): position at the instance origin, scale and
   * rotate about it, multiply by image_blend. Returns false when no sprite
   * art is available so the caller falls back to the mask/outline pass.
   */
  function blitSprite(e) {
    if (!sprites) return false;
    const entry = spriteFor(sprites, e);
    if (!entry || !entry.frames.length) return false;
    const alpha = Math.max(0, Math.min(1, e.image_alpha ?? 1));
    if (alpha <= 0) return true; // invisible IS drawn (as nothing)
    const idx = Math.abs(Math.floor(e.image_index ?? 0)) % entry.frames.length;
    const img = entry.frames[idx];
    if (!img) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(e.x, e.y);
    const ang = e.image_angle ?? 0;
    if (ang) ctx.rotate((-ang * Math.PI) / 180);
    ctx.scale(e.image_xscale ?? 1, e.image_yscale ?? 1);
    const blend = Array.isArray(e.image_blend) ? e.image_blend
      : (BLEND_NAMES[e.image_blend] ?? null);
    ctx.drawImage(blend ? tinted(img, blend) : img, -entry.meta.ox, -entry.meta.oy);
    ctx.restore();
    return true;
  }

  function draw(state) {
    // Renderer-local animations advance per SIM frame (30Hz), never per
    // rAF — a 60Hz monitor was running every presentation ramp (the
    // background spin, poses, mmy, TP chase) at double speed.
    const simAdvanced = state.frame !== lastSimFrame;
    lastSimFrame = state.frame;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // obj_jokerbg_triangle_real — the carousel background, behind all.
    if (sprites && state.joker) drawJokerbg(ctx, sprites, state, simAdvanced);

    // Depth: GameMaker draws high depth first. Sort a copy.
    const ents = state.entities
      .filter((e) => e.alive)
      .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

    // obj_darkener — created at enemy-turn entry, black at darkamt/20
    // ramping 1/frame to 15, fading back in menus; heroes/joker/bg sit
    // below it, the box/bullets/soul above.
    const darkTarget = (state.mnfight !== 0 || state.myfight === -1) ? 15 : 0;
    if (simAdvanced && darkAmt < darkTarget) darkAmt += 1;
    if (simAdvanced && darkAmt > darkTarget) darkAmt -= 1;

    const fieldPass = [];
    const abovePass = [];
    for (const e of ents) {
      const oi = e.type.objIndex ?? 0;
      if ((oi >= 213 && oi <= 215) || e.type.name === 'obj_joker') fieldPass.push(e);
      else abovePass.push(e);
    }

    for (const e of [...fieldPass, null, ...abovePass]) {
      if (e === null) {
        if (darkAmt > 0) {
          ctx.save();
          ctx.globalAlpha = darkAmt / 20;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
          ctx.restore();
        }
        continue;
      }
      const t = e.type.name;
      if (t === 'obj_growtangle') {
        // obj_growtangle Draw_0: frame 1 (the black interior) first, then
        // draw_self (frame 0, the tinted border).
        const drew = blitSprite({ ...e, type: e.type, image_index: 1 })
          && blitSprite({ ...e, type: e.type, image_index: 0 });
        if (!drew) drawMasked(ctx, BATTLEBG_MASK, e, '#39c556');
        continue;
      }
      if (t === 'obj_heart') continue; // soul drawn last, above everything
      // obj_joker_teleport has no custom Draw — the clone IS Jevil's
      // sprite growing in (xscale 0 -> 2); the generic blit handles it.
      if (t === 'obj_marker') {
        // FINAL CHAOS fade strips.
        const a = Math.max(0, Math.min(1, e.image_alpha ?? 0));
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = e.image_blend === 'c_black' ? '#000' : '#fff';
          const w = 2 * (e.image_xscale ?? 1);
          const h = 240 * (e.image_yscale ?? 1);
          ctx.fillRect(e.x - w / 2, e.y, w, h);
          ctx.restore();
        }
        continue;
      }
      if (e.type.name === 'obj_joker') {
        drawJokerBody(ctx, sprites ?? new Map(), state, e, simAdvanced);
        continue;
      }
      if (e.type.objIndex >= 213 && e.type.objIndex <= 215 && state.party) {
        drawHero(e, state, (name, idx, x, y) => {
          const entry = sprites?.get(name);
          if (!entry || !entry.frames.length) return;
          const img = entry.frames[Math.abs(Math.floor(idx)) % entry.frames.length];
          // draw_sprite_ext(..., 2, 2, ...) — battle heroes are 2x
          // (obj_heroparent Draw_0:239), scaled about the origin.
          if (img) ctx.drawImage(img, x - entry.meta.ox * 2, y - entry.meta.oy * 2, img.width * 2, img.height * 2);
        }, simAdvanced);
        continue;
      }
      if (blitSprite(e)) continue;
      const mask = SPRITE_MASKS[e.mask_index ?? e.sprite_index];
      if (mask) {
        drawMasked(ctx, mask, e, colorFor(e));
      } else if (e.isBullet) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, e.image_alpha ?? 1));
        ctx.strokeStyle = '#ffd23c';
        ctx.strokeRect(e.x - 6, e.y - 6, 12, 12);
        ctx.restore();
      }
    }

    // Battle UI (band, charboxes, TP bar, damage numbers) — fight scenes
    // only (they carry a party); practice scenes have no party object.
    if (state.party) drawBattleUI(ctx, sprites, state, simAdvanced);

    // The soul: spr_dodgeheart when the pack is loaded (i-frame flicker via
    // alpha, as the game's image_speed strobe reads), mask fallback.
    if (state.soul && state.soul.alive) {
      const inv = state.invTimer > 0;
      const flicker = inv && state.frame % 4 < 2;
      const soulE = {
        ...pick(state.soul),
        image_angle: 0,
        sprite_index: 'spr_dodgeheart',
        image_index: 0,
        image_alpha: flicker ? 0.45 : 1,
        type: { name: 'obj_heart' },
      };
      if (!blitSprite(soulE)) {
        drawMasked(ctx, HEART_MASK, { ...pick(state.soul), image_angle: 0 }, flicker ? '#7a1020' : '#ff2040');
      }
    }
  }

  function pick(s) {
    return { x: s.x, y: s.y, image_xscale: 1, image_yscale: 1, image_alpha: 1 };
  }

  return { ctx, draw };
}
