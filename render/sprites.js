// Sprite loading for the renderer — jevil edition.
//
// Art is extracted from the player's own chapter 1 data into assets/sprites
// (jevil-research tools/patches/extract_sprite.csx with padding, then
// tools/pack-sprites.mjs — which runs the PNG-dims == manifest-dims check).
//
// manifest.json carries what the PNGs cannot: GameMaker's per-sprite ORIGIN.
// Every draw is positioned relative to it, so without these the art lands
// offset from where the physics is — the classic sprite/hitbox mismatch this
// project exists to avoid.

const BASE = '../assets/sprites/';

/**
 * Object type name -> sprite name, for entities whose sim type doesn't set
 * sprite_index itself (most bullets do; these are the visual-only bodies).
 * An entity's own `sprite_index` always wins.
 */
export const SPRITE_FOR = {
  obj_heart: 'spr_dodgeheart',
  obj_growtangle: 'spr_battlebg_0',
  obj_joker: 'spr_joker_main',
  obj_herokris: 'spr_krisb_idle',
  obj_herosusie: 'spr_susieb_idle',
  obj_heroralsei: 'spr_ralseib_idle',
  obj_laserscythe: 'spr_joker_scythebody',
  obj_joker_teleport: 'spr_joker_teleport',
};

/**
 * Mask sprites stand in for their draw sprites when an entity carries only
 * the mask name (collision aliases) — drawn art should use the real sheet.
 */
export const DRAW_ALIAS = {
  spr_dodgeheartmask: 'spr_dodgeheart',
  spr_joker_scythebody_mask: 'spr_joker_scythebody',
  spr_battlebg_stretch_hitbox: 'spr_battlebg_0',
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // A missing frame must not wedge startup; the renderer falls back to the
    // collision-mask drawing for anything that fails.
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Load the manifest and every frame it lists.
 * @returns {Promise<Map<string, {meta: object, frames: HTMLImageElement[]}>>}
 */
export async function loadSprites(base = BASE) {
  const res = await fetch(base + 'manifest.json');
  if (!res.ok) throw new Error(`sprite manifest not found at ${base}manifest.json`);
  const manifest = await res.json();

  const out = new Map();
  const jobs = Object.entries(manifest).map(async ([name, meta]) => {
    const frames = await Promise.all(meta.files.map((f) => loadImage(base + f)));
    out.set(name, { meta, frames: frames.filter(Boolean) });
  });
  await Promise.all(jobs);
  return out;
}

/** Resolve the sprite record an entity should draw with, or null. */
export function spriteFor(sprites, e) {
  let name = e.sprite_index ?? SPRITE_FOR[e.type?.name];
  if (!name) return null;
  name = DRAW_ALIAS[name] ?? name;
  return sprites.get(name) ?? null;
}
