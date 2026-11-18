import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUnit, powerRating, normalizeBlueprint } from '../src/game/robot.js';
import { canMerge, mergeUnits, recipeFor, partnersFor } from '../src/game/merge.js';

const bp = (body, extra = {}) => ({ name: 'T', color: '#fff', head: 'visor', body, left: 'blaster', right: 'fist', legs: 'walker', ...extra });

test('unit stats come from parts', () => {
  const u = buildUnit(bp('tank', { legs: 'tracks', right: 'shield', head: 'helm' }));
  assert.equal(u.maxHp, 100);
  assert.equal(u.armor, 6 + 2 + 2 + 3);
  assert.equal(u.move, 3);
  assert.ok(u.strongGuard);
  assert.deepEqual(u.attacks.map((a) => a.id), ['blaster', 'kick', 'guard']);
});

test('scout visor extends beam range and identical arms combine into a double attack', () => {
  const u = buildUnit(bp('racer', { right: 'blaster' }));
  const dbl = u.attacks.find((a) => a.id === 'double-blaster');
  assert.equal(dbl.dmg, Math.round(14 * 1.6));
  assert.equal(dbl.range, 7);
});

test('invalid blueprint parts fall back to defaults', () => {
  const n = normalizeBlueprint({ head: 'nope', body: 'titan' });
  assert.equal(n.head, 'visor');
  assert.equal(n.body, 'titan');
});

test('power rating grows with stronger parts', () => {
  assert.ok(powerRating(bp('titan', { left: 'missile', right: 'cannon' })) > powerRating(bp('jet')));
});

test('only matching cores can combine', () => {
  const car = buildUnit(bp('racer'), { id: 'a' });
  const jet = buildUnit(bp('jet'), { id: 'b' });
  const beast = buildUnit(bp('beast'), { id: 'c' });
  const car2 = buildUnit(bp('racer'), { id: 'd' });
  assert.ok(canMerge(car, jet));
  assert.ok(!canMerge(car, beast));
  assert.ok(!canMerge(car, car2));
  assert.equal(recipeFor(['Jet', 'Car']).name, 'Sky Racer');
  assert.deepEqual(partnersFor('Car'), ['Jet', 'Tank']);
});

test('merged robot sums HP, gains ultimate and can triple-combine', () => {
  const car = buildUnit(bp('racer'), { id: 'a' });
  const jet = buildUnit(bp('jet', { left: 'missile' }), { id: 'b' });
  const titan = buildUnit(bp('titan'), { id: 'c' });
  const sky = mergeUnits(car, jet, 'm1');
  assert.equal(sky.name, 'Sky Racer');
  assert.equal(sky.maxHp, 60 + 50 + 20);
  assert.equal(sky.legsId, 'jets');
  assert.equal(sky.attacks[0].id, 'ult-skystorm');
  assert.ok(sky.attacks.some((a) => a.id === 'missile'));
  assert.equal(sky.attacks.at(-1).id, 'guard');
  assert.ok(canMerge(sky, titan));
  const omega = mergeUnits(sky, titan, 'm2');
  assert.equal(omega.name, 'Omega Prime');
  assert.equal(omega.attacks.filter((a) => a.id.startsWith('ult-')).length, 1);
  assert.equal(omega.blueprints.length, 3);
});
