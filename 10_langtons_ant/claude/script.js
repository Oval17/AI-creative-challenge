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
  startAmbient();
}
['click','keydown','touchstart','pointerdown'].forEach(e =>
  document.addEventListener(e, initAudio, { once: true, passive: true })
);
setTimeout(() => initAudio(), 300);

let stepGlobal = 0;
function startAmbient() {
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0.09;
  master.connect(ac.destination);

  // Base drone
  [80, 120, 160].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.value = 0.15 / (i + 1);
    osc.connect(g); g.connect(master);
    osc.start();
  });

  // Rhythmic click that speeds up as the ant enters highway phase
  function click() {
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'square';
    // Pitch rises as pattern gets ordered
    const progress = Math.min(1, stepGlobal / 12000);
    osc.frequency.value = 300 + progress * 900;
    env.gain.setValueAtTime(0.07, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(env); env.connect(master);
    osc.start(now); osc.stop(now + 0.06);
    // Gets faster as highway builds
    const interval = Math.max(40, 200 - progress * 160);
    setTimeout(click, interval);
  }
  click();
}

// ── Grid config ───────────────────────────────────────────────
const CELL = 6;
const COLS = Math.floor(CW / CELL);
const ROWS = Math.floor(CH / CELL);

// Grid state: 0=off, 1=on; age: how many steps since last touched
const grid  = new Uint8Array(COLS * ROWS);
const age   = new Float32Array(COLS * ROWS); // 0=just touched, fades out

const DX = [0, 1, 0, -1]; // UP RIGHT DOWN LEFT
const DY = [-1, 0, 1, 0];

// ── Ants ──────────────────────────────────────────────────────
// Single primary ant + 2 colour-shifted ants offset in space
const ants = [
  { x: Math.floor(COLS/2),     y: Math.floor(ROWS/2),     dir: 0, color: [0, 230, 255],   glowColor: '#00e6ff' },
  { x: Math.floor(COLS/2)+12,  y: Math.floor(ROWS/2)-8,  dir: 1, color: [255, 50, 180],  glowColor: '#ff32b4' },
  { x: Math.floor(COLS/2)-10,  y: Math.floor(ROWS/2)+10, dir: 2, color: [255, 210, 0],   glowColor: '#ffd200' },
];

function stepAnt(ant) {
  const i = ant.y * COLS + ant.x;
  if (grid[i] === 0) {
    ant.dir = (ant.dir + 1) % 4; grid[i] = 1;
  } else {
    ant.dir = (ant.dir + 3) % 4; grid[i] = 0;
  }
  age[i] = 1.0; // freshly touched = fully bright
  ant.x = (ant.x + DX[ant.dir] + COLS) % COLS;
  ant.y = (ant.y + DY[ant.dir] + ROWS) % ROWS;
}

// ── Render ────────────────────────────────────────────────────
// Off-screen ImageData approach for speed
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

const FADE_RATE = 0.0012; // per frame — slow trail

// ON-cell base colour: neon cyan
const ON_BASE = [0, 180, 220];

function render() {
  // Fade ages
  for (let i = 0; i < age.length; i++) {
    if (age[i] > 0) age[i] = Math.max(0, age[i] - FADE_RATE);
  }

  // Clear buffer to background
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 6; buf[i+1] = 6; buf[i+2] = 10; buf[i+3] = 255;
  }

  // Draw grid cells
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const gi = gy * COLS + gx;
      const state = grid[gi];
      const a = age[gi];

      // Only draw if on or has recent age
      if (state === 0 && a < 0.01) continue;

      let cr, cg, cb;
      if (state === 1) {
        // Active ON cell: bright neon cyan with age brightness
        const bright = 0.4 + a * 0.6;
        cr = Math.round(ON_BASE[0] * bright);
        cg = Math.round(ON_BASE[1] * bright);
        cb = Math.round(ON_BASE[2] * bright);
      } else {
        // OFF cell fading out — ghost trail
        const t = a;
        cr = Math.round(0   * t);
        cg = Math.round(120 * t);
        cb = Math.round(180 * t);
      }

      const pxBase = gx * CELL, pyBase = gy * CELL;
      for (let dy = 0; dy < CELL; dy++) {
        const py = pyBase + dy; if (py >= CH) continue;
        for (let dx = 0; dx < CELL; dx++) {
          const px = pxBase + dx; if (px >= CW) continue;
          const idx = (py * CW + px) * 4;
          buf[idx]   = cr; buf[idx+1] = cg; buf[idx+2] = cb; buf[idx+3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Draw ant glow on top of ImageData
  for (const ant of ants) {
    const cx = ant.x * CELL + CELL * 0.5;
    const cy = ant.y * CELL + CELL * 0.5;

    // Outer glow halo
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL * 3);
    grad.addColorStop(0, ant.glowColor + 'cc');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - CELL*3, cy - CELL*3, CELL*6, CELL*6);

    // Bright core dot
    ctx.save();
    ctx.shadowColor = ant.glowColor;
    ctx.shadowBlur  = 22;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Step counter & reset ──────────────────────────────────────
const RESET_AFTER = 200000;

function reset() {
  grid.fill(0); age.fill(0); stepGlobal = 0;
  ants[0].x = Math.floor(COLS/2);    ants[0].y = Math.floor(ROWS/2);    ants[0].dir = 0;
  ants[1].x = Math.floor(COLS/2)+12; ants[1].y = Math.floor(ROWS/2)-8;  ants[1].dir = 1;
  ants[2].x = Math.floor(COLS/2)-10; ants[2].y = Math.floor(ROWS/2)+10; ants[2].dir = 2;
}

// ── Animation ─────────────────────────────────────────────────
const SPF = 80; // steps per frame — visible but not instant

function animate() {
  for (let i = 0; i < SPF; i++) {
    for (const ant of ants) stepAnt(ant);
    stepGlobal++;
    if (stepGlobal >= RESET_AFTER) { reset(); break; }
  }
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
