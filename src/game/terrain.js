// Grid terrain helpers and pathfinding for walking, climbing, jumping and falling.
export const EMPTY = 0;
export const GROUND = 1;
export const CRATE = 2;
export const SPIKES = 3;

export const cellAt = (level, x, y) => (x < 0 || x >= level.w || y < 0 || y >= level.h ? GROUND : level.cells[y * level.w + x]);
export const setCell = (level, x, y, v) => { level.cells[y * level.w + x] = v; };
export const isSolid = (level, x, y) => { const c = cellAt(level, x, y); return c === GROUND || c === CRATE; };
export const inBounds = (level, x, y) => x >= 0 && x < level.w && y >= 0 && y < level.h;

export function isStandable(level, x, y) {
  return inBounds(level, x, y) && !isSolid(level, x, y) && isSolid(level, x, y + 1);
}

export function standsInColumn(level, x) {
  const list = [];
  if (x < 0 || x >= level.w) return list;
  for (let y = 0; y < level.h; y++) if (isStandable(level, x, y)) list.push(y);
  return list;
}

// Where something at (x, y) ends up after falling.
export function landingY(level, x, y) {
  let ny = y;
  while (ny + 1 < level.h && !isSolid(level, x, ny + 1)) ny++;
  return ny;
}

const clearRange = (level, x, y1, y2) => {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (isSolid(level, x, y)) return false;
  return true;
};

export const posKey = (x, y) => `${x},${y}`;

export function neighbors(level, x, y, mover) {
  const out = [];
  for (const dir of [-1, 1]) {
    const nx = x + dir;
    for (const ny of standsInColumn(level, nx)) {
      if (ny === y) out.push({ x: nx, y: ny, cost: 1, kind: 'walk' });
      else if (ny < y && y - ny <= mover.climb && clearRange(level, x, ny, y) && clearRange(level, nx, ny, ny)) {
        out.push({ x: nx, y: ny, cost: 1 + (y - ny), kind: 'climb' });
      } else if (ny > y && ny - y <= mover.fall && clearRange(level, nx, y, ny)) {
        out.push({ x: nx, y: ny, cost: 1, kind: 'drop' });
      }
    }
    for (let d = 2; d <= mover.jump + 1; d++) {
      const mid = x + dir * (d - 1);
      if (isSolid(level, mid, y) || (y > 0 && isSolid(level, mid, y - 1))) break;
      const jx = x + dir * d;
      for (const ny of standsInColumn(level, jx)) {
        const up = ny < y;
        if (ny < y - 1 || (up && mover.climb < 1) || ny - y > mover.fall) continue;
        if (!clearRange(level, jx, Math.min(y, ny), Math.max(y, ny))) continue;
        out.push({ x: jx, y: ny, cost: d + 1 + (up ? 1 : 0), kind: 'jump' });
      }
    }
  }
  return out;
}

// Dijkstra over standable cells. `blocked` cells (enemies) can't be entered; `passOnly` cells
// (friends) can be walked through but not stopped on, so they are left out of the result.
export function reachable(level, start, mover, budget, blocked = new Set(), passOnly = new Set()) {
  const best = new Map([[posKey(start.x, start.y), { x: start.x, y: start.y, cost: 0, prev: null, kind: 'start' }]]);
  const open = [best.get(posKey(start.x, start.y))];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    if (cur.cost > best.get(posKey(cur.x, cur.y)).cost) continue;
    for (const n of neighbors(level, cur.x, cur.y, mover)) {
      const k = posKey(n.x, n.y);
      const cost = cur.cost + n.cost;
      if (cost > budget || blocked.has(k)) continue;
      const known = best.get(k);
      if (known && known.cost <= cost) continue;
      const node = { x: n.x, y: n.y, cost, prev: cur, kind: n.kind };
      best.set(k, node);
      open.push(node);
    }
  }
  for (const k of passOnly) best.delete(k);
  return best;
}

export function pathTo(map, x, y) {
  const path = [];
  let node = map.get(posKey(x, y));
  while (node) {
    path.unshift({ x: node.x, y: node.y, kind: node.kind });
    node = node.prev;
  }
  return path;
}
