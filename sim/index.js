// Public surface of sim/.
//
// Rule: nothing in this directory touches the DOM, a canvas, a timer, the
// keyboard, or the filesystem. It is a pure function of (state, input) that
// advances exactly one frame. That is what makes verification a plain Node
// script instead of a browser session with a human watching.
//
// Chapter 1 (Jevil) edition of knight-sim's engine core. The phase order,
// motion model, animation timing and collision framework are carried over
// verbatim — they are engine facts measured against the real runner
// (PLAYBOOK §4). Chapter-3 game systems (tension, party damage, heroes...)
// are NOT carried; each chapter-1 system lands with its own translation.

import { runPhase, runAlarms, reap } from './entity.js';
import { traceRow } from './trace.js';
import { spriteMaskHit } from './masks.js';
import { grazeBullet } from './graze.js';
import { gmlRandom } from './rng.js';

export { createState } from './state.js';
export { spawn, destroy, ALARM_COUNT } from './entity.js';
export { traceHeader, traceRow, real, int } from './trace.js';
export { createRng, rngNext, rngRandom, rngIrandom, rngRange, rngChoose, rngSnapshot, rngRestore } from './rng.js';
export { FPS, MS_PER_FRAME, drain } from './clock.js';

/**
 * Phase order for one frame. Rule 5 — this is the whole point of the module.
 *
 * GameMaker's order is Begin Step, then Alarms, then Step, then Collision
 * events, then End Step. Collapsing any two of these, or turning an alarm
 * into a countdown checked inside Step, moves behaviour by exactly one frame.
 */
export const PHASES = ['animation', 'beginStep', 'alarm', 'step', 'motion', 'collision', 'endStep'];

/**
 * GameMaker's built-in motion, applied between the Step event and Collision
 * events. Entities opt in with `builtinMotion: true` and plain `speed` /
 * `direction` fields (degrees, CCW on screen), or `componentMotion: true`
 * with hspeed/vspeed.
 *
 * FRICTION reduces speed MAGNITUDE and clamps at zero on crossing — so a
 * NEGATIVE friction accelerates (knight-sim verified this against the
 * runner; Jevil's bigscythe uses friction -0.25 the same way).
 *
 * GRAVITY: friction on the magnitude first, then the gravity vector added to
 * hspeed/vspeed, then move — gravity changes DIRECTION as well as speed
 * (obj_spadering's spades need this).
 *
 * FLOAT32: every built-in field narrows on store (entity.js F32_BUILTINS,
 * measured by knight-research's oracle_f32_probe — same runner family;
 * re-confirm with a chapter 1 probe before the first fractional-speed suite).
 */
function runMotion(state) {
  state.eventPhase = 'motion';
  for (const e of state.entities) {
    if (!e.alive) continue;

    // COMPONENT MOTION. GameMaker's real state is hspeed/vspeed; speed and
    // direction are derived views of them.
    if (e.componentMotion) {
      // GRAVITY applies to components too (obj_dbullet_vert: direct vspeed
      // writes + gravity along the default 270). Same vector formula as the
      // speed/direction branch below.
      if (e.gravity) {
        const gr = (e.gravity_direction * Math.PI) / 180;
        e.hspeed = (e.hspeed ?? 0) + e.gravity * Math.cos(gr);
        e.vspeed = (e.vspeed ?? 0) - e.gravity * Math.sin(gr);
      }
      if (!e.hspeed && !e.vspeed) continue;
      state.counters.motionSteps += 1;
      e.x = e.x + e.hspeed;
      e.y = e.y + e.vspeed;
      e.speed = Math.sqrt(e.hspeed * e.hspeed + e.vspeed * e.vspeed);
      let dir = (Math.atan2(-e.vspeed, e.hspeed) * 180) / Math.PI;
      if (dir < 0) dir += 360;
      e.direction = dir;
      continue;
    }

    if (!e.builtinMotion) continue;

    if (e.friction) {
      if (e.speed > 0) {
        e.speed = e.speed - e.friction;
        if (e.speed < 0) e.speed = 0;
      } else if (e.speed < 0) {
        e.speed = e.speed + e.friction;
        if (e.speed > 0) e.speed = 0;
      }
    }

    if (!e.speed && !e.gravity) continue;
    state.counters.motionSteps += 1;

    // Decompose to components, add gravity, recompose.
    const r = (e.direction * Math.PI) / 180;
    let hs = e.speed * Math.cos(r);
    let vs = -e.speed * Math.sin(r);

    if (e.gravity) {
      const gr = (e.gravity_direction * Math.PI) / 180;
      hs += e.gravity * Math.cos(gr);
      vs += -e.gravity * Math.sin(gr);
      e.speed = Math.sqrt(hs * hs + vs * vs);
      let dir = (Math.atan2(-vs, hs) * 180) / Math.PI;
      if (dir < 0) dir += 360;
      e.direction = dir;
    }

    // No explicit fround: x/y are f32-narrowing accessors (entity.js).
    e.x = e.x + hs;
    e.y = e.y + vs;
  }
}

