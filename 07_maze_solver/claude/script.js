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
const CW = 1040, CH = 1300;
canvas.width = CW; canvas.height = CH;

// ── Maze config ───────────────────────────────────────────────
const COLS = 39, ROWS = 49;
const CELL = Math.floor(Math.min(CW / COLS, CH / ROWS));
const OX   = Math.floor((CW - COLS * CELL) / 2);
const OY   = Math.floor((CH - ROWS * CELL) / 2);
const WALL = 0, PASSAGE = 1;

// ── State ─────────────────────────────────────────────────────
let grid       = [];
let genSteps   = [];
let solveSteps = [];
let genIdx     = 0;
let stepIdx    = 0;
let phase      = 'generating';
let lastT      = 0;

let exploreMap   = new Map();
let pathMap      = new Map();
let carveMap     = new Map();
let frontierCell = null;

// ── Grid init ─────────────────────────────────────────────────
function makeGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = new Array(COLS).fill(WALL);
  }
}

// ── DFS maze generation ───────────────────────────────────────
function buildMaze() {
  makeGrid();
  genSteps = [];
  const visited = Array.from({length: ROWS}, () => new Array(COLS).fill(false));
  const stack = [[1, 1]];
  grid[1][1] = PASSAGE;
  visited[1][1] = true;
  genSteps.push({r: 1, c: 1});

  const dirs = [[-2,0],[2,0],[0,-2],[0,2]];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const shuffled = dirs.slice().sort(() => Math.random() - 0.5);
    let moved = false;
    for (const [dr, dc] of shuffled) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < ROWS-1 && nc > 0 && nc < COLS-1 && !visited[nr][nc]) {
        const wr = r + dr/2, wc = c + dc/2;
        grid[wr][wc] = PASSAGE;
        grid[nr][nc] = PASSAGE;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
        genSteps.push({r: wr, c: wc});
        genSteps.push({r: nr, c: nc});
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }
}

// ── A* solver ─────────────────────────────────────────────────
function solveMaze() {
  solveSteps = [];
  const START = [1, 1];
  const END   = [ROWS - 2, COLS - 2];
  const key   = (r, c) => r * COLS + c;
  const h     = (r, c) => Math.abs(r - END[0]) + Math.abs(c - END[1]);

  const open     = new Map();
  const closed   = new Set();
  const cameFrom = new Map();
  const gScore   = new Map();
  const fScore   = new Map();

  const sk = key(...START);
  gScore.set(sk, 0);
  fScore.set(sk, h(...START));
  open.set(sk, START);

  while (open.size) {
    let curKey = null, cur = null, best = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < best) { best = f; curKey = k; cur = node; }
    }
    open.delete(curKey);

    if (cur[0] === END[0] && cur[1] === END[1]) {
      // reconstruct path
      const path = [];
      let k = curKey;
      while (k !== undefined) {
        path.push([Math.floor(k / COLS), k % COLS]);
        const prev = cameFrom.get(k);
        k = prev !== undefined ? key(...prev) : undefined;
      }
      path.reverse();
      for (const [r, c] of path) solveSteps.push({type: 'path', r, c});
      return;
    }

    closed.add(curKey);
    solveSteps.push({type: 'explore', r: cur[0], c: cur[1]});

    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cur[0]+dr, nc = cur[1]+dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (grid[nr][nc] === WALL) continue;
      const nk = key(nr, nc);
      if (closed.has(nk)) continue;
      const tg = (gScore.get(curKey) ?? Infinity) + 1;
      if (tg < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, cur);
        gScore.set(nk, tg);
        fScore.set(nk, tg + h(nr, nc));
        open.set(nk, [nr, nc]);
      }
    }
  }
}

// ── Draw ──────────────────────────────────────────────────────
function drawCell(r, c, color, glowColor) {
  const x = OX + c * CELL, y = OY + r * CELL;
  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = CELL * 2.2;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);
  if (glowColor) ctx.restore();
}

