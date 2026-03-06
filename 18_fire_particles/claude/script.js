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

// ── Particle pool ─────────────────────────────────────────────
const MAX_PARTICLES = 1800;
const particles = [];

function spawnParticle() {
  // Spread across bottom 60% of canvas width — multiple fire sources
  const bx = CW / 2 + (Math.random() - 0.5) * CW * 0.55;
  const by = CH - 40;
  const speed = 1.5 + Math.random() * 4;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
  return {
    x: bx + (Math.random() - 0.5) * 20,
    y: by,
    vx: Math.cos(angle) * speed * 0.4,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 55 + Math.random() * 90,
    size: 6 + Math.random() * 14,
    wobble: (Math.random() - 0.5) * 0.08,
  };
}

// Pre-fill
for (let i = 0; i < MAX_PARTICLES; i++) {
  const p = spawnParticle();
  p.life = Math.random() * p.maxLife; // stagger
  particles.push(p);
}

// ── Ember sparks ──────────────────────────────────────────────
const MAX_EMBERS = 300;
const embers = [];
function spawnEmber() {
  const bx = CW / 2 + (Math.random() - 0.5) * CW * 0.45;
  return {
    x: bx,
    y: CH - 30 - Math.random() * 80,
    vx: (Math.random() - 0.5) * 2.5,
    vy: -(2 + Math.random() * 4),
    life: 0,
    maxLife: 80 + Math.random() * 100,
    size: 1.5 + Math.random() * 2.5,
  };
}
for (let i = 0; i < MAX_EMBERS; i++) {
  const e = spawnEmber();
  e.life = Math.random() * e.maxLife;
  embers.push(e);
}

// ── Fire color ────────────────────────────────────────────────
// t = 0 (base) → t = 1 (tip)
// base: white-yellow → orange → red → dark red → transparent
function fireColor(t, alpha) {
  if (t < 0.2) {
    // White core
    const g = Math.floor(lerp(255, 200, t / 0.2));
    const b = Math.floor(lerp(220, 80,  t / 0.2));
    return `rgba(255,${g},${b},${alpha})`;
  } else if (t < 0.5) {
    const tt = (t - 0.2) / 0.3;
    const g  = Math.floor(lerp(200, 80, tt));
    return `rgba(255,${g},0,${alpha})`;
  } else if (t < 0.8) {
    const tt = (t - 0.5) / 0.3;
    const r  = Math.floor(lerp(255, 140, tt));
    return `rgba(${r},0,0,${alpha})`;
  } else {
    const tt = (t - 0.8) / 0.2;
    const r  = Math.floor(lerp(140, 30, tt));
    return `rgba(${r},0,0,${alpha * (1 - tt)})`;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Render ────────────────────────────────────────────────────
function render() {
  // Dark fade — keeps a glow of heat on the canvas
  ctx.fillStyle = 'rgba(5,5,5,0.35)';
  ctx.fillRect(0, 0, CW, CH);

  // Particles
  ctx.globalCompositeOperation = 'lighter';

  for (const p of particles) {
    const t = p.life / p.maxLife;  // 0 = birth at base, 1 = tip
    const alpha = t < 0.85 ? 0.55 : 0.55 * (1 - (t - 0.85) / 0.15);
    const col = fireColor(t, alpha);
    const r   = p.size * (1 - t * 0.5);

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Embers
  for (const e of embers) {
    const t = e.life / e.maxLife;
    const alpha = t < 0.7 ? 0.9 : 0.9 * (1 - (t - 0.7) / 0.3);
    ctx.fillStyle = `rgba(255,${Math.floor(lerp(200, 80, t))},0,${alpha})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * (1 - t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';

  // Ground glow
  const groundGrad = ctx.createLinearGradient(0, CH - 120, 0, CH);
  groundGrad.addColorStop(0, 'rgba(255,80,0,0.0)');
  groundGrad.addColorStop(1, 'rgba(255,30,0,0.18)');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, CH - 120, CW, 120);
}

// ── Update ────────────────────────────────────────────────────
function update() {
  for (const p of particles) {
    p.life++;
    p.x += p.vx + Math.sin(p.life * 0.15 + p.wobble * 20) * 1.2;
    p.y += p.vy;
    p.vy *= 0.985;
    p.vx *= 0.98;
    if (p.life >= p.maxLife) {
      Object.assign(p, spawnParticle());
    }
  }
  for (const e of embers) {
    e.life++;
    e.x += e.vx + (Math.random() - 0.5) * 0.8;
    e.y += e.vy;
    e.vy *= 0.992;
    e.vx *= 0.995;
    if (e.life >= e.maxLife) {
      Object.assign(e, spawnEmber());
    }
  }
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  update();
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
