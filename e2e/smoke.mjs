// Smoke test: plays the game in Chromium as a desktop mouse user and as an iPad (touch only).
import { chromium, devices } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../scripts/serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 8765;
const url = process.env.GAME_URL || `http://localhost:${port}/`;
const executablePath = process.env.CHROME_PATH || '/usr/bin/chromium';

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  ipad: { ...devices['iPad Pro 11 landscape'], defaultBrowserType: undefined },
};

async function waitFor(page, fn, label, timeout = 20000, arg = null) {
  try {
    await page.waitForFunction(fn, arg, { timeout });
  } catch {
    throw new Error(`Timed out waiting for ${label}`);
  }
}

async function run(name, options) {
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const touch = name === 'ipad';
  const press = (sel) => (touch ? page.locator(sel).first().tap() : page.locator(sel).first().click());
  const shot = (n) => page.screenshot({ path: join(root, 'e2e', `screenshot-${name}-${n}.png`) });

  try {
    await page.goto(url);
    await shot('menu');

    // Garage: change body + legs, add a robot.
    await press('[data-action="garage"]');
    await press('[data-slot="body"]');
    await press('[data-part="tank"]');
    await press('[data-slot="legs"]');
    await press('[data-part="spider"]');
    const first = await page.evaluate(() => window.__game.app.garage.robots[0]);
    if (first.body !== 'tank' || first.legs !== 'spider') throw new Error('Garage did not update robot');
    await press('[data-action="new-robot"]');
    await shot('garage');
    if ((await page.evaluate(() => window.__game.app.garage.robots.length)) !== 4) throw new Error('New robot not added');
    await page.locator('button', { hasText: 'Menu' }).first()[touch ? 'tap' : 'click']();

    // Power Test on the brick wall until it ends.
    await press('[data-action="power-test"]');
    await press('[data-target="easy"]');
    await press('[data-action="start"]');
    for (let i = 0; i < 8; i++) {
      if (await page.evaluate(() => window.__game.wall.state.done)) break;
      await waitFor(page, () => !window.__game.wall.busy, 'wall idle');
      await press('.actions .action:not([disabled])');
      await waitFor(page, () => !window.__game.wall.busy, 'wall attack');
    }
    await page.locator('[data-result]').waitFor();
    await shot('powertest');
    await page.locator('button', { hasText: 'Back' }).first()[touch ? 'tap' : 'click']();
    await page.locator('button', { hasText: 'Menu' }).first()[touch ? 'tap' : 'click']();

    // Battle with 3 robots on Normal: tap a move cell, then attack or guard, for a few turns.
    await press('[data-action="battle"]');
    await press('[data-robot="1"]');
    await press('[data-robot="2"]');
    await press('[data-difficulty="normal"]');
    await press('[data-action="start"]');
    await waitFor(page, () => window.__game.battle && !window.__game.battle.view.busy, 'battle ready');
    const canvas = page.locator('canvas.battle-canvas');
    let moves = 0;
    for (let turn = 0; turn < 3; turn++) {
      const done = await page.evaluate(() => Boolean(window.__game.battle.state.winner));
      if (done) break;
      const target = await page.evaluate(() => {
        const ui = window.__game.battle;
        const m = ui.view.overlay.moves;
        const best = m.reduce((a, b) => (b.x > a.x ? b : a), m[0]);
        return best ? { x: best.x, y: best.y, w: ui.view.w, h: ui.view.h, id: ui.selected } : null;
      });
      if (target) {
        const box = await canvas.boundingBox();
        const px = box.x + ((target.x + 0.5) * 64 / target.w) * box.width;
        const py = box.y + ((target.y + 0.5) * 64 / target.h) * box.height;
        if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
        await waitFor(page, (id) => window.__game.battle.state.units.find((u) => u.id === id)?.moved, 'unit moved', 10000, target.id);
        moves++;
        await waitFor(page, () => !window.__game.battle.view.busy, 'move anim');
      }
      await press('[data-action="end-turn"]');
      await waitFor(page, () => window.__game.battle.state.winner || (window.__game.battle.state.team === 'player' && !window.__game.battle.view.busy), 'enemy turn', 40000);
    }
    const s = await page.evaluate(() => ({ round: window.__game.battle.state.round, moved: window.__game.battle.state.units.filter((u) => u.team === 'player').map((u) => [u.x, u.y]) }));
    await shot('battle');
    if (!moves) throw new Error('Player robot never moved');
    if (s.round < 2) throw new Error(`Battle did not advance: ${JSON.stringify(s)}`);
    if (errors.length) throw new Error(`Console errors: ${errors.join(' | ')}`);
    console.log(`✔ ${name}: garage, power test and ${s.round - 1} battle rounds OK`);
  } finally {
    await browser.close();
  }
}

const server = process.env.GAME_URL ? null : await startServer(port);
let failed = false;
for (const [name, opts] of Object.entries(PROFILES)) {
  try { await run(name, opts); } catch (e) { failed = true; console.error(`✖ ${name}: ${e.message}`); }
}
server?.close();
process.exit(failed ? 1 : 0);
