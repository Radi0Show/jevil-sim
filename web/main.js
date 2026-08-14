// Browser driver. Owns real time; sim/ never sees it.
//
// The accumulator is sim/clock.js `drain` — the browser and the headless
// verifier advance state through exactly the same code path. `?attack=N`
// and `?seed=N` reproduce any moment deterministically.

import { createState, stepFrame } from '../sim/index.js';
import { drain } from '../sim/clock.js';
import { buildPracticeScene, ATTACKS } from '../sim/scenes/practice.js';
import { bindKeyboard } from '../input/keyboard.js';
import { createRenderer } from '../render/canvas.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const renderer = createRenderer(canvas);
const keys = bindKeyboard(window);

const params = new URLSearchParams(location.search);
let attackIndex = Math.min(15, Math.max(0, Number(params.get('attack') ?? 0)));
let seed = Number(params.get('seed') ?? (Math.random() * 1e9 | 0));

let state;
function rebuild(newSeed = seed) {
  seed = newSeed;
  state = createState({ seed, traceBulletSlots: 0 });
  buildPracticeScene(state, { attackIndex });
  const u = new URL(location.href);
  u.searchParams.set('attack', String(attackIndex));
  u.searchParams.set('seed', String(seed));
  history.replaceState(null, '', u);
  updateHud();
}

function updateHud() {
  const atk = ATTACKS[attackIndex];
  const badge = atk.verified
    ? '<span class="ok">[oracle-verified]</span>'
    : '<span class="warn">[translated — oracle suite pending]</span>';
  hud.innerHTML =
    `<b>JEVIL PRACTICE — ${atk.name}</b> ${badge}<br>` +
    `arrows/WASD move · <kbd>X</kbd>/<kbd>Shift</kbd> focus · ` +
    `<kbd>R</kbd> restart · <kbd>[</kbd> <kbd>]</kbd> switch attack · ` +
    `turn ${state ? Math.max(0, state.turntimer) : ''} · hits ${state ? state.counters.collisionHits : 0}<br>` +
    `<span class="warn">Sandbox build: the damage system is not yet translated — ` +
    `contact destroys bullets and counts hits, party HP is untouched. ` +
    `Bullet shapes ARE the game's real collision masks.</span>`;
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
});

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
    // Turn end: the real fight tears the arena down at turntimer 0; the
    // practice loop restarts the attack with a fresh seed instead.
    if (state.turntimer <= 0) {
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
