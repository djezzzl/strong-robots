// Power Test: hit a wall with your robot's attacks and see how fast it breaks.
import { createRng } from '../core/rng.js';
import { buildUnit } from './robot.js';
import { baseDamage } from './combat.js';

export const WALLS = {
  easy: { id: 'easy', name: 'Brick Wall', hp: 100, armor: 2, color: '#c0583a' },
  normal: { id: 'normal', name: 'Steel Wall', hp: 260, armor: 5, color: '#90a4ae' },
  hard: { id: 'hard', name: 'Titanium Vault', hp: 600, armor: 10, color: '#5c6bc0' },
};

export const MAX_TURNS = 6;

export function createWallTest(blueprint, difficulty = 'easy', seed = Date.now()) {
  const wall = WALLS[difficulty] || WALLS.easy;
  return {
    unit: buildUnit(blueprint),
    wall: { ...wall, maxHp: wall.hp },
    turn: 1,
    maxTurns: MAX_TURNS,
    totalDamage: 0,
    done: false,
    broken: false,
    stars: 0,
    rng: createRng(seed),
  };
}

export const usableAttacks = (state) => state.unit.attacks.filter((a) => a.dmg || a.type === 'buff');
export const isReady = (state, attack) => !(state.unit.cooldowns[attack.id] > 0);

export function starsFor(turnsUsed, broken) {
  if (!broken) return 0;
  if (turnsUsed <= 3) return 3;
  if (turnsUsed <= 5) return 2;
  return 1;
}

export function useWallAttack(state, attackId) {
  const events = [];
  const attack = state.unit.attacks.find((a) => a.id === attackId);
  if (state.done || !attack || !isReady(state, attack) || !(attack.dmg || attack.type === 'buff')) return events;
  const { unit, wall } = state;
  if (attack.type === 'buff') {
    unit.lockOn = true;
    events.push({ type: 'buff', name: attack.name });
  } else {
    const amount = Math.max(1, Math.round(baseDamage(attack, unit, wall) * (0.9 + state.rng.next() * 0.2)));
    wall.hp = Math.max(0, wall.hp - amount);
    state.totalDamage += amount;
    unit.lockOn = false;
    events.push({ type: 'hit', attack, amount, hp: wall.hp });
  }
  for (const k of Object.keys(unit.cooldowns)) unit.cooldowns[k] = Math.max(0, unit.cooldowns[k] - 1);
  if (attack.cooldown) unit.cooldowns[attack.id] = attack.cooldown;
  if (wall.hp === 0) {
    state.done = true;
    state.broken = true;
    state.stars = starsFor(state.turn, true);
    events.push({ type: 'broken', stars: state.stars, turns: state.turn });
  } else if (state.turn >= state.maxTurns) {
    state.done = true;
    events.push({ type: 'timeout', percent: Math.round((state.totalDamage / wall.maxHp) * 100) });
  } else {
    state.turn++;
  }
  return events;
}
