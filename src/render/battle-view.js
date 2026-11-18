// Draws the battlefield and animates battle events one after another.
import { drawUnit } from './draw-robot.js';
import { sfx } from './sfx.js';
import { GROUND, CRATE, SPIKES, EMPTY, posKey } from '../game/terrain.js';

export const CELL = 64;
const lerp = (a, b, p) => a + (b - a) * p;
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

export class BattleView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tweens = [];
    this.effects = [];
    this.texts = [];
    this.banner = null;
    this.shakeAmp = 0;
    this.overlay = { moves: [], targets: [], cells: [], merges: [], partners: [], combineSpots: [], selected: null };
    this.busy = false;
    this.running = false;
  }

  attach(state) {
    this.state = state;
    this.w = state.level.w * CELL;
    this.h = state.level.h * CELL;
    this.cells = [...state.level.cells];
    this.actors = new Map();
    this.sync();
    this.background = this.makeBackground();
    this.resize();
    if (!this.running) {
      this.running = true;
      const frame = (now) => {
        if (!this.running) return;
        this.update(now);
        this.draw(now / 1000);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  stop() { this.running = false; }

  resize() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  sync() {
    const ids = new Set();
    for (const u of this.state.units) {
      if (u.hp <= 0) continue;
      ids.add(u.id);
      const a = this.actors.get(u.id) || { alpha: 1, flash: 0, ox: 0, oy: 0, pop: 1 };
      Object.assign(a, { unit: u, x: u.x, y: u.y, hp: u.hp });
      this.actors.set(u.id, a);
    }
    for (const id of [...this.actors.keys()]) if (!ids.has(id)) this.actors.delete(id);
    this.cells = [...this.state.level.cells];
  }

  cellFromPoint(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * this.w / CELL);
    const y = Math.floor(((clientY - r.top) / r.height) * this.h / CELL);
    return { x, y };
  }

  // ---------- animation helpers ----------
  tween(ms, fn) {
    return new Promise((resolve) => this.tweens.push({ start: performance.now(), ms, fn, resolve }));
  }

  wait(ms) { return this.tween(ms, () => {}); }

  update(now) {
    for (const tw of [...this.tweens]) {
      const p = Math.min(1, (now - tw.start) / tw.ms);
      tw.fn(p);
      if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.resolve(); }
    }
    const dt = 1 / 60;
    for (const fx of this.effects) {
      fx.life -= dt;
      if (fx.vx !== undefined) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += (fx.g ?? 300) * dt; }
    }
    this.effects = this.effects.filter((f) => f.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shakeAmp *= 0.88;
    for (const a of this.actors.values()) a.flash = Math.max(0, a.flash - dt * 3);
  }

  center(c) { return { x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 }; }

  burst(x, y, color, n = 16, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      this.effects.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.4 + Math.random() * 0.4, color, size: 3 + Math.random() * 4 });
    }
  }

  float(x, y, text, color, size = 26) { this.texts.push({ x, y, text, color, size, life: 1.1 }); }

  showBanner(text, color, ms) {
    this.banner = { text, color };
    return this.wait(ms).then(() => { this.banner = null; });
  }

  async play(events) {
    this.busy = true;
    try {
      for (const e of events) await this.animate(e);
    } finally {
      this.sync();
      this.busy = false;
    }
  }

  async animate(e) {
    const a = e.id ? this.actors.get(e.id) : null;
    switch (e.type) {
      case 'move': {
        if (!a) return;
        for (let i = 1; i < e.path.length; i++) {
          const from = e.path[i - 1];
          const to = e.path[i];
          if (to.x !== from.x) a.unit.facing = to.x > from.x ? 1 : -1;
          const jump = to.kind === 'jump';
          sfx.step();
          await this.tween(jump ? 300 : 160, (p) => {
            a.x = lerp(from.x, to.x, p);
            a.y = lerp(from.y, to.y, p) - (jump ? Math.sin(p * Math.PI) * 1.1 : 0);
          });
        }
        return;
      }
      case 'attack': return this.animateAttack(e);
      case 'damage': {
        if (!a) return;
        const c = this.center(a);
        this.float(c.x, c.y - 40, `-${e.amount}`, '#ff5252', 30);
        a.flash = 1;
        this.shakeAmp = Math.min(12, 3 + e.amount / 5);
        sfx.hit();
        const from = a.hp;
        await this.tween(250, (p) => { a.hp = lerp(from, e.hp, p); });
        return;
      }
      case 'heal': {
        if (!a) return;
        const c = this.center(a);
        this.float(c.x, c.y - 40, `+${e.amount}`, '#69f0ae', 30);
        this.burst(c.x, c.y, '#69f0ae', 14, 120);
        sfx.heal();
        const from = a.hp;
        await this.tween(300, (p) => { a.hp = lerp(from, e.hp, p); });
        return;
      }
      case 'destroy': {
        if (!a) return;
        const c = this.center(a);
        sfx.boom();
        this.burst(c.x, c.y, '#ff9800', 30, 320);
        this.burst(c.x, c.y, '#616161', 16, 200);
        this.shakeAmp = 14;
        await this.tween(450, (p) => { a.alpha = 1 - p; });
        this.actors.delete(e.id);
        return;
      }
      case 'crate': {
        const c = this.center(e);
        this.burst(c.x, c.y, '#a1887f', e.broken ? 22 : 6, e.broken ? 260 : 120);
        if (e.broken) { this.cells[e.y * this.state.level.w + e.x] = EMPTY; sfx.boom(); }
        await this.wait(120);
        return;
      }
      case 'fall':
      case 'push': {
        if (!a) return;
        await this.tween(e.type === 'fall' ? 280 : 180, (p) => {
          a.x = lerp(e.from.x, e.to.x, p);
          a.y = lerp(e.from.y, e.to.y, ease(p));
        });
        return;
      }
      case 'guard': {
        if (!a) return;
        const c = this.center(a);
        sfx.guard();
        this.float(c.x, c.y - 50, 'GUARD!', '#4fc3f7');
        await this.wait(350);
        return;
      }
      case 'buff': {
        if (!a) return;
        const c = this.center(a);
        sfx.guard();
        this.float(c.x, c.y - 50, `${e.name.toUpperCase()}!`, '#ffd54f');
        await this.wait(350);
        return;
      }
      case 'merge': return this.animateMerge(e);
      case 'turn':
        return this.showBanner(e.team === 'player' ? 'YOUR TURN' : 'ENEMY TURN', e.team === 'player' ? '#42a5f5' : '#ef5350', 750);
      default:
    }
  }

  async animateAttack(e) {
    const a = this.actors.get(e.id);
    const from = this.center(e.from);
    const to = this.center(e.to);
    const { attack } = e;
    if (a && e.to.x !== e.from.x) a.unit.facing = e.to.x > e.from.x ? 1 : -1;
    if (attack.type === 'melee') {
      sfx.punch();
      const dx = Math.sign(e.to.x - e.from.x) * 0.45;
      const dy = Math.sign(e.to.y - e.from.y) * 0.3;
      await this.tween(120, (p) => { if (a) { a.ox = dx * p; a.oy = dy * p; } });
      this.burst(to.x, to.y, attack.id === 'fire' ? '#ff7043' : '#fff59d', 12, 180);
      await this.tween(140, (p) => { if (a) { a.ox = dx * (1 - p); a.oy = dy * (1 - p); } });
    } else if (attack.type === 'beam') {
      sfx.laser();
      const color = attack.id.includes('lance') ? '#80d8ff' : attack.id.startsWith('ult') ? '#ffd54f' : '#ff5252';
      this.effects.push({ kind: 'beam', from, to, color, width: attack.id.startsWith('ult') ? 14 : 6, life: 0.3 });
      await this.wait(220);
      this.burst(to.x, to.y, color, 10, 150);
    } else if (attack.type === 'arc' || attack.type === 'missile') {
      attack.type === 'arc' ? sfx.shoot() : sfx.laser();
      const shell = { kind: attack.type === 'arc' ? 'shell' : 'missile', x: from.x, y: from.y, life: 10, angle: 0 };
      this.effects.push(shell);
      const height = attack.type === 'arc' ? 180 : 90;
      await this.tween(attack.type === 'arc' ? 480 : 420, (p) => {
        const nx = lerp(from.x, to.x, p);
        const ny = lerp(from.y, to.y, p) - Math.sin(p * Math.PI) * height;
        shell.angle = Math.atan2(ny - shell.y, nx - shell.x);
        shell.x = nx; shell.y = ny;
        if (shell.kind === 'missile' && Math.random() < 0.6) this.effects.push({ kind: 'spark', x: nx, y: ny, vx: 0, vy: -10, g: 0, life: 0.4, color: '#bdbdbd', size: 5 });
      });
      shell.life = 0;
      sfx.boom();
      this.burst(to.x, to.y, '#ff9800', attack.splash ? 28 : 16, attack.splash ? 300 : 200);
      this.shakeAmp = 8;
    } else if (attack.type === 'storm') {
      sfx.boom();
      for (const t of e.targets || []) {
        const c = this.center(t);
        this.effects.push({ kind: 'bolt', x: c.x, y: c.y, life: 0.45, seed: Math.random() });
        this.burst(c.x, c.y, '#fff176', 14, 200);
      }
      this.shakeAmp = 14;
      await this.wait(450);
    } else if (attack.type === 'heal') {
      this.effects.push({ kind: 'beam', from, to, color: '#69f0ae', width: 5, life: 0.3 });
      await this.wait(200);
    }
  }

  async animateMerge(e) {
    const a = this.actors.get(e.ids[0]);
    const b = this.actors.get(e.ids[1]);
    sfx.merge();
    if (b) {
      const sx = b.x;
      const sy = b.y;
      await this.tween(380, (p) => { b.x = lerp(sx, e.at.x, p); b.y = lerp(sy, e.at.y, p) - Math.sin(p * Math.PI) * 0.8; });
    }
    for (const x of [a, b]) if (x) x.flash = 1;
    const c = this.center(e.at);
    this.burst(c.x, c.y, '#ffd54f', 40, 320);
    this.burst(c.x, c.y, '#ffffff', 20, 200);
    this.actors.delete(e.ids[0]);
    this.actors.delete(e.ids[1]);
    const unit = this.state.units.find((u) => u.id === e.newId);
    if (unit) {
      const actor = { unit, x: e.at.x, y: e.at.y, hp: unit.hp, alpha: 1, flash: 1, ox: 0, oy: 0, pop: 0.2 };
      this.actors.set(unit.id, actor);
      this.tween(500, (p) => { actor.pop = 0.2 + 0.8 * p + Math.sin(p * Math.PI) * 0.25; });
    }
    await this.showBanner(`${e.name.toUpperCase()}!`, '#ffd54f', 1300);
  }

  // ---------- drawing ----------
  makeBackground() {
    const c = new OffscreenCanvasLike(this.w, this.h);
    const g = c.ctx;
    const sky = g.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#0d1b3e');
    sky.addColorStop(0.6, '#2b4c8c');
    sky.addColorStop(1, '#f39c6b');
    g.fillStyle = sky;
    g.fillRect(0, 0, this.w, this.h);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 197) % this.w, (i * 83) % (this.h * 0.45), 2, 2);
    g.fillStyle = '#1c2a4a';
    for (let x = 0, i = 0; x < this.w; i++) {
      const bw = 40 + ((i * 37) % 50);
      const bh = 80 + ((i * 53) % 160);
      g.fillRect(x, this.h - bh - 60, bw, bh + 60);
      g.fillStyle = 'rgba(255,214,79,0.5)';
      for (let wy = this.h - bh - 50; wy < this.h - 70; wy += 18) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if ((wx + wy + i) % 3 === 0) g.fillRect(wx, wy, 5, 7);
      g.fillStyle = '#1c2a4a';
      x += bw + 6;
    }
    return c.canvas;
  }

  drawTerrain(ctx, t) {
    const { w, h } = this.state.level;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = this.cells[y * w + x];
        const px = x * CELL;
        const py = y * CELL;
        if (v === GROUND) {
          const top = y === 0 || this.cells[(y - 1) * w + x] !== GROUND;
          ctx.fillStyle = (x + y) % 2 ? '#5d4a3a' : '#66513f';
          ctx.fillRect(px, py, CELL, CELL);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(px + 10 + ((x * 7 + y * 3) % 30), py + 20 + ((x * 11) % 25), 8, 6);
          if (top) {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(px, py, CELL, 12);
            ctx.fillStyle = '#81c784';
            ctx.fillRect(px, py, CELL, 4);
          }
        } else if (v === CRATE) {
          ctx.fillStyle = '#a1693c';
          ctx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
          ctx.strokeStyle = '#5d3a1a';
          ctx.lineWidth = 4;
          ctx.strokeRect(px + 5, py + 5, CELL - 10, CELL - 10);
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + CELL - 8, py + CELL - 8);
          ctx.moveTo(px + CELL - 8, py + 8); ctx.lineTo(px + 8, py + CELL - 8);
          ctx.stroke();
          const hp = this.state.level.crateHp[posKey(x, y)] ?? 30;
          if (hp < 30) {
            ctx.strokeStyle = '#2b1a0a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(px + 20, py + 10); ctx.lineTo(px + 30, py + 30); ctx.lineTo(px + 22, py + 50); ctx.stroke();
          }
        } else if (v === SPIKES) {
          ctx.fillStyle = '#cfd8dc';
          ctx.strokeStyle = '#37474f';
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(px + i * 16, py + CELL);
            ctx.lineTo(px + i * 16 + 8, py + CELL - 26 - Math.sin(t * 3 + i) * 2);
            ctx.lineTo(px + i * 16 + 16, py + CELL);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        }
      }
    }
  }

  drawOverlay(ctx, t) {
    const o = this.overlay;
    const pulse = 0.5 + Math.sin(t * 6) * 0.2;
    for (const m of o.moves) {
      ctx.fillStyle = 'rgba(66,165,245,0.32)';
      ctx.strokeStyle = 'rgba(144,202,249,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(m.x * CELL + 4, m.y * CELL + 4, CELL - 8, CELL - 8, 10); ctx.fill(); ctx.stroke();
    }
    const ring = (c, color) => {
      const p = this.center(c);
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.globalAlpha = pulse + 0.3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    };
    for (const c of o.targets) ring(c, '#ff5252');
    for (const c of o.cells) ring(c, '#ffab40');
    for (const c of o.heals || []) ring(c, '#69f0ae');
    for (const c of o.merges) ring(c, '#ffd54f');
  }

  // Shows which friends the selected robot can combine with and where to stand to do it.
  drawCombineGuide(ctx, t, pulse) {
    const o = this.overlay;
    const me = o.selected && this.actors.get(o.selected);
    if (!me || !o.partners?.length) return;
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of o.combineSpots || []) {
      const c = this.center(m);
      ctx.fillStyle = 'rgba(255,213,79,0.35)';
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(m.x * CELL + 4, m.y * CELL + 4, CELL - 8, CELL - 8, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText('🤝', c.x, c.y);
    }
    const from = this.center(me);
    for (const p of o.partners) {
      const a = this.actors.get(p.id);
      if (!a) continue;
      const to = this.center(a);
      ctx.save();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      ctx.restore();
      const by = (a.y + 1) * CELL - 58 * a.unit.scale * 1.08 - 42 + Math.sin(t * 5) * 3;
      const label = `🤝 ${p.recipe}`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(40,30,0,0.85)'; ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(to.x - w / 2, by - 12, w, 24, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(label, to.x, by + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawActors(ctx, t) {
    const list = [...this.actors.values()].sort((a, b) => a.y - b.y);
    for (const a of list) {
      const u = a.unit;
      const px = (a.x + a.ox) * CELL + CELL / 2;
      const py = (a.y + a.oy + 1) * CELL - 2;
      const size = 58 * u.scale * a.pop;
      ctx.globalAlpha = a.alpha * 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(px, py, 22 * u.scale, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      const selected = this.overlay.selected === u.id;
      const done = u.team === this.state.team && u.team === 'player' && u.acted && !this.busy;
      drawUnit(ctx, px, py, u, { size, facing: u.facing, t: t + (u.id.charCodeAt(1) || 0), flash: a.flash, alpha: a.alpha * (done ? 0.7 : 1), glow: selected ? '#4fc3f7' : null });
      if (a.alpha < 0.05) continue;
      const barW = 50;
      const bx = px - barW / 2;
      const by = py - size * 1.08 - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, barW + 4, 11, 4); ctx.fill();
      const frac = Math.max(0, a.hp / u.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffca28' : '#ef5350';
      ctx.beginPath(); ctx.roundRect(bx, by, barW * frac, 7, 3); ctx.fill();
      ctx.strokeStyle = u.team === 'player' ? '#42a5f5' : '#ef5350';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, barW + 4, 11, 4); ctx.stroke();
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (u.guarding) ctx.fillText('🛡️', px + 36, by + 8);
      if (u.lockOn) ctx.fillText('🎯', px - 36, by + 8);
      if (selected) {
        const ay = by - 16 + Math.sin(t * 6) * 4;
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath(); ctx.moveTo(px - 9, ay - 10); ctx.lineTo(px + 9, ay - 10); ctx.lineTo(px, ay); ctx.closePath(); ctx.fill();
      }
      if (u.recipe) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText(u.recipe, px, py + 14 > this.h ? py - 4 : py + 14);
      }
    }
  }

  drawEffects(ctx) {
    for (const fx of this.effects) {
      ctx.globalAlpha = Math.min(1, fx.life * 3);
      if (fx.kind === 'spark') {
        ctx.fillStyle = fx.color;
        ctx.fillRect(fx.x - fx.size / 2, fx.y - fx.size / 2, fx.size, fx.size);
      } else if (fx.kind === 'beam') {
        ctx.strokeStyle = fx.color; ctx.lineWidth = fx.width; ctx.lineCap = 'round';
        ctx.shadowColor = fx.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(fx.to.x, fx.to.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = fx.width / 3;
        ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(fx.to.x, fx.to.y); ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (fx.kind === 'shell') {
        ctx.fillStyle = '#212121';
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 8, 0, Math.PI * 2); ctx.fill();
      } else if (fx.kind === 'missile') {
        ctx.save(); ctx.translate(fx.x, fx.y); ctx.rotate(fx.angle);
        ctx.fillStyle = '#eceff1'; ctx.fillRect(-12, -4, 20, 8);
        ctx.fillStyle = '#ff5722'; ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(16, 0); ctx.lineTo(8, 4); ctx.fill();
        ctx.fillStyle = '#ffb300'; ctx.fillRect(-18, -2, 6, 4);
        ctx.restore();
      } else if (fx.kind === 'bolt') {
        ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 5; ctx.shadowColor = '#fff176'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(fx.x + 30, 0);
        for (let i = 1; i <= 8; i++) ctx.lineTo(fx.x + Math.sin(fx.seed * 50 + i * 2.3) * 22, (fx.y / 8) * i);
        ctx.stroke(); ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }

  draw(t) {
    if (!this.state) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.drawImage(this.background, 0, 0, this.w, this.h);
    if (this.shakeAmp > 0.5) ctx.translate((Math.random() - 0.5) * this.shakeAmp, (Math.random() - 0.5) * this.shakeAmp);
    this.drawTerrain(ctx, t);
    if (!this.busy) this.drawOverlay(ctx, t);
    this.drawActors(ctx, t);
    if (!this.busy) this.drawCombineGuide(ctx, t, 0.5 + Math.sin(t * 6) * 0.2);
    this.drawEffects(ctx);
    ctx.textAlign = 'center';
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      ctx.font = `900 ${tx.size}px system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#000';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (this.banner) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, this.h / 2 - 50, this.w, 100);
      ctx.font = '900 56px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = '#000';
      ctx.strokeText(this.banner.text, this.w / 2, this.h / 2);
      ctx.fillStyle = this.banner.color;
      ctx.fillText(this.banner.text, this.w / 2, this.h / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }
}

// Plain canvas fallback (OffscreenCanvas lacks drawImage support on older iPad Safari).
function OffscreenCanvasLike(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}
