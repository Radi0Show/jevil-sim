#!/usr/bin/env node
// AUDIO COVERAGE — every sound the live Jevil objects play must be cued
// somewhere in sim/, or be listed below with the reason it is not.
//
// THE DUMP IS THE SOURCE and the sim is the thing under test: the expected
// set re-derives on every run. Add an attack, add its sounds, and any gap
// shows up here. (Knight's suite pattern; the jevil call shape is
// `state.audio?.cue('snd_x')`.)
//
// LIMIT: this checks a sound is cued SOMEWHERE, not at the right site with
// the right pitch — the per-site work is still reading the object.
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const DUMP = process.env.HOME + '/jevil-research/gml_dump/CodeEntries';
const SIM = process.env.HOME + '/jevil-sim/sim';
if (!existsSync(DUMP)) {
  console.log(`MISSING ${DUMP} (private research repo)`);
  process.exit(1);
}

// Objects the real fight reaches (CLAUDE.md's roster + the menu/UI layer).
const LIVE = [
  'obj_joker', 'obj_joker_body', 'obj_dbulletcontroller', 'obj_dbullet_maker',
  'obj_suitbomb', 'obj_heartbomb_blast', 'obj_regularbullet', 'obj_regularbullet_permanent',
  'obj_carouselbullet', 'obj_spadering', 'obj_joker_teleport', 'obj_clubsbullet_dark',
  'obj_dbullet_vert', 'obj_centerscythe', 'obj_laserscythe',
  // obj_growtangle_bouncer is NOT here: its only creators are
  // obj_king_body / obj_king_boss — the King's fight, not Jevil's.
  'obj_battlecontroller', 'obj_heroparent', 'obj_attackpress', 'obj_spellphase',
  'obj_pacifyspell', 'obj_grazebox', 'obj_heart', 'obj_moveheart', 'obj_growtangle',
];

const gml = new Map();
for (const f of readdirSync(DUMP)) {
  const base = f.replace(/^gml_Object_/, '').replace(/_(Step|Draw|Create|Other|Alarm|Destroy|CleanUp)_\d+\.gml$/, '');
  if (!LIVE.includes(base)) continue;
  const text = readFileSync(`${DUMP}/${f}`, 'utf8');
  for (const m of text.matchAll(/snd_play[a-z_]*\s*\(\s*(?:scr_84_get_sound\s*\(\s*)?"?(snd_[a-z_0-9]+)/g)) {
    if (!gml.has(m[1])) gml.set(m[1], []);
    gml.get(m[1]).push(f.replace(/^gml_Object_/, '').replace(/\.gml$/, ''));
  }
}

const simCued = new Set();
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) { walk(`${dir}/${f.name}`); continue; }
    if (!f.name.endsWith('.js')) continue;
    for (const line of readFileSync(`${dir}/${f.name}`, 'utf8').split('\n')) {
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      if (!/audio\?\.\s*cue/.test(line)) continue;
      // any quoted sound on a cue line counts (covers the laugh array).
      for (const m of line.matchAll(/'(snd_[a-z_0-9]+)'/g)) simCued.add(m[1]);
    }
  }
};
walk(SIM);

// Sounds in shared objects that belong to OTHER encounters. Each traced to
// its enclosing gate; none is reachable in the Jevil fight.
const OTHER = {
  snd_lancerwhistle: 'dc types 20/22, gated on obj_lancerboss3 (Lancer)',
  // The Pirouette wheel (obj_joker Step_0 acting == 2, chaosdance 0-8) is
  // scope-labelled untranslated: its heal slots spawn obj_healanim star
  // sprays whose step RNG is unmodeled, and no verified scenario
  // pirouettes (STATUS "Next"). Its five outcome sounds ride with it.
  snd_pirouette: 'pirouette wheel (untranslated, see above)',
  snd_applause: 'pirouette wheel chaosdance 8',
  snd_awkward: 'pirouette wheel chaosdance 3',
  snd_badexplosion: 'pirouette wheel chaosdance 0',
  snd_boost: 'pirouette wheel chaosdance 7',
  snd_weirdeffect: 'pirouette wheel chaosdance 2/6',
  snd_coin: 'dc type 32 (Rouxls)',
  snd_rudebuster_swing: 'heroparent Rude Buster path (spell 1 — Susie ch2+; ch1 roster never has it)',
  snd_shadowpendant: 'battlecontroller item path (item never held in this fight)',
  snd_birdtweet: 'battlecontroller victory dance (skipvictory = 1 in both endings)',
  snd_carhonk: 'dc type 33 (Rouxls car)',
  snd_toilet: 'dc type 41 (puzzle)',
};

const missing = [...gml.keys()].filter((s) => !simCued.has(s) && !OTHER[s]).sort();
const excused = [...gml.keys()].filter((s) => !simCued.has(s) && OTHER[s]).sort();
console.log(`GML sounds in live objects: ${gml.size}   cued by sim: ${simCued.size}`);
if (excused.length) console.log(`excused (not this fight's): ${excused.join(', ')}`);
if (missing.length) {
  console.log(`\nFAIL  ${missing.length} sound(s) the fight plays and the sim never cues:`);
  for (const s of missing) console.log(`  ${s}  <- ${[...new Set(gml.get(s))].join(', ')}`);
  process.exit(1);
}
console.log('PASS  every live-object sound is cued (or excused above)');
