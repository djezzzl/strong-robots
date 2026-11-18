// Enemy brain: picks the best cell + attack + target, otherwise walks toward the closest player robot.
import { aliveUnits, getUnit, movesFor, moveUnit, performAction, mergeOptions, mergeRobots, endTurn, canUse } from './battle.js';
import { targetsFor, stormVictims, baseDamage, dist } from './combat.js';
import { posKey, cellAt, SPIKES } from './terrain.js';

const hazard = (state, cell) => (cellAt(state.level, cell.x, cell.y) === SPIKES ? 15 : 0);

function scoreAttack(state, unit, attack, from) {
  if (attack.type === 'storm') {
    const victims = stormVictims(state, unit, attack, from);
    if (!victims.length) return null;
    const score = victims.reduce((s, v) => s + Math.min(v.hp, baseDamage(attack, unit, v)) + (baseDamage(attack, unit, v) >= v.hp ? 40 : 0), 0);
    return { score, target: {} };
  }
  if (!attack.dmg) return null;
  let best = null;
  for (const tid of targetsFor(state, unit, attack, from).units) {
    const t = getUnit(state, tid);
    const dmg = baseDamage(attack, unit, t);
    const score = Math.min(t.hp, dmg) + (dmg >= t.hp ? 40 : 0) + (attack.splash ? 5 : 0);
    if (!best || score > best.score) best = { score, target: { unitId: tid } };
  }
  return best;
}

export function planFor(state, unit) {
  const moves = movesFor(state, unit.id);
  const options = moves.size ? [...moves.values()] : [{ x: unit.x, y: unit.y, cost: 0 }];
  let best = null;
  for (const cell of options) {
    for (const attack of unit.attacks) {
      if (!canUse(unit, attack)) continue;
      const res = scoreAttack(state, unit, attack, cell);
      if (!res) continue;
      const score = res.score - cell.cost * 0.1 - hazard(state, cell);
      if (!best || score > best.score) best = { score, cell, attack, target: res.target };
    }
  }
  return best;
}

function approach(state, unit) {
  const foes = aliveUnits(state, unit.team === 'enemy' ? 'player' : 'enemy');
  const moves = movesFor(state, unit.id);
  let best = null;
  for (const cell of moves.values()) {
    const d = Math.min(...foes.map((f) => dist(cell, f))) + hazard(state, cell);
    if (!best || d < best.d || (d === best.d && cell.cost < best.cost)) best = { d, x: cell.x, y: cell.y, cost: cell.cost };
  }
  return best;
}

export function actUnit(state, unit) {
  const events = [];
  if (state.difficulty === 'hard') {
    const partner = mergeOptions(state, unit.id)[0];
    if (partner) {
      const evs = mergeRobots(state, unit.id, partner);
      return evs;
    }
  }
  const heal = unit.attacks.find((a) => a.type === 'heal' && canUse(unit, a));
  if (heal && unit.hp < unit.maxHp * 0.4) {
    events.push(...performAction(state, unit.id, heal.id, { unitId: unit.id }));
    return events;
  }
  const plan = planFor(state, unit);
  if (plan) {
    if (plan.cell.x !== unit.x || plan.cell.y !== unit.y) events.push(...moveUnit(state, unit.id, plan.cell.x, plan.cell.y));
    if (!state.winner && unit.hp > 0) events.push(...performAction(state, unit.id, plan.attack.id, plan.target));
    return events;
  }
  const step = approach(state, unit);
  if (step && posKey(step.x, step.y) !== posKey(unit.x, unit.y)) events.push(...moveUnit(state, unit.id, step.x, step.y));
  if (!state.winner && unit.hp > 0) {
    const after = planFor(state, { ...unit, moved: true });
    if (after && after.cell.x === unit.x && after.cell.y === unit.y) events.push(...performAction(state, unit.id, after.attack.id, after.target));
    else events.push(...performAction(state, unit.id, 'guard'));
  }
  return events;
}

// Runs a whole enemy turn and hands control back to the player.
export function runEnemyTurn(state) {
  const events = [];
  if (state.team !== 'enemy') return events;
  const done = new Set();
  for (let guard = 0; guard < 20 && !state.winner; guard++) {
    const unit = aliveUnits(state, 'enemy').find((u) => !done.has(u.id) && !u.acted);
    if (!unit) break;
    done.add(unit.id);
    events.push(...actUnit(state, unit));
  }
  events.push(...endTurn(state));
  return events;
}
