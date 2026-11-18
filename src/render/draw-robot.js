// Procedural robot art. Robots are drawn from their parts with feet centered at (0, 0).
// All shapes use a 100-unit tall box so they scale with `size`.

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

const METAL = '#9aa5b1';
const METAL_DARK = '#5b6672';
const OUTLINE = '#1b1f24';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fillStroke(ctx, fill) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

function drawLegs(ctx, legs, color, t) {
  const dark = shade(color, -0.25);
  switch (legs) {
    case 'wheels':
      rr(ctx, -26, -26, 52, 10, 4); fillStroke(ctx, dark);
      for (const x of [-18, 18]) {
        ctx.beginPath(); ctx.arc(x, -10, 10, 0, Math.PI * 2); fillStroke(ctx, '#2b2f36');
        ctx.beginPath(); ctx.arc(x, -10, 4, 0, Math.PI * 2); fillStroke(ctx, METAL);
        ctx.save(); ctx.translate(x, -10); ctx.rotate(t * 6);
        ctx.strokeStyle = METAL; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.restore(); ctx.strokeStyle = OUTLINE;
      }
      break;
    case 'tracks':
      rr(ctx, -30, -22, 60, 22, 11); fillStroke(ctx, '#33383f');
      for (const x of [-19, -6, 7, 20]) { ctx.beginPath(); ctx.arc(x, -11, 5, 0, Math.PI * 2); fillStroke(ctx, METAL); }
      rr(ctx, -20, -30, 40, 9, 3); fillStroke(ctx, dark);
      break;
    case 'jets': {
      rr(ctx, -16, -34, 32, 12, 4); fillStroke(ctx, dark);
      for (const x of [-11, 11]) {
        ctx.beginPath(); ctx.moveTo(x - 7, -24); ctx.lineTo(x + 7, -24); ctx.lineTo(x + 5, -10); ctx.lineTo(x - 5, -10); ctx.closePath(); fillStroke(ctx, METAL_DARK);
        const flame = 8 + Math.sin(t * 30 + x) * 3;
        ctx.beginPath(); ctx.moveTo(x - 4, -10); ctx.lineTo(x, -10 + flame); ctx.lineTo(x + 4, -10); ctx.closePath();
        ctx.fillStyle = '#ffb300'; ctx.fill();
      }
      break;
    }
    case 'spider':
      for (const s of [-1, 1]) for (const k of [0, 1]) {
        const reach = 18 + k * 12;
        ctx.lineWidth = 5; ctx.strokeStyle = dark;
        ctx.beginPath(); ctx.moveTo(s * 8, -30); ctx.lineTo(s * reach, -40 + k * 4); ctx.lineTo(s * (reach + 6), 0); ctx.stroke();
      }
      ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
      rr(ctx, -16, -36, 32, 12, 6); fillStroke(ctx, dark);
      break;
    default: {
      const step = Math.sin(t * 8) * 2;
      for (const s of [-1, 1]) {
        rr(ctx, s * 11 - 6, -30, 12, 24 + s * step * 0.5, 4); fillStroke(ctx, METAL_DARK);
        rr(ctx, s * 11 - 9, -8, 18, 8, 3); fillStroke(ctx, dark);
      }
    }
  }
}

