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

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
const renderer = createRenderer(canvas);
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
    hud.innerHTML =
      `<b>JEVIL — FIGHT (dodge-only)</b> <span class="warn">[lifecycle dump-timed; whole-fight recording pending]</span><br>` +
      `${partyLine()} · TP ${Math.floor(state.tension / state.maxtension * 100)}% · ` +
      `JEVIL ${j.hp}/${j.maxhp}${j.tired ? ' <span class="ok">TIRED</span>' : ''} · turn ${j.turns} (jturn ${j.jturn})<br>` +
      `arrows/WASD move · <kbd>X</kbd>/<kbd>Shift</kbd> focus · <kbd>Z</kbd> skip talk · ` +
      `<kbd>E</kbd> debug damage (drives the real HP gates) · <kbd>R</kbd> restart · <kbd>F</kbd> practice mode<br>` +
      `<span class="warn">Menu phase replaced by a fixed pause (dodge-only build); ` +
      `damage/graze/i-frames/turn-shortening are the translated chapter 1 systems.</span>`;
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
  if (ev.code === 'KeyE' && mode === 'fight' && state.joker) {
    // Debug damage: drives the HP phase gates (knight's E-key precedent).
    state.joker.hp -= 400;
    if (state.joker.hp <= 0) state.joker.hp = 0;
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
    if (state.gameOver) {
      rebuild((Math.random() * 1e9) | 0);
      break;
    }
    if (mode === 'fight' && state.joker && state.joker.hp <= 0) {
      // Violence ending (obj_joker Draw: mhpratio <= 0 during the hurt) —
      // page-level: brief hold then restart.
      rebuild((Math.random() * 1e9) | 0);
      break;
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
