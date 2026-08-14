// The simulation state object.
//
// MUTATION, deliberate. `stepFrame` mutates this object in place and returns
// it, rather than building a fresh state each frame. Two reasons: GML semantics
// are mutation, so a translated Step event reads the same on both sides and
// diffs by eye; and deep-cloning every entity 30 times a second buys nothing
// when the only consumer that must not write to state is render/, which is
// enforced by review rather than by the type system.
//
// The consequence to respect: never hold a reference to state across frames
// expecting a snapshot. If you need one, serialise it.
//
// Chapter 1 (Jevil) edition. Knight-sim's chapter-3 subsystems (heroes, item
// menu, fight bar, knight...) are NOT carried over — each chapter-1 system
// arrives with its own translation from the chapter 1 dump and its own suite.

import { createRng, gmlCreate } from './rng.js';
import { freshParty } from './damage.js';

export function createState({ seed, traceBulletSlots = 0 } = {}) {
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer, got ${seed}`);
  }

  return {
    // Index of the frame about to run. Incremented at the end of stepFrame,
    // after the trace row is emitted, so row N describes frame N.
    frame: 0,

    seed,
    rng: createRng(seed),

    entities: [],
    nextSpawnSeq: 0,

    // Convenience handles the trace reads directly.
    soul: null,
    hp: 0,
    invTimer: 0,

    // GML globals the translated code reads. Named for what they are, with the
    // original in a comment so a grep of the dump still finds the connection.
    view: { x: 0, y: 0 }, // __view_get(e__VW.XView/YView, 0)
    sp: 4, // global.sp — base soul speed (obj_heart Create: global.sp = 4)
    heartx: 0, // global.heartx
    hearty: 0, // global.hearty
    turntimer: 999, // global.turntimer — obj_battlecontroller decrements
    invc: 1, // global.invc — i-frames are ALWAYS invc * 40 (bullet inv fields are write-only)

    // The chapter 1 party (slot->char map, HP, DF, down state). See damage.js.
    party: freshParty(),
    tension: 0, // global.tension
    maxtension: 250, // global.maxtension (chapter 1)
    grazeEnabled: false, // scenes that mirror sterilized recordings keep this off
    grazeFlash: 0, // obj_grazebox grazetimer (visual)
    gameOver: false,
    shake: 0,

    // Oracle parity switch. Some oracle patches replace the damage event with
    // a pure recorder, because letting the party die ends the run and loses
    // the trace. Scenes mirroring such a run set this false: contact is still
    // detected and counted, but no inv reset and no destroy-on-hit.
    damageEnabled: true,

    // Recorded choose() outcomes for RNG replay, if a scene needs them before
    // the chapter-1 RNG identity is oracle-confirmed.
    chooseTable: null,
    chooseIndex: 0,

    // GameMaker's real RNG stream (sim/rng.js gmlRng — WELL512, validated
    // in-game for chapter 3; chapter 1 identity to be confirmed by a probe
    // before any suite leans on it).
    gmlRng: gmlCreate(0),

    // Battle phase — which part of the fight is running. This is the `phase`
    // column in the trace. Scenes own it; the skeleton never writes it.
    phase: 'none',

    // Which GameMaker event phase is executing right now. Diagnostic only.
    eventPhase: 'init',

    // Current frame's input, set by stepFrame.
    input: null,

    traceBulletSlots,
    trace: [],

    // Execution counters. A suite of negative results can hide a dead code
    // path. Verifiers assert on these so "the check ran and resolved
    // negative" is distinguishable from "the check never ran".
    counters: {
      collisionChecks: 0,
      unmaskedBullets: 0, // bullet-vs-heart tests actually evaluated
      collisionHits: 0, // other15 dispatches
      motionSteps: 0, // built-in motion applications
      alarmFires: 0, // alarm handlers invoked
    },
  };
}
