import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, moveUnit, performAction, mergeOptions, mergeRobots, endTurn, aliveUnits, getUnit, movesFor } from '../src/game/battle.js';
import { runEnemyTurn } from '../src/game/ai.js';
import { hasLineOfSight, baseDamage } from '../src/game/combat.js';
import { GROUND, EMPTY, CRATE, posKey } from '../src/game/terrain.js';
import { createWallTest, useWallAttack, starsFor } from '../src/game/walltest.js';
import { createRng } from '../src/core/rng.js';

const bp = (body, extra = {}) => ({ name: 'T', color: '#fff', head: 'visor', body, left: 'blaster', right: 'fist', legs: 'walker', ...extra });

// A flat 10x4 arena so tests control positions exactly.
function arena(state) {
  const w = 10;
  const h = 4;
  state.level = { w, h, cells: new Array(w * h).fill(EMPTY), crateHp: {} };
  for (let x = 0; x < w; x++) state.level.cells[(h - 1) * w + x] = GROUND;
  return state;
}

function setup(players, enemies) {
  const state = arena(createBattle({ blueprints: players, difficulty: 'easy', seed: 3 }));
  state.units = state.units.filter((u) => u.team === 'player');
  state.units.forEach((u, i) => Object.assign(u, { x: i, y: 2 }));
  enemies.forEach((e, i) => {
    const enemy = createBattle({ blueprints: [e], seed: 5 }).units[0];
    Object.assign(enemy, { id: `e${i}`, team: 'enemy', x: 9 - i, y: 2, facing: -1 });
    state.units.push(enemy);
  });
  return state;
}

test('rng is deterministic', () => {
  const a = createRng(42);
  const b = createRng(42);
  assert.deepEqual([a.next(), a.int(1, 6)], [b.next(), b.int(1, 6)]);
});

test('battles start with player and enemy robots on spawns', () => {
  const s = createBattle({ blueprints: [bp('racer'), bp('jet')], difficulty: 'normal', seed: 11 });
  assert.equal(aliveUnits(s, 'player').length, 2);
  assert.equal(aliveUnits(s, 'enemy').length, 3);
  const hard = createBattle({ blueprints: [bp('racer')], difficulty: 'hard', seed: 11 });
  const [e1, e2] = aliveUnits(hard, 'enemy');
  assert.equal(mergeOptions({ ...hard, team: 'enemy' }, e1.id)[0], e2.id, 'hard enemies start as a combinable pair');
});

test('move then attack; cannot move twice', () => {
  const s = setup([bp('racer')], [bp('beast')]);
  const p = s.units[0];
  const ev = moveUnit(s, p.id, 3, 2);
  assert.equal(ev[0].type, 'move');
  assert.equal(movesFor(s, p.id).size, 0);
  const before = getUnit(s, 'e0').hp;
  const atk = performAction(s, p.id, 'blaster', { unitId: 'e0' });
  assert.ok(atk.some((e) => e.type === 'damage'));
  assert.ok(getUnit(s, 'e0').hp < before);
  assert.deepEqual(performAction(s, p.id, 'blaster', { unitId: 'e0' }), [], 'only one action per turn');
});

test('beams need line of sight but cannons lob over walls', () => {
  const s = setup([bp('racer', { right: 'cannon' })], [bp('beast')]);
  s.level.cells[2 * 10 + 5] = GROUND;
  assert.ok(!hasLineOfSight(s.level, { x: 0, y: 2 }, { x: 9, y: 2 }));
  assert.deepEqual(performAction(s, s.units[0].id, 'blaster', { unitId: 'e0' }), []);
  moveUnit(s, s.units[0].id, 3, 2);
  assert.ok(performAction(s, s.units[0].id, 'cannon', { unitId: 'e0' }).some((e) => e.type === 'damage'));
});

test('guard halves damage and armor reduces it', () => {
  const atk = { dmg: 20, type: 'beam' };
  assert.equal(baseDamage(atk, {}, { armor: 4 }), 16);
  assert.equal(baseDamage(atk, {}, { armor: 4, guarding: true }), 8);
  assert.equal(baseDamage({ ...atk, pierce: 0.5 }, {}, { armor: 4 }), 18);
});

