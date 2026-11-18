// Battle state machine. Every action mutates state and returns events for the view to animate.
import { createRng } from '../core/rng.js';
import { HEADS, ARMS, LEGS } from '../data/parts.js';
import { buildUnit } from './robot.js';
import { canMerge, mergeUnits, recipeFor, RECIPES } from './merge.js';
import { generateLevel, DIFFICULTY } from './level.js';
import { reachable, pathTo, posKey, cellAt, setCell, isSolid, landingY, EMPTY, SPIKES, CRATE } from './terrain.js';
import { targetsFor, stormVictims, rollDamage, dist, isDamaging } from './combat.js';

const ENEMY_POOLS = {
  1: { heads: ['visor', 'helm'], arms: ['blaster', 'fist', 'saw', 'shield'], legs: ['walker', 'wheels', 'tracks'] },
  2: { heads: ['visor', 'helm', 'radar', 'dragon'], arms: ['blaster', 'lance', 'cannon', 'fist', 'saw', 'hammer', 'shield'], legs: ['walker', 'wheels', 'tracks', 'spider'] },
  3: { heads: Object.keys(HEADS), arms: Object.keys(ARMS), legs: Object.keys(LEGS) },
};
const BODY_BY_CORE = { Car: 'racer', Jet: 'jet', Titan: 'titan', Beast: 'beast', Tank: 'tank' };
const ENEMY_NAMES = ['Drone', 'Crusher', 'Vexor', 'Spike', 'Gloom', 'Rustor', 'Zapper', 'Ravage', 'Krank', 'Shadow'];
const ENEMY_COLORS = ['#5d4037', '#455a64', '#6a1b9a', '#b71c1c', '#37474f', '#4e342e'];

export function randomEnemyBlueprint(rng, tier, core) {
  const pool = ENEMY_POOLS[tier];
  const body = core ? BODY_BY_CORE[core] : rng.pick(tier === 1 ? ['racer', 'beast', 'jet'] : Object.values(BODY_BY_CORE));
  let left = rng.pick(pool.arms);
  if (left === 'shield') left = 'blaster';
  return {
    name: rng.pick(ENEMY_NAMES), color: rng.pick(ENEMY_COLORS),
    head: rng.pick(pool.heads), body, left, right: rng.pick(pool.arms), legs: rng.pick(pool.legs),
  };
}

export function createBattle({ blueprints, difficulty = 'easy', seed = Date.now() }) {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  const level = generateLevel(difficulty, seed);
  const rng = createRng(seed ^ 0x9e3779b9);
  const state = { level, rng, difficulty, team: 'player', round: 1, nextId: 1, winner: null, units: [] };
  blueprints.slice(0, 3).forEach((bp, i) => {
    const s = level.playerSpawns[i];
    state.units.push(buildUnit(bp, { id: `p${state.nextId++}`, team: 'player', x: s.x, y: s.y }));
  });
  // On hard, the first two enemies are a matching pair so they can combine.
  const pairCores = difficulty === 'hard' ? rng.pick(RECIPES.filter((r) => r.cores.length === 2)).cores : [];
  level.enemySpawns.forEach((s, i) => {
    const bp = randomEnemyBlueprint(rng, cfg.tier, pairCores[i]);
    const enemy = buildUnit(bp, { id: `e${state.nextId++}`, team: 'enemy', x: s.x, y: s.y, hpScale: cfg.hpScale });
    enemy.dmgScale = cfg.dmgScale;
    state.units.push(enemy);
  });
  return state;
}

export const getUnit = (state, id) => state.units.find((u) => u.id === id);
export const aliveUnits = (state, team) => state.units.filter((u) => u.hp > 0 && (!team || u.team === team));

export function occupied(state, exceptId, team) {
  return new Set(aliveUnits(state).filter((u) => u.id !== exceptId && (!team || u.team === team)).map((u) => posKey(u.x, u.y)));
}

export function movesFor(state, id) {
  const unit = getUnit(state, id);
  if (!unit || unit.hp <= 0 || unit.moved || unit.team !== state.team || state.winner) return new Map();
  const foe = unit.team === 'player' ? 'enemy' : 'player';
  return reachable(state.level, unit, unit, unit.move, occupied(state, id, foe), occupied(state, id, unit.team));
}