function drawBody(ctx, body, color) {
  const dark = shade(color, -0.25);
  const light = shade(color, 0.2);
  switch (body) {
    case 'racer':
      ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(26, -30); ctx.lineTo(24, -62); ctx.lineTo(-24, -66); ctx.closePath(); fillStroke(ctx, color);
      rr(ctx, -16, -60, 32, 12, 3); fillStroke(ctx, '#90caf9');
      for (const x of [-18, 14]) { rr(ctx, x, -40, 6, 5, 2); fillStroke(ctx, '#fff59d'); }
      rr(ctx, -6, -46, 12, 10, 2); fillStroke(ctx, dark);
      break;
    case 'jet':
      ctx.beginPath(); ctx.moveTo(-44, -44); ctx.lineTo(-18, -62); ctx.lineTo(-18, -48); ctx.closePath(); fillStroke(ctx, light);
      ctx.beginPath(); ctx.moveTo(44, -44); ctx.lineTo(18, -62); ctx.lineTo(18, -48); ctx.closePath(); fillStroke(ctx, light);
      rr(ctx, -20, -66, 40, 36, 10); fillStroke(ctx, color);
      ctx.beginPath(); ctx.moveTo(-8, -60); ctx.lineTo(8, -60); ctx.lineTo(0, -40); ctx.closePath(); fillStroke(ctx, '#e3f2fd');
      break;
    case 'titan':
      rr(ctx, -30, -70, 60, 42, 6); fillStroke(ctx, color);
      rr(ctx, -36, -72, 16, 14, 4); fillStroke(ctx, dark);
      rr(ctx, 20, -72, 16, 14, 4); fillStroke(ctx, dark);
      ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(10, -50); ctx.lineTo(0, -38); ctx.lineTo(-10, -50); ctx.closePath(); fillStroke(ctx, '#ffd54f');
      break;
    case 'beast':
      rr(ctx, -28, -66, 56, 38, 16); fillStroke(ctx, color);
      for (const x of [-18, -6, 6, 18]) { ctx.beginPath(); ctx.moveTo(x - 5, -64); ctx.lineTo(x, -76); ctx.lineTo(x + 5, -64); ctx.closePath(); fillStroke(ctx, light); }
      ctx.beginPath(); ctx.moveTo(-16, -44); for (let i = 0; i < 4; i++) { ctx.lineTo(-12 + i * 8, -36); ctx.lineTo(-8 + i * 8, -44); } ctx.lineTo(16, -44); ctx.closePath(); fillStroke(ctx, '#fff');
      break;
    case 'tank':
      rr(ctx, -32, -64, 64, 36, 4); fillStroke(ctx, color);
      rr(ctx, -24, -70, 48, 8, 2); fillStroke(ctx, dark);
      ctx.fillStyle = METAL;
      for (const x of [-26, -14, 14, 26]) for (const y of [-58, -36]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      rr(ctx, -10, -56, 20, 16, 3); fillStroke(ctx, dark);
      break;
    default:
      rr(ctx, -24, -66, 48, 36, 6); fillStroke(ctx, color);
  }
}

function drawHead(ctx, head, color, t) {
  const dark = shade(color, -0.3);
  ctx.save();
  ctx.translate(0, -70);
  switch (head) {
    case 'helm':
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -16); ctx.quadraticCurveTo(0, -30, 14, -16); ctx.lineTo(14, 0); ctx.closePath(); fillStroke(ctx, METAL);
      rr(ctx, -10, -12, 20, 5, 2); fillStroke(ctx, '#ff5252');
      ctx.beginPath(); ctx.moveTo(-3, -24); ctx.lineTo(0, -34); ctx.lineTo(3, -24); ctx.closePath(); fillStroke(ctx, color);
      break;
    case 'radar':
      rr(ctx, -12, -16, 24, 16, 5); fillStroke(ctx, dark);
      rr(ctx, -8, -12, 16, 5, 2); fillStroke(ctx, '#69f0ae');
      ctx.save(); ctx.translate(0, -18); ctx.scale(Math.cos(t * 3), 1);
      ctx.beginPath(); ctx.ellipse(0, -6, 14, 7, 0, Math.PI, 0); fillStroke(ctx, METAL);
      ctx.restore();
      break;
    case 'dragon':
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-12, -18); ctx.lineTo(8, -20); ctx.lineTo(22, -10); ctx.lineTo(18, 0); ctx.closePath(); fillStroke(ctx, color);
      for (const x of [-10, -2]) { ctx.beginPath(); ctx.moveTo(x, -18); ctx.lineTo(x - 6, -30); ctx.lineTo(x + 4, -19); ctx.closePath(); fillStroke(ctx, '#fff8e1'); }
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(4, -12, 3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'brain':
      rr(ctx, -12, -6, 24, 6, 2); fillStroke(ctx, dark);
      ctx.beginPath(); ctx.arc(0, -8, 13, Math.PI, 0); ctx.closePath(); ctx.fillStyle = 'rgba(200,240,255,0.6)'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.arc(-4, -12, 5, 0, Math.PI * 2); ctx.arc(4, -12, 5, 0, Math.PI * 2); ctx.fill();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, -10, 13, 0, Math.PI * 2); fillStroke(ctx, METAL);
      rr(ctx, -6, -15, 20, 7, 3); fillStroke(ctx, '#29b6f6');
  }
  ctx.restore();
}

