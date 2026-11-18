// Random battlefield generator. Every level is guaranteed crossable by a robot on wheels.
import { createRng } from '../core/rng.js';
import { LEGS } from '../data/parts.js';
import { EMPTY, GROUND, CRATE, SPIKES, setCell, reachable, posKey } from './terrain.js';

export const DIFFICULTY = {
  easy: { label: 'Easy', enemies: 2, pits: 1, pitWidth: 1, crates: 3, platforms: 1, hpScale: 0.8, dmgScale: 0.65, tier: 1 },
  normal: { label: 'Normal', enemies: 3, pits: 2, pitWidth: 2, crates: 5, platforms: 2, hpScale: 1, dmgScale: 0.85, tier: 2 },
  hard: { label: 'Hard', enemies: 4, pits: 3, pitWidth: 2, crates: 7, platforms: 3, hpScale: 1.25, dmgScale: 1, tier: 3 },
};

export const W = 18;
export const H = 10;

function tryGenerate(rng, cfg) {
  const level = { w: W, h: H, cells: new Array(W * H).fill(EMPTY), crateHp: {} };
  const top = [];
  let t = rng.int(6, 7);
  for (let x = 0; x < W; x++) {
    const inSpawn = x <= 2 || x >= W - 3;
    if (!inSpawn && x !== 3 && rng.chance(0.55)) t += rng.pick([-1, 1]);
    t = Math.max(4, Math.min(H - 2, t));
    top.push(t);
  }
  const pits = new Set();
  for (let p = 0, tries = 0; p < cfg.pits && tries < 30; tries++) {
    const width = rng.int(1, cfg.pitWidth);
    const start = rng.int(4, W - 5 - width);
    const edgeL = start - 1;
    const edgeR = start + width;
    const clash = [edgeL, ...Array.from({ length: width }, (_, i) => start + i), edgeR].some((x) => pits.has(x));
    if (clash || top[edgeL] !== top[edgeR]) continue;
    // Narrow pits are deep (jump over them); wide pits are shallow (walk through the spikes).
    const floor = width === 1 ? H - 1 : Math.min(H - 1, top[edgeL] + 1);
    for (let x = start; x < edgeR; x++) { top[x] = floor; pits.add(x); }
    p++;
  }
  for (let x = 0; x < W; x++) {
    for (let y = top[x]; y < H; y++) setCell(level, x, y, GROUND);
    if (pits.has(x)) setCell(level, x, top[x] - 1, SPIKES);
  }
  for (let i = 0; i < cfg.platforms; i++) {
    const len = rng.int(2, 4);
    const sx = rng.int(4, W - 5 - len);
    const py = Math.min(...top.slice(sx, sx + len)) - rng.int(3, 4);
    if (py < 1) continue;
    for (let x = sx; x < sx + len; x++) setCell(level, x, py, GROUND);
  }
  let crates = 0;
  for (let attempt = 0; attempt < 40 && crates < cfg.crates; attempt++) {
    const x = rng.int(4, W - 5);
    const y = top[x] - 1;
    // A crate must only make a 1-high step, so its neighbours can't be lower ground or pits.
    const ok = !pits.has(x) && !pits.has(x - 1) && !pits.has(x + 1) && top[x - 1] <= top[x] && top[x + 1] <= top[x];
    if (!ok || level.cells[y * W + x] !== EMPTY || level.cells[(y - 1) * W + x] !== EMPTY || level.cells[(y - 2) * W + x] !== EMPTY) continue;
    setCell(level, x, y, CRATE);
    level.crateHp[posKey(x, y)] = 30;
    crates++;
  }
  const players = [0, 1, 2].map((x) => ({ x, y: top[x] - 1 }));
  const enemyCols = [W - 1, W - 2, W - 3, W - 4].slice(0, cfg.enemies);
  const enemies = enemyCols.map((x) => {
    let y = 0;
    while (y + 1 < H && !(level.cells[(y + 1) * W + x] === GROUND || level.cells[(y + 1) * W + x] === CRATE)) y++;
    return { x, y };
  });
  level.playerSpawns = players;
  level.enemySpawns = enemies;
  return level;
}

// Both sides must be able to reach each other (one-way drops would trap robots).
export function isCrossable(level) {
  const fromPlayer = reachable(level, level.playerSpawns[0], LEGS.wheels, Infinity);
  const fromEnemy = reachable(level, level.enemySpawns[0], LEGS.wheels, Infinity);
  return level.enemySpawns.every((s) => fromPlayer.has(posKey(s.x, s.y)))
    && level.playerSpawns.every((s) => fromEnemy.has(posKey(s.x, s.y)));
}

export function generateLevel(difficulty = 'easy', seed = Date.now()) {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  const rng = createRng(seed);
  for (let i = 0; i < 300; i++) {
    // Wide pits can make a level impossible on wheels; narrow them if we keep failing.
    const level = tryGenerate(rng, i < 100 ? cfg : { ...cfg, pitWidth: 1, crates: Math.min(cfg.crates, 4) });
    if (isCrossable(level)) return { ...level, difficulty, seed };
  }
  throw new Error('Could not generate a crossable level');
}
