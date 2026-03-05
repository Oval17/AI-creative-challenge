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

// ── Audio ─────────────────────────────────────────────────────
let ac = null;
async function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  await ac.resume();
  startDrone();
}
['click','keydown','touchstart','pointerdown'].forEach(e =>
  document.addEventListener(e, initAudio, { once: true, passive: true })
);
// Try auto-start
setTimeout(() => initAudio(), 300);

function startDrone() {
  if (!ac) return;
  // Ambient drone: two detuned oscillators + reverb-like delay
  const master = ac.createGain();
  master.gain.value = 0.12;
  master.connect(ac.destination);

  const freqs = [110, 110.5, 220, 220.3, 330];
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = i < 2 ? 'sine' : 'triangle';
    osc.frequency.value = f;
    g.gain.value = i < 2 ? 0.4 : 0.15;
    osc.connect(g); g.connect(master);
    osc.start();
  });

  // Slow LFO pitch wobble for hypnotic feel
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 4;
  lfo.connect(lfoGain);
  lfo.start();
}

// ── Wave sources ─────────────────────────────────────────────
// Three sources for richer interference
const NUM_SOURCES = 3;
const sources = [
  { ax: 0.30, ay: 0.45, vax: 0.0003, vay: 0.00015 },
  { ax: 0.70, ay: 0.55, vax: -0.0002, vay: 0.00025 },
  { ax: 0.50, ay: 0.30, vax: 0.00015, vay: -0.0003 },
];

// Wave parameters
const WAVELENGTH = 80;
const k = (2 * Math.PI) / WAVELENGTH;
let phase = 0;
const PHASE_SPEED = 0.055;

// ── Pixel buffer ──────────────────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

// ── Render ────────────────────────────────────────────────────
function render() {
  // Update source positions (slow circular drift)
  for (const s of sources) {
    s.ax += s.vax; s.ay += s.vay;
    if (s.ax < 0.1 || s.ax > 0.9) s.vax *= -1;
    if (s.ay < 0.15 || s.ay > 0.85) s.vay *= -1;
  }

  const sx = sources.map(s => s.ax * CW);
  const sy = sources.map(s => s.ay * CH);

  for (let py = 0; py < CH; py++) {
    for (let px = 0; px < CW; px++) {
      let sum = 0;
      for (let i = 0; i < NUM_SOURCES; i++) {
        const dx = px - sx[i], dy = py - sy[i];
        const r = Math.sqrt(dx * dx + dy * dy);
        const amp = 1 / (1 + r * 0.008);
        sum += amp * Math.sin(k * r - phase + i * Math.PI * 0.4);
      }

      // Normalize: sum in [-NUM_SOURCES, NUM_SOURCES] → [0,1]
      const n = (sum / NUM_SOURCES + 1) * 0.5;
      // Contrast gamma
      const n2 = Math.pow(n, 1.6);

      // Vivid neon colour mapping
      // n2 near 1 = bright cyan-white, near 0.5 = magenta, near 0 = deep blue
      let r, g, b;
      if (n2 < 0.5) {
        const t = n2 * 2; // 0..1
        r = Math.round(t * 180);
        g = Math.round(t * 0);
        b = Math.round(20 + t * 235);
      } else {
        const t = (n2 - 0.5) * 2; // 0..1
        r = Math.round(180 - t * 60);
        g = Math.round(t * 255);
        b = Math.round(255 - t * 55);
      }

      const idx = (py * CW + px) * 4;
      buf[idx]     = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw glowing source rings + dots
  for (let i = 0; i < NUM_SOURCES; i++) {
    const x = sx[i], y = sy[i];
    // Expanding ring pulse
    const ringR = ((phase * 18 + i * 120) % 200) + 10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${180 + i * 60}, 100%, 75%, ${0.4 * (1 - ringR / 210)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `hsla(${180 + i * 60}, 100%, 75%, 0.9)`;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Core dot
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Animation ─────────────────────────────────────────────────
function animate() {
  phase += PHASE_SPEED;
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