function drawArm(ctx, arm, color, side, t) {
  const dark = shade(color, side < 0 ? -0.35 : -0.2);
  ctx.save();
  ctx.translate(side < 0 ? -20 : 20, -60);
  rr(ctx, -6, -4, 12, 22, 5); fillStroke(ctx, dark);
  ctx.translate(side < 0 ? 4 : 8, 18);
  switch (arm) {
    case 'blaster': rr(ctx, -4, -6, 26, 10, 3); fillStroke(ctx, METAL_DARK); rr(ctx, 18, -4, 8, 6, 2); fillStroke(ctx, '#ef5350'); break;
    case 'lance': rr(ctx, -4, -4, 36, 6, 3); fillStroke(ctx, METAL); ctx.fillStyle = '#80d8ff'; ctx.fillRect(28, -3, 8, 4); break;
    case 'cannon': rr(ctx, -6, -9, 28, 16, 6); fillStroke(ctx, '#424a52'); ctx.beginPath(); ctx.arc(22, -1, 6, 0, Math.PI * 2); fillStroke(ctx, '#1b1f24'); break;
    case 'missile':
      rr(ctx, -6, -12, 24, 18, 3); fillStroke(ctx, METAL_DARK);
      for (const y of [-8, -1]) { ctx.beginPath(); ctx.moveTo(18, y - 2); ctx.lineTo(26, y + 1); ctx.lineTo(18, y + 4); ctx.closePath(); fillStroke(ctx, '#ff7043'); }
      break;
    case 'fist': rr(ctx, -4, -8, 20, 18, 6); fillStroke(ctx, color); ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(6, 8); ctx.stroke(); break;
    case 'saw':
      ctx.save(); ctx.translate(12, 0); ctx.rotate(t * 12);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 10 : 14; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); fillStroke(ctx, '#cfd8dc');
      ctx.restore();
      break;
    case 'hammer': rr(ctx, -2, -3, 22, 6, 2); fillStroke(ctx, '#8d6e63'); rr(ctx, 16, -12, 14, 24, 3); fillStroke(ctx, METAL_DARK); break;
    case 'shield':
      ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(20, -14); ctx.lineTo(20, 6); ctx.lineTo(12, 16); ctx.lineTo(4, 6); ctx.closePath(); fillStroke(ctx, METAL);
      ctx.beginPath(); ctx.moveTo(12, -10); ctx.lineTo(12, 8); ctx.stroke();
      break;
    case 'repair': rr(ctx, -2, -3, 22, 6, 2); fillStroke(ctx, METAL); ctx.beginPath(); ctx.arc(22, 0, 7, 0.6, Math.PI * 2 - 0.6); ctx.lineWidth = 5; ctx.strokeStyle = '#66bb6a'; ctx.stroke(); break;
    default: break;
  }
  ctx.restore();
}

// opts: { size, facing, t, glow, alpha, flash, guard }
export function drawRobot(ctx, x, y, bp, opts = {}) {
  const { size = 60, facing = 1, t = 0, glow = null, alpha = 1, flash = 0, secondary = null } = opts;
  const bob = bp.legs === 'jets' ? Math.sin(t * 4) * 3 - 6 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + bob * (size / 100));
  ctx.scale((size / 100) * facing, size / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (flash > 0) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 50 * flash; } else if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 24; }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  drawArm(ctx, bp.left, bp.color, -1, t);
  drawLegs(ctx, bp.legs, bp.color, t);
  drawBody(ctx, bp.body, bp.color);
  if (secondary) {
    ctx.beginPath(); ctx.arc(0, -48, 9, 0, Math.PI * 2); ctx.lineWidth = 3;
    ctx.fillStyle = secondary; ctx.strokeStyle = '#ffd54f'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
  }
  drawHead(ctx, bp.head, bp.color, t);
  ctx.shadowBlur = 0;
  drawArm(ctx, bp.right, bp.color, 1, t);
  ctx.restore();
}

// Draws a unit (normal or combined) using its blueprints.
export function drawUnit(ctx, x, y, unit, opts = {}) {
  const [first, ...rest] = unit.blueprints;
  const main = unit.recipe ? { ...first, legs: unit.legsId } : first;
  const glow = unit.recipe ? '#ffd54f' : opts.glow;
  if (unit.recipe && rest.length > 1) {
    // Triple combos get wings made from the third robot's color.
    ctx.save();
    ctx.translate(x, y - (opts.size || 60) * 0.55);
    ctx.fillStyle = rest[1].color; ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * (opts.size || 60) * 0.75, -(opts.size || 60) * 0.35); ctx.lineTo(s * (opts.size || 60) * 0.55, (opts.size || 60) * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  drawRobot(ctx, x, y, main, { ...opts, glow, secondary: rest[0]?.color || null });
}
