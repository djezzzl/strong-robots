import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, isCrossable, W, H } from '../src/game/level.js';
import { reachable, pathTo, posKey, GROUND, EMPTY, SPIKES, isStandable } from '../src/game/terrain.js';
import { LEGS } from '../src/data/parts.js';

// Builds a level from rows of characters: '#' ground, 'C' crate, '^' spikes, '.' empty.
function levelFrom(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const map = { '#': GROUND, C: 2, '^': SPIKES, '.': EMPTY };
  return { w, h, cells: rows.join('').split('').map((c) => map[c]), crateHp: {} };
}

test('walkers climb 2 but wheels only 1', () => {
  const level = levelFrom([
    '......',
    '...#..',
    '...#..',
    '######',
  ]);
  const walker = reachable(level, { x: 0, y: 2 }, LEGS.walker, 10);
  const wheels = reachable(level, { x: 0, y: 2 }, LEGS.wheels, 10);
  assert.ok(walker.has(posKey(3, 0)));
  assert.ok(walker.has(posKey(5, 2)));
  assert.ok(!wheels.has(posKey(3, 0)));
  assert.ok(!wheels.has(posKey(5, 2)));
});

test('robots jump over gaps and fall down safely', () => {
  const level = levelFrom([
    '......',
    '##.##.',
    '##.##.',
    '##.##.',
    '##^###',
  ]);
  const start = { x: 1, y: 0 };
  const walker = reachable(level, start, LEGS.walker, 10);
  const jump = pathTo(walker, 3, 0);
  assert.equal(jump.at(-1).kind, 'jump');
  assert.ok(walker.has(posKey(5, 3)), 'drops down 3 cells');
  const wheels = reachable(level, start, LEGS.wheels, 10);
  assert.ok(wheels.has(posKey(3, 0)), 'wheels jump a 1-wide gap');
  assert.ok(!wheels.has(posKey(5, 3)), 'wheels cannot fall 3');
});

test('movement respects budget and blocked cells', () => {
  const level = levelFrom(['......', '######']);
  const map = reachable(level, { x: 0, y: 0 }, LEGS.walker, 2, new Set([posKey(2, 0)]));
  assert.ok(map.has(posKey(1, 0)));
  assert.ok(!map.has(posKey(2, 0)));
  assert.ok(!map.has(posKey(4, 0)));
});

test('generated levels are deterministic, crossable and spawn on solid ground', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 40; seed++) {
      const level = generateLevel(diff, seed);
      assert.equal(level.cells.length, W * H);
      assert.ok(isCrossable(level));
      for (const s of [...level.playerSpawns, ...level.enemySpawns]) assert.ok(isStandable(level, s.x, s.y), `${diff} ${seed}`);
    }
    assert.deepEqual(generateLevel(diff, 7).cells, generateLevel(diff, 7).cells);
  }
});

test('robots walk through friends but cannot stop on them', () => {
  const level = levelFrom(['......', '######']);
  const map = reachable(level, { x: 0, y: 0 }, LEGS.walker, 4, new Set([posKey(4, 0)]), new Set([posKey(1, 0)]));
  assert.ok(!map.has(posKey(1, 0)));
  assert.deepEqual(pathTo(map, 2, 0).map((p) => p.x), [0, 1, 2]);
  assert.ok(!map.has(posKey(4, 0)) && !map.has(posKey(5, 0)), 'enemies block the way');
});
