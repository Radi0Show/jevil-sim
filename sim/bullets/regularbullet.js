// obj_regularbullet — chapter 1's standard bullet, and its _permanent child.
//
//   Create : gml_Object_obj_regularbullet_Create_0   (defaults + suicide
//            when no heart exists)
//   Step   : gml_Object_obj_regularbullet_Step_0     (wall_destroy: leaves
//            view+40 margin -> instance_destroy)
//   Other_15 (inherited from obj_collidebullet): damage + destroy.
//   obj_regularbullet_permanent overrides Other_15 WITHOUT the destroy —
//   permanent bullets damage repeatedly (gated by inv upstream).
//
// Parent chain: obj_bulletparent -> obj_collidebullet -> obj_regularbullet
// -> obj_regularbullet_permanent.

import { destroy } from '../entity.js';

function regularCreate(e, state) {
  e.isBullet = true;
  e.builtinMotion = true;
  e.grazed = 0;
  e.grazepoints = 5;
  e.timepoints = 5;
  e.target = 0;
  e.dont = 1;
  e.inv = 60;
  e.damage = 124;
  e.active = 1;
  e.spec = 0;
  e.image_alpha = 1;
  if (!state.soul || !state.soul.alive) {
    destroy(e);
  }
  e.wall_destroy = 1;
}

function regularStep(e, state) {
  if (e.wall_destroy === 1) {
    if (e.x < state.view.x - 40) destroy(e);
    if (e.x > state.view.x + 680) destroy(e);
    if (e.y < state.view.y - 40) destroy(e);
    if (e.y > state.view.y + 520) destroy(e);
  }
}

export const regularbullet = {
  name: 'obj_regularbullet',
  create: regularCreate,
  step: regularStep,

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      throw new Error('chapter 1 damage path not yet translated');
    }
    destroy(b);
  },
};

export const regularbulletPermanent = {
  name: 'obj_regularbullet_permanent',
  create: regularCreate,
  step: regularStep,

  other15(b, state) {
    if (b.active !== 1) return;
    if (state.damageEnabled) {
      throw new Error('chapter 1 damage path not yet translated');
    }
    // No destroy — permanent.
  },
};
