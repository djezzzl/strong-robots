// Minimal DOM builder plus robot preview canvases.
import { drawUnit, drawRobot } from '../render/draw-robot.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

function setupCanvas(w, h_) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const canvas = h('canvas', { width: w * dpr, height: h_ * dpr, style: `width:${w}px;height:${h_}px` });
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

// Static picture of a robot blueprint (or a unit when `unit` is given).
export function robotPicture(bp, w = 90, ht = 90, unit = null) {
  const { canvas, ctx } = setupCanvas(w, ht);
  const size = Math.min(w, ht) * 0.78;
  if (unit) drawUnit(ctx, w / 2, ht - 6, unit, { size: size / unit.scale, t: 0.3 });
  else drawRobot(ctx, w / 2, ht - 6, bp, { size, t: 0.3 });
  canvas.className = 'robot-pic';
  return canvas;
}

// Animated robot preview that stops itself once removed from the page.
export function robotStage(getBp, w = 320, ht = 320) {
  const { canvas, ctx } = setupCanvas(w, ht);
  canvas.className = 'robot-stage';
  let started = false;
  const frame = (now) => {
    if (started && !canvas.isConnected) return;
    if (canvas.isConnected) started = true;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, ht);
    const g = ctx.createRadialGradient(w / 2, ht * 0.7, 10, w / 2, ht * 0.7, Math.min(w, ht) * 0.48);
    g.addColorStop(0, 'rgba(79,195,247,0.45)');
    g.addColorStop(1, 'rgba(79,195,247,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, ht);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(w / 2, ht - 22, w * 0.25, 10, 0, 0, Math.PI * 2); ctx.fill();
    drawRobot(ctx, w / 2, ht - 22, getBp(), { size: ht * 0.72, t, facing: 1 });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return canvas;
}

export function button(label, onclick, extra = {}) {
  return h('button', { class: `btn ${extra.class || ''}`, onclick, ...extra.attrs }, label);
}
