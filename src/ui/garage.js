// Robot builder: pick parts per slot, color and name. Up to 4 robots are kept.
import { h, robotPicture, robotStage, button } from './dom.js';
import { SLOTS, COLORS, BODIES, HEADS, ARMS, LEGS } from '../data/parts.js';
import { buildUnit, powerRating, normalizeBlueprint } from '../game/robot.js';
import { partnersFor } from '../game/merge.js';
import { MAX_ROBOTS } from '../save.js';
import { sfx } from '../render/sfx.js';

const NAMES = ['Blaze', 'Bolt', 'Titan', 'Rex', 'Nova', 'Jet', 'Turbo', 'Max', 'Spark', 'Rocky', 'Volt', 'Ace', 'Comet', 'Dash'];

function partStat(slot, part) {
  if (slot === 'body') return `❤️${part.hp} 🛡️${part.armor} · ${part.core}`;
  if (slot === 'legs') return `👟${part.move} 🧗${part.climb} 🦘${part.jump}`;
  if (part.attack?.dmg) return `💥${part.attack.dmg} 🎯${part.attack.range}`;
  if (part.attack?.heal) return `💚${part.attack.heal}`;
  if (part.skill?.dmg) return `💥${part.skill.dmg}`;
  if (part.armor) return `🛡️+${part.armor}`;
  return '';
}

export function randomBlueprint() {
  const pick = (o) => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
  return normalizeBlueprint({
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    head: pick(HEADS), body: pick(BODIES), left: pick(ARMS), right: pick(ARMS), legs: pick(LEGS),
  });
}

export function garageScreen(app, params = {}) {
  const { robots } = app.garage;
  let index = Math.min(params.index ?? 0, robots.length - 1);
  let slot = 'body';
  const root = h('div', { class: 'screen garage' });
  const current = () => robots[index];
  const stage = robotStage(() => current(), 300, 300);

  const update = (changes) => {
    robots[index] = normalizeBlueprint({ ...current(), ...changes });
    app.save();
    render();
  };

  function render() {
    const bp = current();
    const unit = buildUnit(bp);
    const core = BODIES[bp.body].core;
    root.replaceChildren(
      h('header', { class: 'topbar' },
        button('⬅ Menu', () => app.go('menu'), { class: 'small' }),
        h('h1', {}, '🔧 Robot Garage'),
        h('div', { class: 'spacer' })),
      h('div', { class: 'garage-body' },
        h('aside', { class: 'robot-list' },
          robots.map((r, i) => h('button', {
            class: `robot-card ${i === index ? 'active' : ''}`, 'data-robot': i,
            onclick: () => { index = i; sfx.click(); render(); },
          }, robotPicture(r, 70, 70), h('div', {}, h('b', {}, r.name), h('small', {}, `⚡ ${powerRating(r)}`)))),
          robots.length < MAX_ROBOTS ? button('➕ New Robot', () => { robots.push(randomBlueprint()); index = robots.length - 1; app.save(); render(); }, { class: 'add', attrs: { 'data-action': 'new-robot' } }) : null),
        h('section', { class: 'preview' },
          stage,
          h('input', {
            class: 'name-input', value: bp.name, maxlength: 14, 'aria-label': 'Robot name',
            onchange: (e) => update({ name: e.target.value }),
          }),
          h('div', { class: 'swatches' }, COLORS.map((c) => h('button', {
            class: `swatch ${c === bp.color ? 'active' : ''}`, style: `background:${c}`, 'aria-label': `Color ${c}`,
            onclick: () => { sfx.click(); update({ color: c }); },
          }))),
          h('div', { class: 'row' },
            button('🎲 Random', () => { sfx.click(); robots[index] = { ...randomBlueprint(), name: bp.name }; app.save(); render(); }, { class: 'small' }),
            robots.length > 1 ? button('🗑️ Delete', () => { robots.splice(index, 1); index = Math.max(0, index - 1); app.save(); render(); }, { class: 'small danger' }) : null)),
        h('section', { class: 'parts' },
          h('div', { class: 'tabs' }, SLOTS.map((s) => h('button', {
            class: `tab ${s.key === slot ? 'active' : ''}`, 'data-slot': s.key,
            onclick: () => { slot = s.key; sfx.click(); render(); },
          }, s.label))),
          h('div', { class: 'part-grid' }, Object.values(SLOTS.find((s) => s.key === slot).table).map((part) => h('button', {
            class: `part-card ${bp[slot] === part.id ? 'active' : ''}`, 'data-part': part.id,
            onclick: () => { sfx.click(); update({ [slot]: part.id }); },
          }, robotPicture({ ...bp, [slot]: part.id }, 76, 76), h('b', {}, part.name), h('small', {}, part.desc), h('span', { class: 'stat' }, partStat(slot, part))))),
          h('div', { class: 'stats' },
            h('div', { class: 'stat-row' },
              h('span', {}, `❤️ ${unit.maxHp}`), h('span', {}, `🛡️ ${unit.armor}`), h('span', {}, `👟 ${unit.move}`),
              h('span', {}, `🧗 ${unit.climb}`), h('span', {}, `🦘 ${unit.jump}`), h('span', { class: 'power' }, `⚡ ${powerRating(bp)}`)),
            h('div', { class: 'chips' }, unit.attacks.map((a) => h('span', { class: 'chip' }, `${a.icon} ${a.name}`))),
            h('div', { class: 'combine-hint' }, `🤝 ${core} robot · combines with: ${partnersFor(core).join(', ')}`)))),
    );
  }
  render();
  return root;
}
