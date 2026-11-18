// Garage persistence in localStorage (falls back to memory when storage is unavailable).
import { normalizeBlueprint } from './game/robot.js';

const KEY = 'strong-robots-garage-v1';
export const MAX_ROBOTS = 4;

export const STARTER_ROBOTS = [
  { name: 'Blaze', color: '#e53935', head: 'visor', body: 'racer', left: 'blaster', right: 'fist', legs: 'wheels' },
  { name: 'Skyhawk', color: '#1e88e5', head: 'radar', body: 'jet', left: 'missile', right: 'lance', legs: 'jets' },
  { name: 'Goliath', color: '#43a047', head: 'helm', body: 'titan', left: 'hammer', right: 'shield', legs: 'walker' },
];

export function loadGarage(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage?.getItem(KEY) || 'null');
    if (Array.isArray(data?.robots) && data.robots.length) {
      return { robots: data.robots.slice(0, MAX_ROBOTS).map(normalizeBlueprint), stars: data.stars || {} };
    }
  } catch { /* corrupted save: start fresh */ }
  return { robots: STARTER_ROBOTS.map(normalizeBlueprint), stars: {} };
}

export function saveGarage(garage, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(garage));
  } catch { /* storage full or blocked: ignore */ }
}
