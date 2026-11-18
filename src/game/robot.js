// Turns a blueprint (chosen parts) into a battle-ready unit with stats and attacks.
import { HEADS, BODIES, ARMS, LEGS, GUARD, KICK } from '../data/parts.js';

export const DEFAULT_BLUEPRINT = { name: 'Robo', color: '#1e88e5', head: 'visor', body: 'racer', left: 'blaster', right: 'fist', legs: 'walker' };

export function normalizeBlueprint(bp = {}) {
  const pick = (table, key, fallback) => (table[bp[key]] ? bp[key] : fallback);
  return {
    name: typeof bp.name === 'string' && bp.name.trim() ? bp.name.trim().slice(0, 14) : DEFAULT_BLUEPRINT.name,
    color: typeof bp.color === 'string' ? bp.color : DEFAULT_BLUEPRINT.color,
    head: pick(HEADS, 'head', DEFAULT_BLUEPRINT.head),
    body: pick(BODIES, 'body', DEFAULT_BLUEPRINT.body),
    left: pick(ARMS, 'left', DEFAULT_BLUEPRINT.left),
    right: pick(ARMS, 'right', DEFAULT_BLUEPRINT.right),
    legs: pick(LEGS, 'legs', DEFAULT_BLUEPRINT.legs),
  };
}

function collectAttacks(bp, head) {
  const attacks = [];
  const left = ARMS[bp.left].attack;
  const right = ARMS[bp.right].attack;
  if (left && right && left.id === right.id) {
    const boosted = left.type === 'heal' ? { heal: Math.round(left.heal * 1.5) } : { dmg: Math.round(left.dmg * 1.6) };
    attacks.push({ ...left, ...boosted, id: `double-${left.id}`, name: `Double ${left.name}` });
  } else {
    if (left) attacks.push({ ...left });
    if (right) attacks.push({ ...right });
  }
  if (head.skill) attacks.push({ ...head.skill });
  return attacks.map((a) => (a.type === 'beam' && head.beamRange ? { ...a, range: a.range + head.beamRange } : a));
}

export function buildUnit(blueprint, { id = 'u1', team = 'player', x = 0, y = 0, hpScale = 1 } = {}) {
  const bp = normalizeBlueprint(blueprint);
  const head = HEADS[bp.head];
  const body = BODIES[bp.body];
  const legs = LEGS[bp.legs];
  const arms = [ARMS[bp.left], ARMS[bp.right]];
  const armor = body.armor + (head.armor || 0) + (legs.armor || 0) + arms.reduce((s, a) => s + (a.armor || 0), 0);
  const maxHp = Math.round(body.hp * hpScale);
  const attacks = collectAttacks(bp, head);
  attacks.push({ ...KICK }, { ...GUARD });
  return {
    id, team, x, y,
    name: bp.name,
    color: bp.color,
    blueprints: [bp],
    cores: [body.core],
    recipe: null,
    maxHp, hp: maxHp, armor,
    move: Math.max(2, legs.move + (body.move || 0)),
    climb: legs.climb,
    jump: legs.jump + (body.jump || 0),
    fall: legs.fall,
    legsId: legs.id,
    meleeBonus: body.melee || 0,
    strongGuard: arms.some((a) => a.guard),
    attacks,
    cooldowns: {},
    guarding: false,
    lockOn: false,
    moved: false,
    acted: false,
    facing: team === 'player' ? 1 : -1,
    scale: 1,
  };
}

// A single number for kids to compare robots in the garage.
export function powerRating(blueprint) {
  const u = buildUnit(blueprint);
  const offense = u.attacks.reduce((s, a) => s + (a.dmg || 0) * (1 + (a.pierce || 0)) / Math.max(1, (a.cooldown || 0)), 0);
  return Math.round(offense + u.maxHp * 0.6 + u.armor * 6 + u.move * 4);
}