function damageUnit(state, target, amount, events) {
  if (target.hp <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: 'damage', id: target.id, amount, hp: target.hp });
  if (target.hp === 0) events.push({ type: 'destroy', id: target.id });
}

function applyGravity(state, events) {
  for (const u of aliveUnits(state)) {
    if (isSolid(state.level, u.x, u.y + 1)) continue;
    const from = { x: u.x, y: u.y };
    let land = landingY(state.level, u.x, u.y);
    const blocker = aliveUnits(state).find((o) => o !== u && o.x === u.x && o.y > u.y && o.y <= land);
    if (blocker) land = blocker.y - 1;
    u.y = land;
    events.push({ type: 'fall', id: u.id, from, to: { x: u.x, y: u.y } });
    const drop = land - from.y;
    if (drop > u.fall) damageUnit(state, u, 6 * (drop - u.fall), events);
    if (cellAt(state.level, u.x, u.y) === SPIKES) damageUnit(state, u, 8, events);
  }
}

function damageCrate(state, x, y, amount, events) {
  const key = posKey(x, y);
  if (cellAt(state.level, x, y) !== CRATE) return;
  state.level.crateHp[key] = (state.level.crateHp[key] ?? 30) - amount;
  const broken = state.level.crateHp[key] <= 0;
  events.push({ type: 'crate', x, y, amount, broken });
  if (broken) {
    setCell(state.level, x, y, EMPTY);
    delete state.level.crateHp[key];
    applyGravity(state, events);
  }
}

function checkWinner(state, events) {
  if (state.winner) return;
  if (aliveUnits(state, 'enemy').length === 0) state.winner = 'player';
  else if (aliveUnits(state, 'player').length === 0) state.winner = 'enemy';
  if (state.winner) events.push({ type: 'end', winner: state.winner });
}

export function moveUnit(state, id, x, y) {
  const events = [];
  const map = movesFor(state, id);
  const unit = getUnit(state, id);
  if (!map.has(posKey(x, y))) return events;
  const path = pathTo(map, x, y);
  if (x !== unit.x) unit.facing = x > unit.x ? 1 : -1;
  unit.x = x;
  unit.y = y;
  unit.moved = true;
  events.push({ type: 'move', id, path });
  if (cellAt(state.level, x, y) === SPIKES) damageUnit(state, unit, 8, events);
  checkWinner(state, events);
  return events;
}

export function canUse(unit, attack) {
  return unit.hp > 0 && !unit.acted && !(unit.cooldowns[attack.id] > 0);
}

function knockback(state, attacker, target, power, events) {
  const dir = Math.sign(target.x - attacker.x) || attacker.facing;
  for (let i = 0; i < power && target.hp > 0; i++) {
    const nx = target.x + dir;
    const blocked = isSolid(state.level, nx, target.y) || aliveUnits(state).some((u) => u.x === nx && u.y === target.y);
    if (blocked) { damageUnit(state, target, 5, events); break; }
    const from = { x: target.x, y: target.y };
    target.x = nx;
    events.push({ type: 'push', id: target.id, from, to: { x: nx, y: target.y } });
    applyGravity(state, events);
  }
}

