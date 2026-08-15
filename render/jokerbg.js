// The fight's background — obj_jokerbg_triangle_real, ported line-for-line.
//
//   Create   : palette (dkblue/dkblue2/dkblue3), xcen 320 / ycen 240,
//              radius 360, trimax 8
//   Draw_0   : two passes of perspective-scaled spr_carouselbg column
//              strips (5px source columns, scale 1 + 0.5i), then FOUR
//              triangle fans (the carousel wheel: main, far top spokes /6,
//              near top spokes /4 dropped 380, upper ring dropped 320),
//              then the scroll/rot advance
//   Other_10 : vertex math — ellipse (radius, radius/2), top squash 0.6,
//              alternating fill colours per spoke
//
// `on` ramps bgalpha 0 -> 1 at 0.02/frame and spins rotspeed up at
// 0.1/frame; the joker's hurt reaction raises rotspeed with lost HP
// (Draw_0: rotspeed = 1 + (1.5 - mhpratio*1.5) — read live from state).

const P = {
  siner: 0, rot: 0, bgx: 0, rotcounter: 0, rotfps: 1, rotspeed: 0,
  bgalpha: 0, on: 1,
};

// merge_color chains from Create (c_navy 0x800000 BGR -> rgb(0,0,128)).
const DKBLUE = 'rgb(6,10,122)';   // merge(navy, dkgray, 0.1)
const DKBLUE2 = 'rgb(32,52,96)';  // merge(navy, dkgray, 0.5)
const DKBLUE3 = [26, 42, 77];     // merge(merge(navy, dkgray, .5), black, .2)

const ldx = (len, deg) => len * Math.cos((deg * Math.PI) / 180);
const ldy = (len, deg) => -len * Math.sin((deg * Math.PI) / 180);

const tintCache = new Map();
function tintedBg(img, rgb) {
  const key = rgb.join(',');
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    // explicit per-pixel multiply — draw_sprite_part_ext's colour arg.
    // (The 'multiply' composite path rendered the texture nearly raw in
    // the pane's canvas; ImageData never lies.)
    const d = g.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = (px[i] * rgb[0]) / 255;
      px[i + 1] = (px[i + 1] * rgb[1]) / 255;
      px[i + 2] = (px[i + 2] * rgb[2]) / 255;
    }
    g.putImageData(d, 0, 0);
    tintCache.set(key, c);
  }
  return c;
}

export function resetJokerbg() {
  Object.assign(P, { siner: 0, rot: 0, bgx: 0, rotcounter: 0, rotspeed: 0, bgalpha: 0, on: 1 });
}

export function drawJokerbg(ctx, sprites, state, simAdvanced = true) {
  const entry = sprites?.get('spr_carouselbg');
  const img = entry?.frames?.[0];
  const trimax = 8;
  const xcen = 320;
  const ycen = 240;
  const radius = 360;

  if (simAdvanced) {
    if (P.on === 1 && P.bgalpha < 1) P.bgalpha += 0.02;
    if (P.on === 0 && P.bgalpha > 0) P.bgalpha -= 0.02;
  }
  if (P.bgx >= 640) P.bgx -= 640;

  // ---- carouselbg column strips, two perspective passes ----
  if (img && P.bgalpha > 0) {
    const t = tintedBg(img, DKBLUE3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, P.bgalpha);
    let curx = 0;
    let curl = P.bgx | 0;
    let curscale = 1;
    for (let i = 0; i < 16; i += 1) {
      ctx.drawImage(t, curl, 0, 5, Math.min(300, img.height), curx, -i, 5 * curscale, 300);
      curscale = Math.floor(1 + 0.5 * i);
      curl += 5;
      if (curl >= 640) curl -= 640;
      curx += 5 * curscale - 5;
    }
    for (let i = 16; i > 0; i -= 1) {
      ctx.drawImage(t, curl, 0, 5, Math.min(380, img.height), curx, -i, 5 * curscale, 380);
      let tempscale = 1 + 0.5 * i;
      if (tempscale < 1) tempscale = 1;
      curscale = Math.ceil(tempscale);
      curl += 5;
      if (curl >= 640) curl -= 640;
      curx += 5 * curscale - 5;
    }
    ctx.restore();
  }

  // ---- the carousel wheel: four triangle fans (Other_10 vertices) ----
  if (P.bgalpha > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, P.bgalpha);
    let blackon = 0;
    const vertex = (i) => {
      let ny1 = ldy(radius / 2, P.rot + (360 / trimax) * i);
      let ny2 = ldy(radius / 2, P.rot + (360 / trimax) * (i + 1));
      if (ny1 <= 0) ny1 *= 0.6;
      if (ny2 <= 0) ny2 *= 0.6;
      const color = blackon === 0 ? DKBLUE : DKBLUE2;
      blackon = blackon === 0 ? 1 : 0;
      return {
        nx1: ldx(radius, P.rot + (360 / trimax) * i),
        nx2: ldx(radius, P.rot + (360 / trimax) * (i + 1)),
        ny1, ny2, color,
      };
    };
    const tri = (x1, y1, x2, y2, x3, y3, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
    };
    for (let i = 0; i < trimax; i += 1) {
      const v = vertex(i);
      tri(xcen, ycen, xcen + v.nx1, ycen + v.ny1, xcen + v.nx2, ycen + v.ny2, v.color);
    }
    for (let i = 0; i < 8; i += 1) {
      const v = vertex(i);
      if ((v.ny1 > 0 || v.ny2 > 0) && v.nx2 > v.nx1 - 48) {
        tri(xcen, ycen - 80, xcen + v.nx1 / 6, ycen + v.ny1 / 6, xcen + v.nx2 / 6, ycen + v.ny2 / 6, v.color);
      }
    }
    for (let i = 8; i >= 0; i -= 1) {
      const v = vertex(i);
      if (v.ny1 > 0 || v.ny2 > 0) {
        tri(xcen, ycen - 80, xcen + v.nx1 / 4, ycen + v.ny1 - 380, xcen + v.nx2 / 4, ycen + v.ny2 - 380, v.color);
      }
    }
    for (let i = 0; i < trimax; i += 1) {
      const v = vertex(i);
      tri(xcen, ycen - 320, xcen + v.nx1, ycen + v.ny1 - 320, xcen + v.nx2, ycen + v.ny2 - 320, v.color);
    }
    ctx.restore();
  }

  // ---- scroll/rot advance (Draw_0 tail) — 30Hz, once per sim frame ----
  if (!simAdvanced) return;
  P.siner += 2;
  if (P.on === 1) P.rotcounter += 1;
  if (P.rotcounter >= P.rotfps && P.on === 1) {
    // the hurt reaction raises the spin with lost HP (obj_joker Draw).
    const j = state.joker;
    const target = j ? 1 + (1.5 - Math.max(0, j.hp / j.maxhp) * 1.5) : 1;
    if (P.rotspeed < target) P.rotspeed += 0.1;
    P.bgx += 1 * P.rotfps;
    P.rot += 2.5 * P.rotfps * P.rotspeed;
    P.rotcounter = 0;
  }
}