function draw() {
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, CW, CH);

  // Draw grid cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = OX + c * CELL, y = OY + r * CELL;
      if (grid[r][c] === WALL) {
        ctx.fillStyle = '#0c1019';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = 'rgba(0,180,255,0.09)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      } else {
        ctx.fillStyle = '#12131e';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }

  // Explored (A* frontier)
  for (const [k, col] of exploreMap) {
    drawCell(Math.floor(k / COLS), k % COLS, col, null);
  }

  // Solution path
  for (const [k] of pathMap) {
    drawCell(Math.floor(k / COLS), k % COLS, 'rgba(0,255,200,0.92)', '#00ffcc');
  }

  // Generation carve frontier
  for (const [k] of carveMap) {
    drawCell(Math.floor(k / COLS), k % COLS, 'rgba(0,200,255,0.5)', null);
  }

  // Active cell
  if (frontierCell) {
    drawCell(frontierCell[0], frontierCell[1], '#00eeff', '#00ddff');
  }

  // Start (green) / End (red)
  drawCell(1, 1, '#00ff88', '#00ff88');
  drawCell(ROWS-2, COLS-2, '#ff3355', '#ff3355');
}

// ── Phase transitions ─────────────────────────────────────────
function nextPhase() {
  if (phase === 'generating') {
    frontierCell = null;
    carveMap.clear();
    phase = 'pause_gen';
    setTimeout(() => { phase = 'solving'; stepIdx = 0; }, 700);
  } else if (phase === 'solving') {
    phase = 'pause_sol';
    setTimeout(() => {
      exploreMap.clear(); pathMap.clear(); carveMap.clear(); frontierCell = null;
      buildMaze();
      solveMaze();
      genIdx = 0; stepIdx = 0;
      phase = 'generating';
    }, 2400);
  }
}

// ── Audio ─────────────────────────────────────────────────────
let ac = null, audioReady = false;

async function startAudio() {
  if (audioReady) { if (ac.state === 'suspended') await ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    await ac.resume();
    audioReady = true;
  } catch(e) { console.warn('audio:', e); }
}

function playTone(freq, dur, type = 'sine', vol = 0.08) {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(vol, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(env); env.connect(ac.destination);
  osc.start(now); osc.stop(now + dur);
}

// Carve sound: soft high click, pitched by position
function playCarve(r, c) {
  const freq = 300 + (c / COLS) * 600 + (r / ROWS) * 300;
  playTone(freq, 0.04, 'sine', 0.05);
}

// Explore sound: softer, lower frequency sweep
function playExplore(r, c) {
  const freq = 120 + (r / ROWS) * 200 + (c / COLS) * 100;
  playTone(freq, 0.03, 'triangle', 0.04);
}

// Path sound: bright arpeggio-like note
function playPath(idx) {
  const notes = [523, 659, 784, 1047, 1319];
  const freq  = notes[idx % notes.length];
  playTone(freq, 0.07, 'sine', 0.07);
}

// Auto-start audio on any interaction
startAudio();
['click','keydown','touchstart','pointerdown','mousemove'].forEach(ev =>
  document.addEventListener(ev, () => startAudio(), { once: true, passive: true })
);

// ── Animation loop ────────────────────────────────────────────
const GEN_SPEED   = 18;  // ms per batch tick (slower, visible)
const SOLVE_SPEED = 20;  // ms per solve tick

function animate(ts) {
  const dt = ts - lastT;

  if (phase === 'generating' && dt >= GEN_SPEED) {
    lastT = ts;
    carveMap.clear();
    // Process 2 steps per tick (slower than before = 5)
    for (let i = 0; i < 2 && genIdx < genSteps.length; i++, genIdx++) {
      const s = genSteps[genIdx];
      carveMap.set(s.r * COLS + s.c, true);
      frontierCell = [s.r, s.c];
      playCarve(s.r, s.c);
    }
    if (genIdx >= genSteps.length) nextPhase();
  }

  if (phase === 'solving' && dt >= SOLVE_SPEED) {
    lastT = ts;
    const total = solveSteps.length;
    let pathCount = pathMap.size;
    for (let i = 0; i < 3 && stepIdx < total; i++, stepIdx++) {
      const s = solveSteps[stepIdx];
      const k = s.r * COLS + s.c;
      if (s.type === 'explore') {
        const prog = stepIdx / total;
        const rr = Math.round(prog * 90);
        const gg = Math.round(150 - prog * 130);
        const bb = Math.round(210 + prog * 45);
        exploreMap.set(k, `rgba(${rr},${gg},${bb},0.52)`);
        playExplore(s.r, s.c);
      } else {
        pathMap.set(k, true);
        playPath(pathCount++);
      }
    }
    if (stepIdx >= total) nextPhase();
  }

  draw();
  requestAnimationFrame(animate);
}

// ── Boot ──────────────────────────────────────────────────────
buildMaze();
solveMaze();
genIdx = 0; stepIdx = 0;
requestAnimationFrame(animate);
