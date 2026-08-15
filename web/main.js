// Browser driver. Owns real time; sim/ never sees it.
//
// The accumulator is sim/clock.js `drain` — the browser and the headless
// verifier advance state through exactly the same code path. `?attack=N`
// and `?seed=N` reproduce any moment deterministically.

import { createState, stepFrame } from '../sim/index.js';
import { drain } from '../sim/clock.js';
import { buildPracticeScene, ATTACKS } from '../sim/scenes/practice.js';
import { buildFightScene } from '../sim/fight.js';
import { bindKeyboard } from '../input/keyboard.js';
import { createRenderer } from '../render/canvas.js';
import { loadSprites } from '../render/sprites.js';
import { createAudio } from '../render/audio.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
// The sprite pack is optional: pack absent (fresh clone before extraction)
// -> renderer falls back to collision-mask drawing for everything.
let sprites = null;
try {
  sprites = await loadSprites();
} catch {
  sprites = null;
}
const renderer = createRenderer(canvas, sprites);
const audio = createAudio();
// The sim cues through state.audio?.cue(name); adapt to the player's play().
// play() takes a cue LIST of {name,...} records (knight's drain shape).
const audioSink = { cue: (name) => audio.play([{ name }]) };
// global.batmusic: the fight loops joker.ogg. Cue on the FIRST input —
// before a user gesture the context is suspended AND the manifest may not
// have resolved, so a load-time cue is silently dropped (knight pattern).
// Start the fight's music at LOAD, not on first input: the cue waits for
// the manifest probe, then starts inside the (possibly suspended) context
// — it becomes audible immediately where the browser allows autoplay, or
// the instant the audio layer's own gesture-resume hooks fire otherwise.
let musicStarted = false;
function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  audio.play([{ name: 'mus_joker', pitch: 1, gain: 1, loop: true }]);
}
audio.ready.then(startMusic);
window.addEventListener('keydown', startMusic, { passive: true });
const keys = bindKeyboard(window);

const params = new URLSearchParams(location.search);
let mode = params.get('mode') === 'fight' ? 'fight' : 'practice';
let attackIndex = Math.min(15, Math.max(0, Number(params.get('attack') ?? 0)));
let seed = Number(params.get('seed') ?? (Math.random() * 1e9 | 0));

let state;
function rebuild(newSeed = seed) {
  seed = newSeed;
  state = createState({ seed, traceBulletSlots: 0 });
  if (mode === 'fight') {
    buildFightScene(state, {});
  } else {
    buildPracticeScene(state, { attackIndex });
    state.damageEnabled = true;
    state.grazeEnabled = true;
  }
  state.audio = audioSink;
  window.__state = state; // debug handle (read-only use)
  const u = new URL(location.href);
  u.searchParams.set('mode', mode);
  u.searchParams.set('attack', String(attackIndex));
  u.searchParams.set('seed', String(seed));
  history.replaceState(null, '', u);
  updateHud();
}

function partyLine() {
  const p = state.party;
  const names = ['KRIS', 'SUSIE', 'RALSEI'];
  return [0, 1, 2].map((i) => {
    const hp = p.hp[p.char[i]];
    const cls = hp <= 0 ? 'warn' : 'ok';
    return `${names[i]} <span class="${cls}">${hp}/${p.maxhp[p.char[i]]}</span>`;
  }).join(' · ');
}

