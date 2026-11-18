// Menu and the setup screens for Power Test and Battle.
import { h, robotPicture, button, robotStage } from './dom.js';
import { BODIES } from '../data/parts.js';
import { powerRating } from '../game/robot.js';
import { recipeFor } from '../game/merge.js';
import { WALLS } from '../game/walltest.js';
import { DIFFICULTY } from '../game/level.js';
import { sfx, isMuted, setMuted } from '../render/sfx.js';

export function menuScreen(app) {
  const hero = app.garage.robots[0];
  const muteBtn = button(isMuted() ? '🔇' : '🔊', () => { setMuted(!isMuted()); muteBtn.textContent = isMuted() ? '🔇' : '🔊'; }, { class: 'small mute' });
  return h('div', { class: 'screen menu' },
    muteBtn,
    h('h1', { class: 'title' }, 'STRONG', h('br'), 'ROBOTS'),
    h('p', { class: 'subtitle' }, 'Build • Smash • Combine • Fight'),
    robotStage(() => hero, 220, 220),
    h('div', { class: 'menu-buttons' },
      button('🔧 Garage', () => { sfx.click(); app.go('garage'); }, { class: 'big', attrs: { 'data-action': 'garage' } }),
      button('🧱 Power Test', () => { sfx.click(); app.go('wall-setup'); }, { class: 'big orange', attrs: { 'data-action': 'power-test' } }),
      button('⚔️ Battle', () => { sfx.click(); app.go('battle-setup'); }, { class: 'big red', attrs: { 'data-action': 'battle' } })));
}

function robotPicker(app, selected, max, onChange) {
  return h('div', { class: 'pick-robots' }, app.garage.robots.map((r, i) => h('button', {
    class: `robot-card ${selected.includes(i) ? 'active' : ''}`, 'data-robot': i,
    onclick: () => {
      sfx.click();
      const at = selected.indexOf(i);
      if (at >= 0) { if (selected.length > 1) selected.splice(at, 1); } else if (max === 1) selected.splice(0, 1, i);
      else if (selected.length < max) selected.push(i);
      onChange();
    },
  }, robotPicture(r, 90, 90), h('div', {}, h('b', {}, r.name), h('small', {}, `${BODIES[r.body].core} · ⚡ ${powerRating(r)}`)))));
}

export function wallSetupScreen(app) {
  const selected = [0];
  let target = 'easy';
  const root = h('div', { class: 'screen setup' });
  const render = () => root.replaceChildren(
    h('header', { class: 'topbar' }, button('⬅ Menu', () => app.go('menu'), { class: 'small' }), h('h1', {}, '🧱 Power Test'), h('div', { class: 'spacer' })),
    h('h2', {}, '1. Pick a robot'),
    robotPicker(app, selected, 1, render),
    h('h2', {}, '2. Pick what to smash'),
    h('div', { class: 'choice-row' }, Object.values(WALLS).map((w) => h('button', {
      class: `choice ${target === w.id ? 'active' : ''}`, 'data-target': w.id, style: `--accent:${w.color}`,
      onclick: () => { sfx.click(); target = w.id; render(); },
    }, h('div', { class: 'wall-icon', style: `background:${w.color}` }), h('b', {}, w.name), h('small', {}, `❤️ ${w.hp} · 🛡️ ${w.armor}`),
    h('span', { class: 'stars' }, '⭐'.repeat(app.garage.stars[w.id] || 0) || '—')))),
    button('SMASH IT! 💥', () => { sfx.click(); app.go('wall', { robot: selected[0], target }); }, { class: 'big orange go', attrs: { 'data-action': 'start' } }),
  );
  render();
  return root;
}

export function combineHints(blueprints) {
  const cores = blueprints.map((b) => BODIES[b.body].core);
  const hints = [];
  for (let i = 0; i < cores.length; i++) for (let j = i + 1; j < cores.length; j++) {
    const r = recipeFor([cores[i], cores[j]]);
    if (r) hints.push(`${blueprints[i].name} + ${blueprints[j].name} → ${r.name}`);
  }
  if (cores.length === 3) {
    const r = recipeFor(cores);
    if (r) hints.push(`All three → ${r.name}!`);
  }
  return hints;
}

export function battleSetupScreen(app) {
  const selected = app.lastBattle?.robots?.filter((i) => i < app.garage.robots.length) || [0];
  if (!selected.length) selected.push(0);
  let difficulty = app.lastBattle?.difficulty || 'easy';
  const root = h('div', { class: 'screen setup' });
  const render = () => {
    const hints = combineHints(selected.map((i) => app.garage.robots[i]));
    root.replaceChildren(
      h('header', { class: 'topbar' }, button('⬅ Menu', () => app.go('menu'), { class: 'small' }), h('h1', {}, '⚔️ Battle'), h('div', { class: 'spacer' })),
      h('h2', {}, `1. Pick your team (up to 3) — ${selected.length} chosen`),
      robotPicker(app, selected, 3, render),
      h('div', { class: 'combine-box' }, hints.length
        ? [...hints.map((t) => h('div', {}, `✨ ${t}`)), h('small', {}, 'In battle: walk them onto the 🤝 squares next to each other, then tap 🤝 Combine!')]
        : h('div', {}, 'Tip: pick a Car + Jet, Beast + Titan or Tank + Titan team to COMBINE into a super robot!')),
      h('h2', {}, '2. Pick a level'),
      h('div', { class: 'choice-row' }, Object.entries(DIFFICULTY).map(([id, d]) => h('button', {
        class: `choice ${difficulty === id ? 'active' : ''} diff-${id}`, 'data-difficulty': id,
        onclick: () => { sfx.click(); difficulty = id; render(); },
      }, h('b', {}, d.label), h('small', {}, `${d.enemies} enemy robots`)))),
      button('FIGHT! ⚔️', () => { sfx.click(); app.go('battle', { robots: [...selected], difficulty }); }, { class: 'big red go', attrs: { 'data-action': 'start' } }),
    );
  };
  render();
  return root;
}
