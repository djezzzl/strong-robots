// Power Test screen: robot on the left, wall on the right, attack buttons below.
import { h, button } from './dom.js';
import { drawUnit } from '../render/draw-robot.js';
import { sfx } from '../render/sfx.js';
import { createWallTest, useWallAttack, usableAttacks, isReady } from '../game/walltest.js';

const W = 1152;
const H = 560;
const ROBOT_X = 300;
const WALL_X = 760;
const FLOOR = 470;

function makeCracks() {
  const cracks = [];
  for (let i = 0; i < 14; i++) {
    const pts = [{ x: WALL_X + 20 + Math.random() * 180, y: 100 + Math.random() * 340 }];
    for (let k = 0; k < 4; k++) pts.push({ x: pts[k].x + (Math.random() - 0.5) * 70, y: pts[k].y + (Math.random() - 0.3) * 60 });
    cracks.push(pts);
  }
  return cracks;
}

export function wallScreen(app, { robot, target }) {
  const bp = app.garage.robots[robot];
  const state = createWallTest(bp, target);
  const canvas = h('canvas', { class: 'battle-canvas', 'aria-label': 'Power test' });
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const panel = h('div', { class: 'battle-panel' });
  const info = h('span', { class: 'round' });
  const root = h('div', { class: 'screen battle wall' },
    h('header', { class: 'topbar' }, button('⬅ Back', () => { running = false; app.go('wall-setup'); }, { class: 'small' }), info, h('div', { class: 'spacer' })),
    h('div', { class: 'canvas-wrap' }, canvas),
    panel);

  const cracks = makeCracks();
  const fx = { robotDx: 0, shake: 0, wallHp: state.wall.hp, flash: 0, sparks: [], texts: [], bricks: [], beam: null, missile: null };
  let busy = false;
  let running = true;
  globalThis.__game = { ...(globalThis.__game || {}), screen: 'wall', wall: { state, get busy() { return busy; } } };

  const tween = (ms, fn) => new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });

  const burst = (x, y, color, n) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 300;
      fx.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150, life: 0.5 + Math.random() * 0.5, color });
    }
  };

  async function animateHit(attack, amount) {
    const impact = { x: WALL_X + 10, y: 300 };
    const from = { x: ROBOT_X + 50, y: FLOOR - 110 };
    if (attack.type === 'melee') {
      sfx.punch();
      await tween(220, (p) => { fx.robotDx = p * (WALL_X - ROBOT_X - 90); });
    } else if (attack.type === 'beam' || attack.type === 'storm') {
      sfx.laser();
      fx.beam = { from, to: impact, color: attack.id.startsWith('ult') ? '#ffd54f' : '#ff5252' };
      await tween(250, () => {});
      fx.beam = null;
    } else {
      sfx.shoot();
      await tween(450, (p) => { fx.missile = { x: from.x + (impact.x - from.x) * p, y: from.y + (impact.y - from.y) * p - Math.sin(p * Math.PI) * 140 }; });
      fx.missile = null;
      sfx.boom();
    }
    sfx.hit();
    burst(impact.x, impact.y, state.wall.color, 18);
    burst(impact.x, impact.y, '#fff59d', 8);
    fx.texts.push({ x: impact.x + 60, y: impact.y - 40, text: `-${amount}`, life: 1.2 });
    fx.shake = 10 + amount / 4;
    fx.flash = 1;
    const fromHp = fx.wallHp;
    await tween(260, (p) => { fx.wallHp = fromHp - amount * p; });
    if (attack.type === 'melee') await tween(200, (p) => { fx.robotDx = (1 - p) * (WALL_X - ROBOT_X - 90); });
  }

  async function act(attack) {
    if (busy || state.done) return;
    busy = true;
    render();
    const events = useWallAttack(state, attack.id);
    for (const e of events) {
      if (e.type === 'hit') await animateHit(e.attack, e.amount);
      if (e.type === 'buff') { sfx.guard(); fx.texts.push({ x: ROBOT_X, y: FLOOR - 220, text: 'LOCK-ON!', life: 1.2, color: '#ffd54f' }); await tween(400, () => {}); }
      if (e.type === 'broken') {
        sfx.boom();
        for (let i = 0; i < 40; i++) fx.bricks.push({ x: WALL_X + Math.random() * 220, y: 80 + Math.random() * 380, vx: 100 + Math.random() * 400, vy: -200 - Math.random() * 300, r: Math.random() * 6, life: 2 });
        await tween(900, () => {});
        sfx.win();
        if ((app.garage.stars[target] || 0) < e.stars) { app.garage.stars[target] = e.stars; app.save(); }
      }
      if (e.type === 'timeout') sfx.lose();
    }
    busy = false;
    render();
  }

  function render() {
    info.textContent = `${state.wall.name} · Turn ${Math.min(state.turn, state.maxTurns)}/${state.maxTurns}`;
    if (state.done) {
      const pct = Math.round((state.totalDamage / state.wall.maxHp) * 100);
      panel.replaceChildren(h('div', { class: 'result', 'data-result': state.broken ? 'broken' : 'timeout' },
        h('h2', {}, state.broken ? `💥 SMASHED in ${state.turn} turns!` : `Wall survived… you did ${pct}% damage`),
        h('div', { class: 'stars big-stars' }, state.broken ? '⭐'.repeat(state.stars) + '☆'.repeat(3 - state.stars) : '☆☆☆'),
        h('div', { class: 'row' },
          button('🔁 Again', () => app.go('wall', { robot, target }), { class: 'big', attrs: { 'data-action': 'again' } }),
          button('🔧 Garage', () => app.go('garage', { index: robot }), { class: 'big' }),
          button('🧱 Other wall', () => app.go('wall-setup'), { class: 'big' }))));
      return;
    }
    panel.replaceChildren(
      h('div', { class: 'actions' }, usableAttacks(state).map((a) => {
        const cd = state.unit.cooldowns[a.id] || 0;
        return h('button', { class: `action ${a.id.startsWith('ult') ? 'ultimate' : ''}`, 'data-attack': a.id, disabled: busy || !isReady(state, a), onclick: () => act(a) },
          h('span', { class: 'icon' }, a.icon), h('span', {}, a.name), cd > 0 ? h('small', {}, `⏳${cd}`) : a.dmg ? h('small', {}, `💥${a.dmg}`) : null);
      })),
      h('div', { class: 'hint' }, `Break the ${state.wall.name} (🛡️ armor ${state.wall.armor}) in as few turns as you can! Armor-piercing weapons work best on hard walls.`));
  }

  function draw(now) {
    if (!running) return;
    const t = now / 1000;
    const dt = 1 / 60;
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a237e'); sky.addColorStop(1, '#4fc3f7');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (fx.shake > 0.5) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    fx.shake *= 0.88;
    ctx.fillStyle = '#546e7a'; ctx.fillRect(-20, FLOOR, W + 40, H - FLOOR + 20);
    ctx.fillStyle = '#ffeb3b';
    for (let x = 0; x < W; x += 80) ctx.fillRect(x, FLOOR + 30, 40, 8);
    if (!state.broken || fx.bricks.length === 0) {
      const frac = Math.max(0, fx.wallHp / state.wall.maxHp);
      ctx.fillStyle = state.wall.color;
      ctx.fillRect(WALL_X, 80, 220, FLOOR - 80);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
      for (let y = 80; y < FLOOR; y += 40) {
        ctx.beginPath(); ctx.moveTo(WALL_X, y); ctx.lineTo(WALL_X + 220, y); ctx.stroke();
        for (let x = WALL_X + ((y / 40) % 2 ? 0 : 36); x < WALL_X + 220; x += 72) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.stroke(); }
      }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
      const shown = Math.round((1 - frac) * cracks.length);
      for (const c of cracks.slice(0, shown)) { ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
      if (fx.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.5})`; ctx.fillRect(WALL_X, 80, 220, FLOOR - 80); fx.flash -= dt * 3; }
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(WALL_X, 40, 220, 22);
      ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffca28' : '#ef5350';
      ctx.fillRect(WALL_X + 3, 43, 214 * frac, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(fx.wallHp)} / ${state.wall.maxHp}`, WALL_X + 110, 57);
    }
    for (const b of fx.bricks) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.r += dt * 6;
      if (b.y > FLOOR - 10) { b.y = FLOOR - 10; b.vy *= -0.3; b.vx *= 0.7; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = state.wall.color; ctx.fillRect(-14, -9, 28, 18); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(-14, -9, 28, 18);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ROBOT_X + fx.robotDx, FLOOR, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
    drawUnit(ctx, ROBOT_X + fx.robotDx, FLOOR, state.unit, { size: 220, facing: 1, t });
    if (fx.beam) {
      ctx.strokeStyle = fx.beam.color; ctx.lineWidth = 12; ctx.shadowColor = fx.beam.color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(fx.beam.from.x, fx.beam.from.y); ctx.lineTo(fx.beam.to.x, fx.beam.to.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
    }
    if (fx.missile) { ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(fx.missile.x, fx.missile.y, 12, 0, Math.PI * 2); ctx.fill(); }
    for (const s of fx.sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; s.life -= dt;
      ctx.globalAlpha = Math.max(0, s.life); ctx.fillStyle = s.color; ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
    }
    fx.sparks = fx.sparks.filter((s) => s.life > 0);
    ctx.textAlign = 'center';
    for (const tx of fx.texts) {
      tx.y -= 50 * dt; tx.life -= dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, tx.life * 2));
      ctx.font = '900 44px system-ui'; ctx.lineWidth = 6; ctx.strokeStyle = '#000';
      ctx.strokeText(tx.text, tx.x, tx.y); ctx.fillStyle = tx.color || '#ff5252'; ctx.fillText(tx.text, tx.x, tx.y);
    }
    fx.texts = fx.texts.filter((tx) => tx.life > 0);
    ctx.globalAlpha = 1;
    if (state.broken && fx.bricks.length) {
      ctx.font = '900 64px system-ui'; ctx.lineWidth = 8; ctx.strokeStyle = '#000';
      ctx.strokeText('SMASHED!', W / 2, 120); ctx.fillStyle = '#ffd54f'; ctx.fillText('SMASHED!', W / 2, 120);
    }
    ctx.restore();
    requestAnimationFrame(draw);
  }

  render();
  requestAnimationFrame(draw);
  root.cleanup = () => { running = false; };
  return root;
}
