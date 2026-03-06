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

// ── Canvas ─────────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1060, CH = 1340;
canvas.width = CW; canvas.height = CH;

// ── Audio — auto-start ─────────────────────────────────────────
let ac = null;
let stepCount = 0;

function startAudio() {
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    buildAudio();
  } catch(e) {}
}
function buildAudio() {
  const master = ac.createGain();
  master.gain.value = 0.10;
  master.connect(ac.destination);

  // Low ambient drone
  [65, 98, 130].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.value = 0.2 / (i + 1);
    osc.connect(g); g.connect(master); osc.start();
  });

  // Rhythmic ticking that evolves as patterns emerge
  function tick() {
    if (!ac) return;
    const now = ac.currentTime;
    const progress = Math.min(1, stepCount / 15000);
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'sine';
    // Pitch rises from 200 → 1200 Hz as ant reaches highway
    osc.frequency.value = 200 + progress * 1000;
    env.gain.setValueAtTime(0.09, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(env); env.connect(master);
    osc.start(now); osc.stop(now + 0.09);
    // Tempo increases: 300ms → 60ms
    setTimeout(tick, Math.max(55, 300 - progress * 240));
  }
  tick();
}

// ── Grid ───────────────────────────────────────────────────────
const CELL = 5;  // 5px cells → sharp pixelated look
const COLS = Math.floor(CW / CELL);
const ROWS = Math.floor(CH / CELL);

// Each cell stores: state (0/1) and age (how recently touched, for color)
const state = new Uint8Array(COLS * ROWS);
// Age stores the step number when the cell was last visited
const lastVisit = new Int32Array(COLS * ROWS).fill(-9999);

const DX = [0, 1, 0, -1]; // N E S W
const DY = [-1, 0, 1, 0];

// ── Multi-ant setup ────────────────────────────────────────────
// 5 ants in a loose cluster — they interact with each other's trails
// creating chaotic then emergent patterns
const NANTS = 5;
const ants = [];
for (let i = 0; i < NANTS; i++) {
  ants.push({
    x:   Math.floor(COLS / 2) + (i - 2) * 3,
    y:   Math.floor(ROWS / 2) + (i % 3 - 1) * 3,
    dir: i % 4,
    hue: 160 + i * 40  // different hue per ant: teal, blue, purple, magenta, orange
  });
}

// Step all ants
function stepAnts() {
  for (const ant of ants) {
    const idx = ant.y * COLS + ant.x;
    if (state[idx] === 0) {
      ant.dir = (ant.dir + 1) % 4;  // white→turn right
      state[idx] = 1;
    } else {
      ant.dir = (ant.dir + 3) % 4;  // black→turn left
      state[idx] = 0;
    }
    lastVisit[idx] = stepCount;
    ant.x = (ant.x + DX[ant.dir] + COLS) % COLS;
    ant.y = (ant.y + DY[ant.dir] + ROWS) % ROWS;
  }
  stepCount++;
}

// ── Render ─────────────────────────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

// Map a cell to a color based on state + recency + ant color
function cellColor(gx, gy) {
  const i     = gy * COLS + gx;
  const s     = state[i];
  const age   = stepCount - lastVisit[i];  // steps since last touched

  if (age > 2000 && s === 0) {
    // Old, unvisited OFF cell → pure black
    return [6, 6, 10];
  }

  // Find which ant last visited (for hue)
  // Approximate: use position to pick ant color (simpler but fast)
  const recency = Math.max(0, 1 - age / 800); // 1=just visited, 0=old

  if (s === 1) {
    // ON cell: bright neon, color by recency
    // Recent = bright cyan/white, old = dimmer teal
    const bright = 0.35 + recency * 0.65;
    return [
      Math.round(0   * bright),
      Math.round(210 * bright),
      Math.round(255 * bright)
    ];
  } else {
    // OFF cell that was recently toggled → ghost trail (fading magenta)
    if (age > 800) return [6, 6, 10];
    const t = recency;
    return [
      Math.round(180 * t),
      Math.round(0   * t),
      Math.round(220 * t)
    ];
  }
}

function render() {
  // Clear to background
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 6; buf[i+1] = 6; buf[i+2] = 10; buf[i+3] = 255;
  }

  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const i   = gy * COLS + gx;
      const age = stepCount - lastVisit[i];
      const s   = state[i];
      if (age > 2000 && s === 0) continue; // skip untouched dark cells

      const [r, g, b] = cellColor(gx, gy);
      const px0 = gx * CELL, py0 = gy * CELL;
      for (let dy = 0; dy < CELL; dy++) {
        const py = py0 + dy; if (py >= CH) continue;
        for (let dx = 0; dx < CELL; dx++) {
          const px = px0 + dx; if (px >= CW) continue;
          const idx = (py * CW + px) * 4;
          buf[idx]   = r;
          buf[idx+1] = g;
          buf[idx+2] = b;
          buf[idx+3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw ant positions as glowing dots on top
  for (const ant of ants) {
    const cx = ant.x * CELL + CELL * 0.5;
    const cy = ant.y * CELL + CELL * 0.5;

    // Radial glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL * 4);
    grad.addColorStop(0, `hsla(${ant.hue},100%,75%,0.9)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 4, 0, Math.PI * 2);
    ctx.fill();

    // Bright core
    ctx.save();
    ctx.shadowColor = `hsl(${ant.hue},100%,70%)`;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Reset ──────────────────────────────────────────────────────
const RESET_AT = 250000;

function reset() {
  state.fill(0);
  lastVisit.fill(-9999);
  stepCount = 0;
  for (let i = 0; i < NANTS; i++) {
    ants[i].x   = Math.floor(COLS / 2) + (i - 2) * 3;
    ants[i].y   = Math.floor(ROWS / 2) + (i % 3 - 1) * 3;
    ants[i].dir = i % 4;
  }
}

// ── Animation ──────────────────────────────────────────────────
const SPF = 60; // steps per frame — fast enough to watch patterns grow in real time

function animate() {
  for (let i = 0; i < SPF; i++) {
    stepAnts();
    if (stepCount >= RESET_AT) { reset(); break; }
  }
  render();
  requestAnimationFrame(animate);
}

// Auto-start audio + click fallback
startAudio();
document.addEventListener('click', () => {
  if (!ac) startAudio();
  else if (ac.state === 'suspended') ac.resume();
}, { once: false });

requestAnimationFrame(animate);



