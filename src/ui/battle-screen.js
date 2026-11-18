// Battle screen: touch input, action buttons and the turn loop.
import { h, button, robotPicture } from './dom.js';
import { BattleView } from '../render/battle-view.js';
import { sfx } from '../render/sfx.js';
import { LEGS } from '../data/parts.js';
import { createBattle, getUnit, aliveUnits, movesFor, moveUnit, performAction, mergeOptions, mergeRobots, endTurn, canUse } from '../game/battle.js';
import { runEnemyTurn } from '../game/ai.js';
import { targetsFor, stormVictims, isSelfAction } from '../game/combat.js';
import { posKey, cellAt, CRATE } from '../game/terrain.js';

export function battleScreen(app, { robots, difficulty, seed = Date.now() }) {
  app.lastBattle = { robots, difficulty };
  const state = createBattle({ blueprints: robots.map((i) => app.garage.robots[i]), difficulty, seed });
  const canvas = h('canvas', { class: 'battle-canvas', 'aria-label': 'Battlefield' });
  const view = new BattleView(canvas);
  const panel = h('div', { class: 'battle-panel' });
  const roundLabel = h('b');
  const hintLabel = h('small');
  const root = h('div', { class: 'screen battle' },
    h('header', { class: 'topbar' },
      button('⬅ Quit', () => { view.stop(); app.go('menu'); }, { class: 'small' }),
      h('div', { class: 'round' }, roundLabel, hintLabel),
      button('End Turn ⏭', () => finishTurn(), { class: 'small end-turn', attrs: { 'data-action': 'end-turn' } })),
    h('div', { class: 'canvas-wrap' }, canvas),
    panel);

  let selected = aliveUnits(state, 'player')[0]?.id || null;
  let pending = null;
  let hint = 'Tap a blue square to move, then pick an attack!';

  const ui = { state, view, get selected() { return selected; }, get pending() { return pending; } };
  globalThis.__game = { ...(globalThis.__game || {}), screen: 'battle', battle: ui };

  const myTurn = () => state.team === 'player' && !state.winner && !view.busy;

  function updateOverlay() {
    const o = { moves: [], targets: [], cells: [], heals: [], merges: [], selected };
    const unit = getUnit(state, selected);
    if (unit && unit.team === 'player' && myTurn()) {
      if (!pending) {
        for (const n of movesFor(state, unit.id).values()) if (n.x !== unit.x || n.y !== unit.y) o.moves.push(n);
      } else if (pending === 'merge') {
        o.merges = mergeOptions(state, unit.id).map((id) => getUnit(state, id));
      } else {
        const t = targetsFor(state, unit, pending);
        const list = t.units.map((id) => getUnit(state, id));
        if (pending.type === 'heal') o.heals = list; else { o.targets = list; o.cells = t.cells; }
      }
    }
    view.overlay = o;
  }

  function attackAvailable(unit, atk) {
    if (!canUse(unit, atk)) return false;
    if (atk.type === 'storm') return stormVictims(state, unit, atk).length > 0;
    if (isSelfAction(atk)) return true;
    const t = targetsFor(state, unit, atk);
    return t.units.length > 0 || t.cells.length > 0;
  }

  function renderPanel() {
    roundLabel.textContent = state.winner ? '' : `Round ${state.round} · ${state.team === 'player' ? 'Your turn' : 'Enemy turn'}`;
    const unit = getUnit(state, selected);
    hintLabel.textContent = state.winner ? '' : hint;
    if (!unit || unit.hp <= 0) { panel.replaceChildren(); return; }
    const mine = unit.team === 'player';
    const merges = mine ? mergeOptions(state, unit.id) : [];
    const status = mine ? (unit.acted ? '✅ Done' : unit.moved ? '👟 Moved' : '🟢 Ready') : '👾 Enemy';
    panel.replaceChildren(
      h('div', { class: 'unit-info' },
        robotPicture(null, 64, 64, unit),
        h('div', {},
          h('b', {}, unit.name, unit.recipe ? ' ⭐' : ''),
          h('div', { class: 'hp' }, h('div', { style: `width:${(unit.hp / unit.maxHp) * 100}%` }), h('span', {}, `${unit.hp}/${unit.maxHp}`)),
          h('small', {}, `🛡️${unit.armor} 👟${unit.move} ${LEGS[unit.legsId]?.name || ''} · ${status}`))),
      mine ? h('div', { class: 'actions' },
        unit.attacks.map((atk) => {
          const cd = unit.cooldowns[atk.id] || 0;
          const ok = myTurn() && attackAvailable(unit, atk);
          return h('button', {
            class: `action ${pending === atk ? 'active' : ''} ${atk.id.startsWith('ult') ? 'ultimate' : ''}`,
            'data-attack': atk.id, disabled: !ok,
            onclick: () => chooseAttack(unit, atk),
          }, h('span', { class: 'icon' }, atk.icon), h('span', {}, atk.name), cd > 0 ? h('small', {}, `⏳${cd}`) : atk.dmg ? h('small', {}, `💥${atk.dmg}`) : null);
        }),
        merges.length ? h('button', {
          class: `action combine ${pending === 'merge' ? 'active' : ''}`, 'data-attack': 'merge', disabled: !myTurn(),
          onclick: () => { sfx.click(); pending = pending === 'merge' ? null : 'merge'; hint = 'Tap a glowing friend to COMBINE!'; refresh(); },
        }, h('span', { class: 'icon' }, '🤝'), h('span', {}, 'Combine!')) : null) : h('div', { class: 'hint' }, 'Enemy robot — tap one of your robots to command it.'));
  }

  function refresh() {
    updateOverlay();
    renderPanel();
  }

  async function play(events) {
    pending = null;
    refresh();
    await view.play(events);
    refresh();
    if (state.winner) return showResult();
    if (state.team === 'player') autoAdvance();
  }

  function autoAdvance() {
    const ready = aliveUnits(state, 'player').filter((u) => !u.acted);
    if (!ready.length) { finishTurn(); return; }
    const cur = getUnit(state, selected);
    if (!cur || cur.hp <= 0 || cur.acted || cur.team !== 'player') { selected = ready[0].id; refresh(); }
  }

  async function finishTurn() {
    if (!myTurn()) return;
    sfx.click();
    pending = null;
    const events = [...endTurn(state), ...runEnemyTurn(state)];
    await play(events);
    if (!state.winner) {
      const first = aliveUnits(state, 'player')[0];
      if (first && (!getUnit(state, selected) || getUnit(state, selected).team !== 'player')) selected = first.id;
      hint = 'Your turn! Move and attack.';
      refresh();
    }
  }

  function chooseAttack(unit, atk) {
    if (!myTurn()) return;
    sfx.click();
    if (pending === atk) { pending = null; refresh(); return; }
    if (isSelfAction(atk)) { play(performAction(state, unit.id, atk.id)); return; }
    pending = atk;
    hint = atk.type === 'heal' ? 'Tap a friend to repair.' : 'Tap a red target (or a crate) to attack!';
    refresh();
  }

  function onTap(ev) {
    ev.preventDefault();
    if (!myTurn()) return;
    const cell = view.cellFromPoint(ev.clientX, ev.clientY);
    const unitHere = aliveUnits(state).find((u) => u.x === cell.x && u.y === cell.y);
    const cur = getUnit(state, selected);
    if (pending && cur) {
      if (pending === 'merge') {
        if (unitHere && mergeOptions(state, cur.id).includes(unitHere.id)) {
          const events = mergeRobots(state, cur.id, unitHere.id);
          selected = events[0]?.newId || selected;
          hint = 'SUPER ROBOT! Try its ultimate attack next turn.';
          play(events);
          return;
        }
      } else {
        const t = targetsFor(state, cur, pending);
        if (unitHere && t.units.includes(unitHere.id)) { play(performAction(state, cur.id, pending.id, { unitId: unitHere.id })); return; }
        if (!unitHere && cellAt(state.level, cell.x, cell.y) === CRATE && t.cells.some((c) => c.x === cell.x && c.y === cell.y)) {
          play(performAction(state, cur.id, pending.id, { x: cell.x, y: cell.y }));
          return;
        }
      }
      pending = null;
    }
    if (unitHere) {
      sfx.click();
      selected = unitHere.id;
      hint = unitHere.team === 'player' ? 'Tap a blue square to move, then pick an attack!' : `${unitHere.name}: ${unitHere.attacks.filter((a) => a.dmg).map((a) => a.name).join(', ')}`;
      refresh();
      return;
    }
    if (cur && cur.team === 'player' && movesFor(state, cur.id).has(posKey(cell.x, cell.y))) {
      hint = 'Now pick an attack, or Guard.';
      play(moveUnit(state, cur.id, cell.x, cell.y));
      return;
    }
    refresh();
  }

  function showResult() {
    const win = state.winner === 'player';
    win ? sfx.win() : sfx.lose();
    const survivors = aliveUnits(state, 'player');
    root.append(h('div', { class: 'modal', 'data-result': state.winner },
      h('div', { class: 'modal-box' },
        h('h1', {}, win ? '🏆 VICTORY!' : '💥 DEFEATED'),
        h('p', {}, win ? `Your robots won in ${state.round} rounds!` : 'The enemy robots were too strong. Try new parts in the Garage!'),
        win ? h('div', { class: 'row' }, survivors.map((u) => robotPicture(null, 90, 90, u))) : null,
        h('div', { class: 'row' },
          button('🔁 New Level', () => app.go('battle', { robots, difficulty }), { class: 'big', attrs: { 'data-action': 'again' } }),
          button('🔧 Garage', () => app.go('garage'), { class: 'big' }),
          button('🏠 Menu', () => app.go('menu'), { class: 'big' })))));
  }

  canvas.addEventListener('pointerdown', onTap);
  view.attach(state);
  refresh();
  play([{ type: 'turn', team: 'player', round: 1 }]);
  root.cleanup = () => view.stop();
  return root;
}
