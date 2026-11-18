// Attack rules: ranges, line of sight, damage. Pure functions over battle state.
import { isSolid, cellAt, CRATE, posKey } from './terrain.js';

export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function hasLineOfSight(level, from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * 4;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.round(from.x + (to.x - from.x) * t);
    const cy = Math.round(from.y + (to.y - from.y) * t);
    if ((cx === from.x && cy === from.y) || (cx === to.x && cy === to.y)) continue;
    if (isSolid(level, cx, cy)) return false;
  }
  return true;
}

export function inRange(level, attack, from, to) {
  const d = dist(from, to);
  if (d > attack.range || d < (attack.minRange || 0)) return false;
  if (attack.type === 'beam' || attack.type === 'melee') return hasLineOfSight(level, from, to);
  return true;
}

export const isSelfAction = (attack) => attack.type === 'guard' || attack.type === 'buff' || attack.type === 'storm';
export const isDamaging = (attack) => Boolean(attack.dmg);

export function baseDamage(attack, attacker, defender) {
  let dmg = attack.dmg * (attack.type === 'melee' ? 1 + (attacker.meleeBonus || 0) : 1);
  if (attacker.lockOn) dmg *= 1.6;
  dmg *= attacker.dmgScale ?? 1;
  dmg = Math.max(1, dmg - (defender.armor || 0) * (1 - (attack.pierce || 0)));
  if (defender.guarding) dmg *= defender.strongGuard ? 0.35 : 0.5;
  return dmg;
}

export function rollDamage(attack, attacker, defender, rng) {
  return Math.max(1, Math.round(baseDamage(attack, attacker, defender) * (0.9 + rng.next() * 0.2)));
}

// Units and crates this attack can hit when fired from `from`.
export function targetsFor(state, unit, attack, from = unit) {
  const alive = state.units.filter((u) => u.hp > 0);
  if (attack.type === 'heal') {
    return { units: alive.filter((u) => u.team === unit.team && u.hp < u.maxHp && dist(from, u) <= attack.range).map((u) => u.id), cells: [] };
  }
  if (isSelfAction(attack)) return { units: [], cells: [] };
  const units = alive.filter((u) => u.team !== unit.team && inRange(state.level, attack, from, u)).map((u) => u.id);
  const cells = [];
  const { level } = state;
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      if (cellAt(level, x, y) === CRATE && inRange(level, attack, from, { x, y })) cells.push({ x, y });
    }
  }
  return { units, cells };
}

export function stormVictims(state, unit, attack, from = unit) {
  return state.units.filter((u) => u.hp > 0 && u.team !== unit.team && dist(from, u) <= attack.range);
}

export const crateKey = posKey;