/**
 * Bullet-vs-heart collision dispatch. A bullet type may override the test
 * with `collides(b, heart, state)`; otherwise it falls back to the
 * sprite-mask test once chapter 1 masks are extracted (sim/masks.js, T3+).
 * Until masks land, a bullet with neither is COUNTED as unmasked rather
 * than silently skipped, so a verifier can assert the hole is closed.
 */
function runCollisions(state) {
  state.eventPhase = 'collision';
  const heart = state.soul;
  if (!heart || !heart.alive) return;

  // COLLISION PAIRS RUN PER BULLET, [GRAZE, HIT], BULLETS NEWEST-FIRST.
  // Measured with an event-order probe (oracle_pairorder_probe.csx,
  // traces/pairorder3-{65,70}-events.csv): live-70 f34 logs
  // G(newer spade) -> H(newer spade) -> G(older spade, inv already 40) —
  // per-bullet interleave, newest first, graze ahead of the hit.
  //
  // DOCUMENTED RUNTIME DEVIATION — THE DEATH-FRAME G-SKIP: on a minority
  // of the frames where a bullet dies on the heart (27/93 heart-contact
  // deaths in the type-65 log, 2/11 in type 70), the runner never fires
  // that bullet's grazebox event, even though its own place_meeting says
  // the pair overlaps (P rows in the same log) and identical positions in
  // other rings DO fire it. The skip phases toggle mid-ring with no
  // GML-visible cause — collision-grid insertion history inside the
  // runtime decides whether the heart's pair (which destroys the bullet)
  // dispatches ahead of the grazebox's. The sim always grazes first, so
  // on those frames it can award a trickle/contact the runner skipped:
  // sim tension >= oracle tension, turntimer <=, offsets changing only on
  // bullet-death frames. tools/verify-live.mjs enforces exactly that
  // envelope; every other column stays byte-exact.
  for (const b of [...state.entities].sort((a, z) => z.seq - a.seq)) {
    if (!b.alive || !b.isBullet || !b.type.other15) continue;
    if (b.maskOff) continue; // mask_index = spr_nomask
    grazeBullet(state, b);
    const collides = b.type.collides;
    let hit;
    if (collides) {
      state.counters.collisionChecks += 1;
      hit = collides(b, heart, state);
    } else {
      // GameMaker's default: mask_index = -1, collide with my own sprite.
      // A bullet with no registered sprite mask is COUNTED rather than
      // silently skipped, so a verifier can assert the hole is closed
      // (knight-sim shipped three inert attacks through that hole).
      hit = spriteMaskHit(b, heart);
      if (hit === null) {
        state.counters.unmaskedBullets += 1;
        continue;
      }
      state.counters.collisionChecks += 1;
    }
    if (hit) {
      // The hits counter mirrors the sterilized recorders' semantics: only
      // active == 1 contacts count (the carousel's gray back-face and a
      // faded pillar overlap without counting). The event itself still
      // dispatches — Other_15 owns the active gate, as in the original.
      if (b.active === 1) state.counters.collisionHits += 1;
      b.type.other15(b, state);
    }
  }
}

/**
 * Sprite animation. GameMaker advances image_index by image_speed once per
 * step, wrapping at the frame count — the engine does it, not the object.
 * IT RUNS AT THE START OF THE FRAME, before Begin Step (measured in
 * knight-sim against the real runner; same engine family).
 */
