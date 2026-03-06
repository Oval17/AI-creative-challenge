'use strict';

// ── Scale wrapper ─────────────────────────────────────────────
const W = 1080, H = 1920;
const wrapper = document.querySelector('.wrapper');
function scaleWrapper() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  wrapper.style.transform = `scale(${s})`;
  wrapper.style.left = ((window.innerWidth - W * s) / 2) + 'px';
  wrapper.style.top  = ((window.innerHeight - H * s) / 2) + 'px';
}
scaleWrapper();
window.addEventListener('resize', scaleWrapper);

// ── Canvas ────────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1060, CH = 1340;
canvas.width = CW; canvas.height = CH;

const cx = CW / 2;
const cy = CH * 0.32;

// ── Physics constants ─────────────────────────────────────────
const G  = 9.81;
const DT = 0.03;
const STEPS_PER_FRAME = 4;
const MAX_TRAIL = 2000;

// Multiple pendulums — tiny angle offset → chaos divergence
const NUM = 5;
const pendulums = [];
for (let i = 0; i < NUM; i++) {
  const s = (i - (NUM - 1) / 2) * 0.018;
  pendulums.push({
    l1: 220, l2: 190,
    m1: 12,  m2: 10,
    a1: Math.PI / 2 + s,
    a2: Math.PI / 2 + s * 1.4,
    v1: 0,   v2: 0,
    trail: [],
    hue: 190 + i * 38,
  });
}

// ── RK4 derivatives ───────────────────────────────────────────
function deriv(l1, l2, m1, m2, a1, a2, v1, v2) {
  const da     = a1 - a2;
  const denom1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * da));
  const dv1 = (
    -G * (2 * m1 + m2) * Math.sin(a1)
    - m2 * G * Math.sin(a1 - 2 * a2)
    - 2 * Math.sin(da) * m2 * (v2 * v2 * l2 + v1 * v1 * l1 * Math.cos(da))
  ) / denom1;

  const denom2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * da));
  const dv2 = (
    2 * Math.sin(da) * (
      v1 * v1 * l1 * (m1 + m2)
      + G * (m1 + m2) * Math.cos(a1)
      + v2 * v2 * l2 * m2 * Math.cos(da)
    )
  ) / denom2;

  return { da1: v1, da2: v2, dv1, dv2 };
}

function stepRK4(p, dt) {
  const { l1, l2, m1, m2 } = p;
  let { a1, a2, v1, v2 } = p;

  const k1 = deriv(l1, l2, m1, m2, a1, a2, v1, v2);
  const k2 = deriv(l1, l2, m1, m2,
    a1 + 0.5 * dt * k1.da1, a2 + 0.5 * dt * k1.da2,
    v1 + 0.5 * dt * k1.dv1, v2 + 0.5 * dt * k1.dv2);
  const k3 = deriv(l1, l2, m1, m2,
    a1 + 0.5 * dt * k2.da1, a2 + 0.5 * dt * k2.da2,
    v1 + 0.5 * dt * k2.dv1, v2 + 0.5 * dt * k2.dv2);
  const k4 = deriv(l1, l2, m1, m2,
    a1 + dt * k3.da1, a2 + dt * k3.da2,
    v1 + dt * k3.dv1, v2 + dt * k3.dv2);

  p.a1 += dt * (k1.da1 + 2 * k2.da1 + 2 * k3.da1 + k4.da1) / 6;
  p.a2 += dt * (k1.da2 + 2 * k2.da2 + 2 * k3.da2 + k4.da2) / 6;
  p.v1 += dt * (k1.dv1 + 2 * k2.dv1 + 2 * k3.dv1 + k4.dv1) / 6;
  p.v2 += dt * (k1.dv2 + 2 * k2.dv2 + 2 * k3.dv2 + k4.dv2) / 6;

  const x1 = cx + p.l1 * Math.sin(p.a1);
  const y1 = cy + p.l1 * Math.cos(p.a1);
  const x2 = x1 + p.l2 * Math.sin(p.a2);
  const y2 = y1 + p.l2 * Math.cos(p.a2);
  p.trail.push({ x: x2, y: y2 });
  if (p.trail.length > MAX_TRAIL) p.trail.shift();
}

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = 'rgba(8,8,8,0.16)';
  ctx.fillRect(0, 0, CW, CH);

  for (const p of pendulums) {
    const x1 = cx + p.l1 * Math.sin(p.a1);
    const y1 = cy + p.l1 * Math.cos(p.a1);
    const x2 = x1 + p.l2 * Math.sin(p.a2);
    const y2 = y1 + p.l2 * Math.cos(p.a2);

    // Trail
    ctx.lineCap = 'round';
    if (p.trail.length > 1) {
      for (let i = 1; i < p.trail.length; i++) {
        const t = i / p.trail.length;
        ctx.strokeStyle = `hsla(${p.hue},90%,62%,${t * 0.65})`;
        ctx.lineWidth   = 0.8 + t * 2.2;
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.stroke();
      }
    }

    // Rods
    ctx.strokeStyle = `hsla(${p.hue},55%,45%,0.65)`;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Bobs
    ctx.save();
    ctx.shadowColor = `hsl(${p.hue},100%,70%)`;
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = `hsl(${p.hue},100%,75%)`;
    ctx.beginPath(); ctx.arc(x1, y1, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y2,  9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Pivot
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  for (let s = 0; s < STEPS_PER_FRAME; s++) {
    pendulums.forEach(p => stepRK4(p, DT));
  }
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
