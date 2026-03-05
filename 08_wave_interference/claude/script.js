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
// Use half-resolution then scale up for speed
const CW = 530, CH = 670;
canvas.width  = CW * 2;
canvas.height = CH * 2;
canvas.style.width  = (CW * 2) + 'px';
canvas.style.height = (CH * 2) + 'px';

// ── Audio (started by user gesture via overlay) ───────────────
let ac = null;
const overlay = document.getElementById('startOverlay');

overlay.addEventListener('click', () => {
  overlay.classList.add('hidden');
  startAudio();
});

function startAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();

  const master = ac.createGain();
  master.gain.value = 0.14;
  master.connect(ac.destination);

  // 3 detuned sine drones — one per wave source, slight pitch modulation
  const freqs = [110, 146.8, 164.8]; // A2, D3, E3
  freqs.forEach((f, i) => {
    const osc  = ac.createOscillator();
    const g    = ac.createGain();
    const lfo  = ac.createOscillator();
    const lfoG = ac.createGain();

    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.value = 0.33;

    lfo.frequency.value = 0.12 + i * 0.07;
    lfoG.gain.value     = f * 0.012;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    lfo.start();

    osc.connect(g);
    g.connect(master);
    osc.start();
  });

  // Shimmer: high sine slowly sweeping
  const shimOsc = ac.createOscillator();
  const shimG   = ac.createGain();
  shimOsc.type = 'sine';
  shimOsc.frequency.value = 880;
  shimG.gain.value = 0.04;
  // Slow sweep
  shimOsc.frequency.setValueAtTime(880, ac.currentTime);
  shimOsc.frequency.linearRampToValueAtTime(1100, ac.currentTime + 8);
  shimOsc.connect(shimG);
  shimG.connect(master);
  shimOsc.start();
}

// ── Simulation ────────────────────────────────────────────────
// 4 wave sources that drift slowly around the canvas
const NUM = 4;
const srcs = [
  { ax: 0.25, ay: 0.30, vx:  0.0006, vy:  0.0003 },
  { ax: 0.75, ay: 0.35, vx: -0.0005, vy:  0.0004 },
  { ax: 0.50, ay: 0.65, vx:  0.0004, vy: -0.0005 },
  { ax: 0.30, ay: 0.70, vx: -0.0003, vy: -0.0006 },
];

// Different wavelengths for each source → complex interference
const KS   = [0.072, 0.060, 0.052, 0.066];
const AMPS  = [1.0, 0.85, 0.75, 0.90];
const PHASE_OFFSETS = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

let phase = 0;
const PHASE_SPEED = 0.12; // fast enough to look alive

// Pixel buffer
const imgData = ctx.createImageData(CW * 2, CH * 2);
const buf     = imgData.data;

// Colour mapping: value [-1,1] → vivid neon
// Uses a hue rotation so the whole spectrum cycles
let hueShift = 0;
function valueToColor(v) {
  // v in [-1,1]
  const n  = (v + 1) * 0.5;          // [0,1]
  const n2 = Math.pow(n, 1.4);        // gamma contrast

  // Hue cycle: deep blue (dark) → cyan → white (bright)
  // But we also add a slow hue shift over time for cinematic feel
  const hue = (hueShift + n2 * 200) % 360; // 200deg = blue→cyan→green arc
  const sat = 100;
  const lit = Math.round(n2 * n2 * 80); // 0–80%

  // HSL to RGB
  return hslToRgb(hue, sat, lit);
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function render() {
  // Move sources
  for (const s of srcs) {
    s.ax += s.vx; s.ay += s.vy;
    if (s.ax < 0.05 || s.ax > 0.95) s.vx *= -1;
    if (s.ay < 0.10 || s.ay > 0.90) s.vy *= -1;
  }

  const sx = srcs.map(s => s.ax * CW);
  const sy = srcs.map(s => s.ay * CH);

  // Compute at half resolution
  for (let py = 0; py < CH; py++) {
    for (let px = 0; px < CW; px++) {
      let sum = 0, wsum = 0;
      for (let i = 0; i < NUM; i++) {
        const dx = px - sx[i], dy = py - sy[i];
        const r  = Math.sqrt(dx*dx + dy*dy);
        const a  = AMPS[i] / (1 + r * 0.004);
        sum  += a * Math.sin(KS[i] * r - phase + PHASE_OFFSETS[i]);
        wsum += a;
      }
      const v = sum / (wsum + 0.001);
      const [r, g, b] = valueToColor(v);

      // Write to 2×2 block (upscale)
      const bx = px * 2, by = py * 2;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const idx = ((by + dy) * CW * 2 + (bx + dx)) * 4;
          buf[idx]   = r;
          buf[idx+1] = g;
          buf[idx+2] = b;
          buf[idx+3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw source glows on top
  for (let i = 0; i < NUM; i++) {
    const x = sx[i] * 2, y = sy[i] * 2;
    const hue = (hueShift + i * 90) % 360;

    // Glow halo
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 60);
    grad.addColorStop(0, `hsla(${hue},100%,80%,0.8)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, 60, 0, Math.PI*2); ctx.fill();

    // Core
    ctx.save();
    ctx.shadowColor = `hsl(${hue},100%,70%)`;
    ctx.shadowBlur  = 25;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function animate() {
  phase     += PHASE_SPEED;
  hueShift   = (hueShift + 0.15) % 360;
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