function updateHud() {
  if (mode === 'fight') {
    const j = state.joker;
    if (fightOver === 'violence') {
      hud.innerHTML = `<b>JEVIL DEFEATED (FIGHT)</b> — "TAKE ME AND DO YOUR STRONGEST---!" · DEVILSKNIFE obtained · restarting...`;
      return;
    }
    if (fightOver === 'pacify') {
      hud.innerHTML = `<b>JEVIL PACIFIED</b> — "NOW I WILL SLEEP FOR THE OTHER 100 YEARS." · JEVILSTAIL obtained · restarting...`;
      return;
    }
    hud.innerHTML =
      `<b>JEVIL — FIGHT</b> <span class="ok">[all three endings oracle-verified]</span><br>` +
      `${partyLine()} · TP ${Math.floor(state.tension / state.maxtension * 100)}% · ` +
      `JEVIL ${j.hp}/${j.maxhp}${j.tired ? ' <span class="ok">TIRED</span>' : ''} · turn ${j.turns} (jturn ${j.jturn})<br>` +
      `arrows/WASD move · <kbd>X</kbd>/<kbd>Shift</kbd> focus · <kbd>Z</kbd> skip talk · ` +
      `<kbd>E</kbd> debug damage · <kbd>P</kbd> pacify (needs TIRED) · <kbd>R</kbd> restart · <kbd>F</kbd> practice<br>` +
      `<span class="ok">Full battle menus live: FIGHT (one-button bolt), ACT, MAGIC (Pacify on TIRED), ` +
      `ITEM row, DEFEND — the oracle-verified chapter 1 systems end to end.</span>`;
    return;
  }
  const atk = ATTACKS[attackIndex];
  const badge = atk.verified
    ? '<span class="ok">[oracle-verified]</span>'
    : '<span class="warn">[translated — narrowed suite, see docs]</span>';
  hud.innerHTML =
    `<b>JEVIL PRACTICE — ${atk.name}</b> ${badge}<br>` +
    `${partyLine()} · TP ${Math.floor(state.tension / state.maxtension * 100)}%<br>` +
    `arrows/WASD move · <kbd>X</kbd>/<kbd>Shift</kbd> focus · ` +
    `<kbd>R</kbd> restart · <kbd>[</kbd> <kbd>]</kbd> switch attack · <kbd>F</kbd> fight mode · ` +
    `turn ${state ? Math.max(0, Math.floor(state.turntimer)) : ''}<br>` +
    `<span class="warn">Damage, graze TP and i-frames are LIVE (chapter 1 systems); ` +
    `bullet shapes ARE the game's real collision masks.</span>`;
}

let prevBracketL = false;
let prevBracketR = false;
let prevR = false;

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'BracketLeft' && !prevBracketL) {
    attackIndex = (attackIndex + ATTACKS.length - 1) % ATTACKS.length;
    rebuild((Math.random() * 1e9) | 0);
  }
  if (ev.code === 'BracketRight' && !prevBracketR) {
    attackIndex = (attackIndex + 1) % ATTACKS.length;
    rebuild((Math.random() * 1e9) | 0);
  }
  if (ev.code === 'KeyR' && !prevR) {
    rebuild((Math.random() * 1e9) | 0);
  }
  if (ev.code === 'KeyF') {
    mode = mode === 'fight' ? 'practice' : 'fight';
    rebuild((Math.random() * 1e9) | 0);
  }
  if (ev.code === 'KeyE' && mode === 'fight' && state.joker && !fightOver) {
    // Debug damage: drives the HP phase gates (knight's E-key precedent).
    state.joker.hp -= 400;
    if (state.joker.hp <= 0) {
      state.joker.hp = 0;
      // Violence ending — obj_joker Draw: mhpratio <= 0 during the hurt
      // block ends the fight ON the killing hit (flag[241] = 6).
      fightOver = 'violence';
      fightOverAt = state.frame;
    }
  }
  if (ev.code === 'KeyP' && mode === 'fight' && state.joker && !fightOver) {
    // Debug Pacify: scr_spell case 3's gate — ONLY when TIRED
    // (monsterstatus == 1). flag[241] = 7 path.
    if (state.joker.monsterstatus === 1) {
      fightOver = 'pacify';
      fightOverAt = state.frame;
    }
  }
});

let fightOver = null;
let fightOverAt = 0;

rebuild(seed);

// ?frames=N fast-forwards deterministically before the first paint.
const ff = Number(params.get('frames') ?? 0);
for (let i = 0; i < ff; i++) stepFrame(state, keys.read());

let acc = 0;
let last = performance.now();
let hudTick = 0;

function frame(now) {
  const res = drain(acc, now - last);
  last = now;
  acc = res.accumulator;
  for (let i = 0; i < res.steps; i++) {
    stepFrame(state, keys.read());
    if (state.gameOver) {
      rebuild((Math.random() * 1e9) | 0);
      break;
    }
    if (mode === 'fight' && fightOver) {
      // Hold the ending banner ~3 seconds, then restart.
      if (state.frame - fightOverAt > 90) {
        fightOver = null;
        rebuild((Math.random() * 1e9) | 0);
        break;
      }
    }
    if (mode === 'practice' && state.turntimer <= 0) {
      rebuild((Math.random() * 1e9) | 0);
      break;
    }
  }
  renderer.draw(state);
  if (++hudTick % 15 === 0) updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__sim = { get state() { return state; }, stepFrame };
