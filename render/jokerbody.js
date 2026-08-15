// obj_joker_body Draw_0, ported — the boss's live body.
//
//   float bob   : fly/flyx sines over floatsiner (lines 1-12)
//   condition 0 : dancelv sheets — 0 main / 1 dance (floatsiner/3) /
//                 2 tired / 3 the seven-shadow chaos dance / 4 pacified
//   condition 1 : the jack-in-the-box HURT SWING — spr_jokerbody base,
//                 spr_jokerchain links, spr_jokerhead on a decaying sine
//                 (armed by obj_joker Draw_0:3-11 with damage-scaled
//                 maxdist; read here from state.lastHurt)
//
// The shadow dance's repositioning uses random() — a PRESENTATION-channel
// draw in the original (counted by the recorder); here it is a local
// Math.random, never the gameplay stream. All sprites draw at 2x.

const B = {
  floatsiner: 0,
  dancesiner: 0,
  siner: 0,
  maxdist: 0,
  condition: 0,
  lastHurtFrame: -1,
  shadowx: [0, 0, 0, 0, 0, 0, 0],
  shadowy: [0, 0, 0, 0, 0, 0, 0],
  sfactor: [1, 1, 1, 1, 1, 1, 1],
};
const MAXCHAIN = 6;

function blit2(ctx, sprites, name, idx, x, y, alpha = 1) {
  const entry = sprites.get(name);
  if (!entry || !entry.frames.length) return;
  const img = entry.frames[Math.abs(Math.floor(idx)) % entry.frames.length];
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(img, x - entry.meta.ox * 2, y - entry.meta.oy * 2, img.width * 2, img.height * 2);
  ctx.restore();
}

export function drawJokerBody(ctx, sprites, state, e, simAdvanced) {
  const j = state.joker;
  if (!j) return;

  // arm the hurt swing when a new hit lands (obj_joker Draw_0:3-11).
  const lh = state.lastHurt;
  if (lh && lh.frame !== B.lastHurtFrame) {
    B.lastHurtFrame = lh.frame;
    B.condition = 1;
    B.siner = 0;
    B.maxdist += 20 + lh.amt / 5;
    if (B.maxdist < 30) B.maxdist = 30;
  }

  if (simAdvanced) B.floatsiner += 1; // floatsinerspeed 1
  const fly = Math.sin(B.floatsiner / 8) * 3;
  let flyx = 0;
  const dancelv = j.monsterstatus === 1 ? 2 : (j.dancelv ?? 0);
  if (dancelv >= 1) flyx = Math.cos(B.floatsiner / 8) * 3;

  const offx = e.x + 20;
  const offy = e.y + 18;

  if (B.condition === 0) {
    if (dancelv === 0) {
      blit2(ctx, sprites, 'spr_joker_main', 0, offx + flyx, offy + fly);
    } else if (dancelv === 1) {
      blit2(ctx, sprites, 'spr_joker_dance', B.floatsiner / 3, offx + flyx, offy + fly);
    } else if (dancelv === 2) {
      blit2(ctx, sprites, 'spr_joker_tired', 0, offx + flyx, offy + fly);
    } else if (dancelv === 3) {
      if (simAdvanced) B.dancesiner += 1;
      for (let i = 0; i < 7; i += 1) {
        if (i >= 1 && simAdvanced) {
          B.shadowx[i] += Math.sin(i + B.floatsiner / 5) * 8 * B.sfactor[i];
          B.shadowy[i] += Math.cos(i + B.floatsiner / 5) * 4 * B.sfactor[i];
        }
        const dalpha = Math.sin(i + B.dancesiner / 9);
        if (dalpha < 0 && i >= 1 && simAdvanced) {
          B.shadowx[i] = 60 - Math.random() * 120;
          B.shadowy[i] = 60 - Math.random() * 120;
          B.sfactor[i] = 1.5 - Math.random() * 3;
        }
        blit2(ctx, sprites, 'spr_joker_dance', B.dancesiner / 2 + i / 4,
          e.x + B.shadowx[i], e.y + B.shadowy[i], dalpha);
      }
    } else if (dancelv === 4) {
      blit2(ctx, sprites, 'spr_joker_teleport', 1, offx + flyx, offy + fly);
    }
    return;
  }

  if (B.condition === 1) {
    if (B.maxdist >= 150) B.maxdist = 150;
    let sinadd = 0.8 + B.maxdist / 50;
    if (sinadd < 0.8) sinadd = 0.8;
    if (sinadd > 2) sinadd = 2;
    if (simAdvanced) B.siner += sinadd;
    const sinx = Math.sin(B.siner / 4) * B.maxdist;
    const siny = -Math.abs(Math.sin(B.siner / 4)) * (B.maxdist * 0.7);
    let ji = 0;
    if (sinx > B.maxdist / 2 && B.maxdist > 15) ji = 1;
    if (sinx < -B.maxdist / 2 && B.maxdist > 15) ji = 2;
    if (B.maxdist < 4) ji = 3;
    for (let i = 0; i < MAXCHAIN - 1; i += 1) {
      blit2(ctx, sprites, 'spr_jokerchain', ji,
        offx + sinx * (i / MAXCHAIN) - 2,
        offy + 6 + (siny - 32) * (i / MAXCHAIN) + fly);
    }
    blit2(ctx, sprites, 'spr_jokerbody', 0, offx - 42, offy + fly - 2);
    blit2(ctx, sprites, 'spr_jokerhead', ji, offx + sinx - 2, offy + siny + fly - 14);
    if (simAdvanced) {
      B.maxdist -= 1;
      if (B.maxdist <= 0) {
        B.maxdist = 0;
        B.condition = 0;
      }
    }
  }
}
