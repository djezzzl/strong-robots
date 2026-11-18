// Combining robots into super robots. Only certain body-core combinations match.
import { LEGS } from '../data/parts.js';

export const RECIPES = [
  { cores: ['Car', 'Jet'], name: 'Sky Racer', legs: 'jets', ultimate: { id: 'ult-skystorm', name: 'Sky Storm', icon: '🌪️', type: 'storm', dmg: 22, range: 8, pierce: 0.4 } },
  { cores: ['Beast', 'Titan'], name: 'Mega Beast', ultimate: { id: 'ult-megaroar', name: 'Mega Roar', icon: '🦁', type: 'melee', dmg: 34, range: 2, pierce: 0.5, splash: true } },
  { cores: ['Tank', 'Titan'], name: 'Iron Fortress', legs: 'tracks', ultimate: { id: 'ult-barrage', name: 'Fortress Barrage', icon: '🏰', type: 'arc', dmg: 40, range: 8, minRange: 1, pierce: 0.4, splash: true } },
  { cores: ['Car', 'Tank'], name: 'Road Crusher', legs: 'tracks', ultimate: { id: 'ult-crusher', name: 'Crusher Charge', icon: '🚚', type: 'melee', dmg: 45, range: 1, pierce: 0.6, knockback: 2 } },
  { cores: ['Beast', 'Jet'], name: 'Dragon Knight', legs: 'jets', ultimate: { id: 'ult-dragonflame', name: 'Dragon Flame', icon: '🐉', type: 'beam', dmg: 36, range: 7, pierce: 0.5 } },
  { cores: ['Car', 'Jet', 'Titan'], name: 'Omega Prime', legs: 'jets', ultimate: { id: 'ult-omega', name: 'Omega Cannon', icon: '☄️', type: 'beam', dmg: 60, range: 10, pierce: 0.8 } },
  { cores: ['Beast', 'Tank', 'Titan'], name: 'Giga Rex', legs: 'spider', ultimate: { id: 'ult-gigastomp', name: 'Giga Stomp', icon: '🦖', type: 'storm', dmg: 45, range: 3, pierce: 0.5 } },
  { cores: ['Beast', 'Car', 'Jet'], name: 'Thunder Dragon', legs: 'jets', ultimate: { id: 'ult-thunder', name: 'Thunder Storm', icon: '🌩️', type: 'storm', dmg: 30, range: 99, pierce: 0.5 } },
];

const key = (cores) => [...cores].sort().join('+');
const RECIPE_BY_KEY = new Map(RECIPES.map((r) => [key(r.cores), r]));

export function recipeFor(cores) {
  if (new Set(cores).size !== cores.length) return null;
  return RECIPE_BY_KEY.get(key(cores)) || null;
}

export function canMerge(a, b) {
  if (!a || !b || a.id === b.id || a.team !== b.team || a.hp <= 0 || b.hp <= 0) return false;
  return Boolean(recipeFor([...a.cores, ...b.cores]));
}

// Cores this core can combine with directly (used for garage hints).
export function partnersFor(core) {
  const result = new Set();
  for (const r of RECIPES) if (r.cores.length === 2 && r.cores.includes(core)) r.cores.filter((c) => c !== core).forEach((c) => result.add(c));
  return [...result].sort();
}

export function mergeUnits(a, b, newId) {
  const cores = [...a.cores, ...b.cores];
  const recipe = recipeFor(cores);
  if (!recipe) throw new Error('These robots cannot combine');
  const best = [a, b].reduce((p, c) => (c.move + c.climb > p.move + p.climb ? c : p));
  const legs = recipe.legs ? LEGS[recipe.legs] : null;
  const attacks = [];
  for (const atk of [...a.attacks, ...b.attacks]) {
    if (atk.id.startsWith('ult-')) continue;
    if (!attacks.some((x) => x.id === atk.id)) attacks.push({ ...atk });
  }
  const guardIdx = attacks.findIndex((x) => x.id === 'guard');
  const guard = attacks.splice(guardIdx, 1)[0];
  attacks.unshift({ ...recipe.ultimate, cooldown: 3 });
  attacks.push(guard);
  const maxHp = a.maxHp + b.maxHp + 20;
  return {
    ...a,
    id: newId,
    name: recipe.name,
    blueprints: [...a.blueprints, ...b.blueprints],
    cores,
    recipe: recipe.name,
    maxHp,
    hp: Math.min(maxHp, a.hp + b.hp + 20),
    armor: Math.max(a.armor, b.armor) + 2,
    move: legs ? Math.max(best.move, legs.move) : best.move,
    climb: legs ? Math.max(best.climb, legs.climb) : best.climb,
    jump: legs ? Math.max(best.jump, legs.jump) : best.jump,
    fall: legs ? Math.max(best.fall, legs.fall) : best.fall,
    legsId: legs ? legs.id : best.legsId,
    meleeBonus: Math.max(a.meleeBonus, b.meleeBonus),
    strongGuard: a.strongGuard || b.strongGuard,
    attacks,
    cooldowns: {},
    guarding: false,
    lockOn: a.lockOn || b.lockOn,
    acted: true,
    scale: cores.length === 3 ? 1.6 : 1.35,
  };
}