test('breaking a crate makes the robot on top fall', () => {
  const s = setup([bp('racer', { right: 'cannon' })], [bp('beast')]);
  s.level.cells[2 * 10 + 6] = CRATE;
  s.level.crateHp[posKey(6, 2)] = 10;
  Object.assign(getUnit(s, 'e0'), { x: 6, y: 1 });
  const ev = performAction(s, s.units[0].id, 'blaster', { x: 6, y: 2 });
  assert.ok(ev.some((e) => e.type === 'crate' && e.broken));
  assert.ok(ev.some((e) => e.type === 'fall' && e.id === 'e0'));
  assert.equal(getUnit(s, 'e0').y, 2);
});

test('adjacent compatible robots combine into a super robot', () => {
  const s = setup([bp('racer'), bp('jet'), bp('beast')], [bp('beast')]);
  const [car, jet, beast] = s.units;
  assert.deepEqual(mergeOptions(s, car.id), [jet.id]);
  assert.deepEqual(mergeOptions(s, beast.id), [jet.id]);
  const ev = mergeRobots(s, car.id, jet.id);
  assert.equal(ev[0].type, 'merge');
  const sky = getUnit(s, ev[0].newId);
  assert.equal(sky.name, 'Sky Racer');
  assert.equal(aliveUnits(s, 'player').length, 2);
  assert.ok(sky.acted, 'combining uses the action');
});

test('storm ultimates hit every enemy in range', () => {
  const s = setup([bp('racer'), bp('jet')], [bp('beast'), bp('tank')]);
  const ev = mergeRobots(s, s.units[0].id, s.units[1].id);
  endTurn(s);
  endTurn(s);
  const sky = getUnit(s, ev[0].newId);
  sky.cooldowns = {};
  getUnit(s, 'e0').x = 4;
  getUnit(s, 'e1').x = 6;
  const hits = performAction(s, sky.id, 'ult-skystorm');
  assert.equal(hits.filter((e) => e.type === 'damage').length, 2);
});

test('enemy AI attacks when it can and the player wins when enemies are gone', () => {
  const s = setup([bp('racer')], [bp('racer', { left: 'missile' })]);
  endTurn(s);
  const hp = s.units[0].hp;
  const ev = runEnemyTurn(s);
  assert.ok(ev.some((e) => e.type === 'attack'));
  assert.ok(s.units[0].hp < hp);
  assert.equal(s.team, 'player');
  getUnit(s, 'e0').hp = 1;
  getUnit(s, 'e0').x = 3;
  const win = performAction(s, s.units[0].id, 'blaster', { unitId: 'e0' });
  assert.deepEqual(win.at(-1), { type: 'end', winner: 'player' });
});

test('enemy turns always finish over many random battles', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 15; seed++) {
      const s = createBattle({ blueprints: [bp('racer'), bp('titan', { legs: 'spider' })], difficulty: diff, seed });
      for (let r = 0; r < 25 && !s.winner; r++) {
        endTurn(s);
        runEnemyTurn(s);
      }
      assert.equal(s.winner, 'enemy', `${diff} ${seed} enemies defeat idle players`);
    }
  }
});

test('power test: stars depend on turns, cooldowns block reuse', () => {
  assert.deepEqual([starsFor(2, true), starsFor(5, true), starsFor(6, true), starsFor(6, false)], [3, 2, 1, 0]);
  const t = createWallTest(bp('titan', { left: 'missile', right: 'cannon' }), 'easy', 1);
  assert.ok(useWallAttack(t, 'missile').length);
  assert.deepEqual(useWallAttack(t, 'missile'), [], 'missile on cooldown');
  while (!t.done) useWallAttack(t, t.unit.attacks.find((a) => a.dmg && !(t.unit.cooldowns[a.id] > 0)).id);
  assert.ok(t.broken);
  assert.ok(t.stars >= 1);
  const hard = createWallTest(bp('jet'), 'hard', 1);
  while (!hard.done) useWallAttack(hard, 'blaster');
  assert.ok(!hard.broken);
});
