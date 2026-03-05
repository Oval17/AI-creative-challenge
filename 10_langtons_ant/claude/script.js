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

// ── Grid config ───────────────────────────────────────────────
const CELL = 5;                          // px per grid cell
const COLS = Math.floor(CW / CELL);
const ROWS = Math.floor(CH / CELL);

// Grid: 0 = white (off), 1 = black (on)
const grid = new Uint8Array(COLS * ROWS);

// Directions: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// ── Multiple ants (different start positions & directions) ────
const ANTS = 3;
const ants = [];

function initAnts() {
  for (let i = 0; i < ANTS; i++) {
    ants.push({
      x: Math.floor(COLS / 2) + (i - 1) * Math.floor(COLS / 5),
      y: Math.floor(ROWS / 2),
      dir: i % 4,
    });
  }
}

// Ant colours (neon trail colours)
const ANT_COLORS = ['#ff3399', '#00ffcc', '#ffcc00'];

// ── Trail image data ─────────────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

// Fill buffer with dark background
function clearBuf() {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i]     = 8;
    buf[i + 1] = 8;
    buf[i + 2] = 14;
    buf[i + 3] = 255;
  }
}

// Set a cell in the buffer
function setCellColor(gx, gy, r, g, b) {
  for (let dy = 0; dy < CELL; dy++) {
    for (let dx = 0; dx < CELL; dx++) {
      const px = gx * CELL + dx;
      const py = gy * CELL + dy;
      if (px >= CW || py >= CH) continue;
      const idx = (py * CW + px) * 4;
      buf[idx]     = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }
}

// Parse hex color to rgb
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ANT_RGB = ANT_COLORS.map(hexRgb);

// Neon cyan for "on" cells, deep navy for "off"
const ON_R = 0, ON_G = 220, ON_B = 255;
const OFF_R = 8, OFF_G = 8, OFF_B = 14;

// ── Step ─────────────────────────────────────────────────────
function stepAnt(ant) {
  const i = ant.y * COLS + ant.x;
  if (grid[i] === 0) {
    // White cell: turn right
    ant.dir = (ant.dir + 1) % 4;
    grid[i] = 1;
  } else {
    // Black cell: turn left
    ant.dir = (ant.dir + 3) % 4;
    grid[i] = 0;
  }
  ant.x = (ant.x + DX[ant.dir] + COLS) % COLS;
  ant.y = (ant.y + DY[ant.dir] + ROWS) % ROWS;
}

// ── Full redraw from grid state ───────────────────────────────
function fullRedraw() {
  clearBuf();
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      if (grid[gy * COLS + gx] === 1) {
        setCellColor(gx, gy, ON_R, ON_G, ON_B);
      }
    }
  }
  // Draw ant positions on top
  for (let a = 0; a < ANTS; a++) {
    const [r, g, b] = ANT_RGB[a];
    setCellColor(ants[a].x, ants[a].y, r, g, b);
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Overlay glow for ant positions ───────────────────────────
function drawAntGlow() {
  for (let a = 0; a < ANTS; a++) {
    const ant = ants[a];
    const cx = ant.x * CELL + CELL / 2;
    const cy = ant.y * CELL + CELL / 2;
    ctx.save();
    ctx.shadowColor = ANT_COLORS[a];
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = ANT_COLORS[a];
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Step counter / reset logic ────────────────────────────────
let stepCount = 0;
const RESET_AT = 160000;  // Reset after enough steps to show highway pattern

function reset() {
  grid.fill(0);
  ants.length = 0;
  initAnts();
  stepCount = 0;
}

// ── Animation ─────────────────────────────────────────────────
const STEPS_PER_FRAME = 120;  // fast enough to see the highway emerge

function animate() {
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    for (const ant of ants) stepAnt(ant);
    stepCount++;
    if (stepCount >= RESET_AT) { reset(); break; }
  }
  fullRedraw();
  drawAntGlow();
  requestAnimationFrame(animate);
}

initAnts();
requestAnimationFrame(animate);