function runAnimation(state) {
  for (const e of state.entities) {
    if (!e.alive || !e.image_speed) continue;
    const n = state.spriteFrames?.[e.sprite_index] ?? 0;
    const rate = state.spriteRate?.[e.sprite_index] ?? 1;
    let idx = (e.image_index ?? 0) + e.image_speed * rate;
    if (n > 1 && idx >= n) {
      idx -= n;
      e.animationEnded = true;
    }
    e.image_index = idx;
  }
}

/**
 * Advance exactly one frame.
 *
 * @param {object} state  mutated in place and returned
 * @param {object} input  this frame's input state; sim never polls for it
 */
export function stepFrame(state, input) {
  state.input = input;

  // GameMaker latches xprevious/yprevious at the TOP of every frame, before
  // any event runs.
  for (const e of state.entities) {
    if (!e.alive) continue;
    e.xprevious = e.x;
    e.yprevious = e.y;
  }

  runAnimation(state);
  // Menu-edge inputs: global.input_pressed is a 0->1 transition against
  // last frame's held state (obj_time's Begin Step poll). The soul reads
  // held state directly; the battle menu runs on these edges.
  {
    const cur = state.input ?? {};
    const prev = state.inputPrev ?? {};
    state.menuEdges = {
      left: !!cur.left && !prev.left,
      right: !!cur.right && !prev.right,
      up: !!cur.up && !prev.up,
      down: !!cur.down && !prev.down,
      confirm: !!cur.confirm && !prev.confirm,
      cancel: !!cur.cancel && !prev.cancel,
    };
  }
  runPhase(state, 'beginStep');
  runAlarms(state);
  runPhase(state, 'step');
  runMotion(state);
  runCollisions(state);
  runPhase(state, 'endStep');

  // obj_grazebox's End Step: the box moves to the heart NOW, after this
  // frame's collisions already tested against where it was — chapter 1's
  // obj_grazebox Step_2 does exactly what chapter 3's did (x = heart.x + 10).
  // The graze COLLISION handler itself lands with its own translation.
  if (state.soul && state.soul.alive) {
    state.grazePrev = { x: state.soul.x + 10, y: state.soul.y + 10 };
  } else {
    state.grazePrev = null;
  }

  // Draw phase. Entities with a drawStep (obj_attackpress) run their Draw
  // events here, in creation order.
  for (const e of state.entities) {
    if (e.alive && e.type.drawStep) e.type.drawStep(e, state);
  }

  // Replayed text-jitter draws (see tools/scenes/fullfight.js): the
  // writers (depth 3) draw before obj_dmgwriter (depth 0), so these
  // consume ahead of the writers' random(2) below.
  if (state.txtDraws) {
    const n = state.txtDraws.get(state.frame) ?? 0;
    for (let i = 0; i < n; i++) gmlRandom(state.gmlRng, 0);
  }

  // obj_dmgwriter's Draw draws -5 - random(2) once its delaytimer reaches
  // `delay` (2 from scr_damage's writers — the first tick happens on the
  // creation frame; 1 from scr_mnendturn's heal writers, whose draw lands
  // the same frame they are created). The writer keeps drawing ~50 frames
  // but never touches the stream again, so it retires here once the draw
  // is consumed.
  if (state.dmgwriters && state.dmgwriters.length > 0) {
    for (const w of state.dmgwriters) {
      w.delaytimer += 1;
      if (w.delaytimer === (w.delay ?? 2)) {
        gmlRandom(state.gmlRng, 2);
        w.done = true;
      }
    }
    state.dmgwriters = state.dmgwriters.filter((w) => !w.done);
  }

  // Destroyed entities disappear before the row is written, matching GML
  // instance_destroy() taking effect immediately.
  reap(state);

  state.trace.push(traceRow(state));

  // IMMORTAL-PARTY scenario (the FIGHT-path whole-fight harness): hp is
  // restored to max after the row is written, mirroring the recorder —
  // hit frames stay visible, the wipe cannot happen.
  if (state.immortalParty) {
    const p = state.party;
    p.hp[1] = p.maxhp[1];
    p.hp[2] = p.maxhp[2];
    p.hp[3] = p.maxhp[3];
  }
  state.inputPrev = state.input;
  state.frame += 1;

  return state;
}

/** Run `frames` frames, pulling input from `inputAt(frame)`. */
export function runFrames(state, frames, inputAt) {
  for (let i = 0; i < frames; i++) {
    stepFrame(state, inputAt(state.frame));
  }
  return state;
}
