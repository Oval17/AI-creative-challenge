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

// ── Auto Audio — no overlay needed ───────────────────────────
let ac = null;

function startAudio() {
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') { ac.resume(); }
    buildAudio();
  } catch(e) {}
}

function buildAudio() {
  const master = ac.createGain();
  master.gain.value = 0.10;
  master.connect(ac.destination);

  // 3 pure tones matching the 3 source colors: warm/cool/neutral
  const freqs = [110, 138.6, 165];  // A2, C#3, E3 — open 5th chord
  freqs.forEach((f, i) => {
    const osc  = ac.createOscillator();
    const g    = ac.createGain();
    const lfo  = ac.createOscillator();
    const lfoG = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.value = 0.28;
    lfo.frequency.value = 0.08 + i * 0.05;
    lfoG.gain.value = f * 0.01;
    lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
    osc.connect(g); g.connect(master); osc.start();
  });
}

// Try autoplay immediately
startAudio();
// Fallback: resume on first user interaction
document.addEventListener('click', () => {
  if (!ac) { startAudio(); }
  else if (ac.state === 'suspended') { ac.resume(); }
}, { once: false });

// ── 3 Wave Sources — fixed positions + slow drift ─────────────
// 3 sources with very distinct colors: CYAN, MAGENTA, YELLOW
const SOURCES = [
  { ax: 0.25, ay: 0.25, vx:  0.0007, vy:  0.0004, k: 0.068, r: 0,   g: 220, b: 255 },  // CYAN
  { ax: 0.75, ay: 0.30, vx: -0.0005, vy:  0.0006, k: 0.055, r: 255, g: 0,   b: 200 },  // MAGENTA
  { ax: 0.50, ay: 0.72, vx:  0.0004, vy: -0.0007, k: 0.062, r: 255, g: 220, b: 0   },  // YELLOW
];

let phase = 0;
const PHASE_SPEED = 0.10;

const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

function render() {
  // Move sources
  for (const s of SOURCES) {
    s.ax += s.vx; s.ay += s.vy;
    if (s.ax < 0.08 || s.ax > 0.92) s.vx *= -1;
    if (s.ay < 0.08 || s.ay > 0.92) s.vy *= -1;
  }

  const sx = SOURCES.map(s => s.ax * CW);
  const sy = SOURCES.map(s => s.ay * CH);

  // Per-pixel superposition — compute each source's contribution
  // Key insight: use ADDITIVE color blending per source
  // Crest (+1) → full source color, Trough (-1) → black, 0 → dim
  for (let py = 0; py < CH; py++) {
    for (let px = 0; px < CW; px++) {
      let totalR = 0, totalG = 0, totalB = 0;

      for (let i = 0; i < 3; i++) {
        const dx = px - sx[i], dy = py - sy[i];
        const dist = Math.sqrt(dx*dx + dy*dy);
        // Amplitude falls off with distance
        const amp = 1.0 / (1.0 + dist * 0.003);
        // Wave value in [0,1]: 0=trough (dark), 1=crest (bright)
        const wave = (Math.sin(SOURCES[i].k * dist - phase) + 1) * 0.5;
        const bright = amp * wave * wave; // square for more contrast

        totalR += bright * SOURCES[i].r;
        totalG += bright * SOURCES[i].g;
        totalB += bright * SOURCES[i].b;
      }

      // Clamp with strong contrast curve
      const idx = (py * CW + px) * 4;
      buf[idx]   = Math.min(255, Math.round(totalR * 0.8));
      buf[idx+1] = Math.min(255, Math.round(totalG * 0.8));
      buf[idx+2] = Math.min(255, Math.round(totalB * 0.8));
      buf[idx+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw source dots with their color + white core
  for (let i = 0; i < 3; i++) {
    const x = sx[i], y = sy[i];
    const s = SOURCES[i];
    const col = `rgb(${s.r},${s.g},${s.b})`;

    // Outer glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 55);
    grad.addColorStop(0, col.replace('rgb', 'rgba').replace(')', ',0.9)'));
    grad.addColorStop(0.4, col.replace('rgb', 'rgba').replace(')', ',0.4)'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI*2); ctx.fill();

    // White center
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function animate() {
  phase += PHASE_SPEED;
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);