// target: { unitId } or { x, y } for crates; ignored for self actions and storms.
export function performAction(state, id, attackId, target = {}) {
  const events = [];
  const unit = getUnit(state, id);
  if (!unit || unit.team !== state.team || state.winner) return events;
  const attack = unit.attacks.find((a) => a.id === attackId);
  if (!attack || !canUse(unit, attack)) return events;

  if (attack.type === 'guard') {
    unit.guarding = true;
    events.push({ type: 'guard', id });
  } else if (attack.type === 'buff') {
    unit.lockOn = true;
    events.push({ type: 'buff', id, name: attack.name });
  } else if (attack.type === 'heal') {
    const t = getUnit(state, target.unitId);
    if (!t || !targetsFor(state, unit, attack).units.includes(t.id)) return events;
    const amount = Math.min(attack.heal, t.maxHp - t.hp);
    t.hp += amount;
    events.push({ type: 'attack', id, attack, from: { x: unit.x, y: unit.y }, to: { x: t.x, y: t.y } });
    events.push({ type: 'heal', id: t.id, amount, hp: t.hp });
  } else if (attack.type === 'storm') {
    const victims = stormVictims(state, unit, attack);
    events.push({ type: 'attack', id, attack, from: { x: unit.x, y: unit.y }, to: { x: unit.x, y: unit.y }, targets: victims.map((v) => ({ x: v.x, y: v.y })) });
    for (const v of victims) damageUnit(state, v, rollDamage(attack, unit, v, state.rng), events);
    unit.lockOn = false;
  } else {
    const valid = targetsFor(state, unit, attack);
    const t = target.unitId ? getUnit(state, target.unitId) : null;
    if (t && !valid.units.includes(t.id)) return events;
    if (!t && !valid.cells.some((c) => c.x === target.x && c.y === target.y)) return events;
    const to = t ? { x: t.x, y: t.y } : { x: target.x, y: target.y };
    if (to.x !== unit.x) unit.facing = to.x > unit.x ? 1 : -1;
    events.push({ type: 'attack', id, attack, from: { x: unit.x, y: unit.y }, to });
    if (t) damageUnit(state, t, rollDamage(attack, unit, t, state.rng), events);
    else damageCrate(state, to.x, to.y, Math.round(attack.dmg * (unit.lockOn ? 1.6 : 1)), events);
    if (attack.splash) {
      for (const o of aliveUnits(state)) {
        if (o.team !== unit.team && o !== t && dist(o, to) <= 1) damageUnit(state, o, Math.round(rollDamage(attack, unit, o, state.rng) / 2), events);
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && cellAt(state.level, to.x + dx, to.y + dy) === CRATE) damageCrate(state, to.x + dx, to.y + dy, 15, events);
      }
    }
    if (t && attack.knockback && t.hp > 0) knockback(state, unit, t, attack.knockback, events);
    unit.lockOn = false;
  }
  unit.acted = true;
  unit.moved = true;
  if (attack.cooldown) unit.cooldowns[attack.id] = attack.cooldown + 1;
  checkWinner(state, events);
  return events;
}

export function mergeOptions(state, id) {
  const unit = getUnit(state, id);
  if (!unit || unit.acted || unit.team !== state.team || state.winner) return [];
  return aliveUnits(state, unit.team).filter((o) => dist(o, unit) <= 1 && canMerge(unit, o)).map((o) => o.id);
}

// Every teammate this unit could combine with, near or far, so the UI can guide the player to them.
export function combinePartners(state, id) {
  const unit = getUnit(state, id);
  if (!unit || unit.acted || unit.team !== state.team || state.winner) return [];
  return aliveUnits(state, unit.team).filter((o) => canMerge(unit, o)).map((o) => ({
    id: o.id, name: o.name, recipe: recipeFor([...unit.cores, ...o.cores]).name, near: dist(o, unit) <= 1,
  }));
}

export function mergeRobots(state, id, partnerId) {
  if (!mergeOptions(state, id).includes(partnerId)) return [];
  const a = getUnit(state, id);
  const b = getUnit(state, partnerId);
  const merged = mergeUnits(a, b, `${a.team[0]}${state.nextId++}`);
  state.units = state.units.filter((u) => u !== a && u !== b);
  state.units.push(merged);
  const events = [{ type: 'merge', ids: [a.id, b.id], newId: merged.id, name: merged.name, at: { x: merged.x, y: merged.y }, from: { x: b.x, y: b.y } }];
  applyGravity(state, events);
  return events;
}

function startTeamTurn(state, team, events) {
  state.team = team;
  if (team === 'player') state.round++;
  events.push({ type: 'turn', team, round: state.round });
  for (const u of aliveUnits(state, team)) {
    u.moved = false;
    u.acted = false;
    u.guarding = false;
    for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
    if (cellAt(state.level, u.x, u.y) === SPIKES) damageUnit(state, u, 8, events);
  }
  checkWinner(state, events);
}

export function endTurn(state) {
  const events = [];
  if (state.winner) return events;
  startTeamTurn(state, state.team === 'player' ? 'enemy' : 'player', events);
  return events;
}

export function hasDamagingTarget(state, unit, attack, from) {
  return isDamaging(attack) && (attack.type === 'storm' ? stormVictims(state, unit, attack, from).length > 0 : targetsFor(state, unit, attack, from).units.length > 0);
}
