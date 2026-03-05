'use strict';

// ── Scale wrapper ─────────────────────────────────────────────
const W = 1080, H = 1920;
const wrapper = document.querySelector('.wrapper');
function scaleWrapper() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  wrapper.style.transform = `scale(${s})`;
  wrapper.style.left = ((window.innerWidth  - W * s) / 2) + 'px';
  wrapper.style.top  = ((window.innerHeight - H * s) / 2) + 'px';
}
scaleWrapper();
window.addEventListener('resize', scaleWrapper);

// ── Canvas ────────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1060, CH = 1340;
canvas.width = CW; canvas.height = CH;

// ── Wave sources (slowly drift apart and together) ────────────
const sources = [
  { x: CW * 0.35, y: CH * 0.5, vx: 0.18, vy: 0.09 },
  { x: CW * 0.65, y: CH * 0.5, vx: -0.18, vy: -0.09 },
];

// Wave parameters
const WAVELENGTH  = 72;
const SPEED       = 1.4;    // phase advance per frame
const AMPLITUDE   = 1.0;

// ImageData for pixel-level rendering
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

let t = 0;
const k = (2 * Math.PI) / WAVELENGTH;  // wave number

// ── Precompute source distances each frame ─────────────────────
function render() {
  const s0x = sources[0].x, s0y = sources[0].y;
  const s1x = sources[1].x, s1y = sources[1].y;
  const phase = t * SPEED;

  for (let py = 0; py < CH; py++) {
    for (let px = 0; px < CW; px++) {
      const dx0 = px - s0x, dy0 = py - s0y;
      const dx1 = px - s1x, dy1 = py - s1y;
      const r0  = Math.sqrt(dx0*dx0 + dy0*dy0);
      const r1  = Math.sqrt(dx1*dx1 + dy1*dy1);

      // superposition of two sinusoidal waves, 1/sqrt(r) falloff
      const a0 = r0 < 1 ? 1 : AMPLITUDE / Math.sqrt(r0 + 1);
      const a1 = r1 < 1 ? 1 : AMPLITUDE / Math.sqrt(r1 + 1);
      const w0 = a0 * Math.sin(k * r0 - phase);
      const w1 = a1 * Math.sin(k * r1 - phase);

      // Superposition: range [-2, 2] → normalise to [0, 1]
      const val  = (w0 + w1 + 2) * 0.25;  // 0..1
      const val2 = val * val;              // contrast boost

      // Neon cyan/magenta colour mapping
      const bright = val2 * 255;
      const idx = (py * CW + px) * 4;

      // Constructive = cyan (#00ffff), destructive = deep indigo, midpoint = purple
      const r = Math.round(bright * 0.4 + val2 * 80);
      const g = Math.round(bright * 0.9);
      const b = Math.round(bright * 1.0);

      buf[idx]     = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw glowing source markers
  for (const s of sources) {
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 28;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Move sources slowly ───────────────────────────────────────
const MARGIN = 120;
function moveSources() {
  for (const s of sources) {
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < MARGIN || s.x > CW - MARGIN) s.vx *= -1;
    if (s.y < MARGIN || s.y > CH - MARGIN) s.vy *= -1;
  }
}

// ── Animation ─────────────────────────────────────────────────
function animate() {
  moveSources();
  render();
  t++;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
