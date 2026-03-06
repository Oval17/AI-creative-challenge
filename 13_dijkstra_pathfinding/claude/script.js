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

// ── Canvas ─────────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1060, CH = 1340;
canvas.width = CW; canvas.height = CH;

// ── Grid config ────────────────────────────────────────────────
const COLS = 42, ROWS = 54;
const CELL_W = CW / COLS;
const CELL_H = CH / ROWS;

// Cell states
const EMPTY = 0, WALL = 1;
const grid = new Uint8Array(COLS * ROWS);

// Visual state per cell (for smooth animation)
// 0=unvisited, 1=in frontier, 2=visited, 3=path
const vis  = new Uint8Array(COLS * ROWS);  // visual state
const age  = new Float32Array(COLS * ROWS); // frame when cell was visited (for fade-in)
const dist = new Float32Array(COLS * ROWS).fill(Infinity);
const prev = new Int32Array(COLS * ROWS).fill(-1);

function idx(c, r) { return r * COLS + c; }

// ── Maze / obstacle generation ─────────────────────────────────
function generateMaze() {
  grid.fill(EMPTY);
  // Random wall clusters
  const wallDensity = 0.28;
  for (let i = 0; i < COLS * ROWS; i++) {
    if (Math.random() < wallDensity) grid[i] = WALL;
  }
  // Clear start and end areas
  const [sc, sr] = [2, 2];
  const [ec, er] = [COLS - 3, ROWS - 3];
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    grid[idx(sc + dc, sr + dr)] = EMPTY;
    grid[idx(ec + dc, er + dr)] = EMPTY;
  }
}

// ── Dijkstra state ─────────────────────────────────────────────
// Simple priority queue via sorted array (fine for this grid size)
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].d <= this.data[i].d) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]]; i = p;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let min = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].d < this.data[min].d) min = l;
      if (r < n && this.data[r].d < this.data[min].d) min = r;
      if (min === i) break;
      [this.data[min], this.data[i]] = [this.data[i], this.data[min]]; i = min;
    }
  }
}

let heap, startNode, endNode, frame, phase, pathCells, pathDrawIdx;
let EXPLORE_PER_FRAME = 12;

function reset() {
  generateMaze();
  vis.fill(0); age.fill(0);
  dist.fill(Infinity); prev.fill(-1);

  startNode = idx(2, 2);
  endNode   = idx(COLS - 3, ROWS - 3);

  dist[startNode] = 0;
  heap = new MinHeap();
  heap.push({ i: startNode, d: 0 });
  vis[startNode] = 1;

  frame    = 0;
  phase    = 'explore'; // 'explore' | 'path' | 'hold' | 'fade'
  pathCells   = [];
  pathDrawIdx = 0;
  globalAlpha = 1;
}

const DIR = [[-1,0],[1,0],[0,-1],[0,1]];

// Expand N frontier nodes per frame
function exploreStep() {
  let expanded = 0;
  while (heap.size > 0 && expanded < EXPLORE_PER_FRAME) {
    const { i, d } = heap.pop();
    if (d > dist[i]) continue;
    if (vis[i] !== 1) continue;
    vis[i] = 2; age[i] = frame;

    if (i === endNode) return true; // found!

    const c = i % COLS, r = Math.floor(i / COLS);
    for (const [dc, dr] of DIR) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const ni = idx(nc, nr);
      if (grid[ni] === WALL) continue;
      const nd = dist[i] + 1;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = i;
        vis[ni] = 1; age[ni] = frame;
        heap.push({ i: ni, d: nd });
      }
    }
    expanded++;
  }
  return heap.size === 0;
}

function buildPath() {
  pathCells = [];
  let cur = endNode;
  while (cur !== -1 && cur !== startNode) {
    pathCells.push(cur);
    cur = prev[cur];
  }
  pathCells.push(startNode);
  pathCells.reverse();
}

let globalAlpha = 1;
let holdTimer = 0;
const HOLD_FRAMES  = 90;
const FADE_FRAMES  = 50;
const PATH_SPF     = 3; // path cells revealed per frame

// ── Render ─────────────────────────────────────────────────────
function cellRect(i) {
  const c = i % COLS, r = Math.floor(i / COLS);
  return [c * CELL_W, r * CELL_H, CELL_W, CELL_H];
}

function render() {
  ctx.save();
  ctx.globalAlpha = globalAlpha;
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);

  for (let i = 0; i < COLS * ROWS; i++) {
    const [x, y, w, h] = cellRect(i);

    if (grid[i] === WALL) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      continue;
    }

    const v = vis[i];
    if (v === 0) continue;

    const cellAge = frame - age[i];
    const fadeIn  = Math.min(1, cellAge / 8);

    if (v === 2) {
      // Visited — cyan-blue gradient based on distance
      const maxD = dist[endNode] < Infinity ? dist[endNode] : 200;
      const t = Math.min(1, dist[i] / maxD);
      // Hue: 220 (deep blue) → 180 (cyan)
      const hue = 220 - t * 40;
      ctx.fillStyle = `hsla(${hue},80%,${15 + t * 15}%,${fadeIn * 0.85})`;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    } else if (v === 1) {
      // Frontier — brighter cyan glow
      ctx.fillStyle = `rgba(0,220,255,${fadeIn * 0.6})`;
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
  }

  // Draw path cells
  const pathCount = Math.min(pathDrawIdx, pathCells.length);
  for (let p = 0; p < pathCount; p++) {
    const i = pathCells[p];
    const [x, y, w, h] = cellRect(i);
    const t = p / pathCells.length;

    // Path: magenta → yellow gradient
    const hue = 300 + t * 60; // 300 (magenta) → 360/0 → 60 (yellow)
    ctx.fillStyle = `hsl(${hue % 360},100%,60%)`;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    // Path glow
    ctx.save();
    ctx.shadowColor = `hsl(${hue % 360},100%,70%)`;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = `hsl(${hue % 360},100%,70%)`;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.restore();
  }

  // Start node — bright green
  {
    const [x, y, w, h] = cellRect(startNode);
    ctx.save();
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 16;
    ctx.fillStyle   = '#00ff88';
    ctx.beginPath();
    ctx.arc(x + w/2, y + h/2, Math.min(w, h) * 0.4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  // End node — bright red/orange
  {
    const [x, y, w, h] = cellRect(endNode);
    ctx.save();
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 16;
    ctx.fillStyle   = '#ff4400';
    ctx.beginPath();
    ctx.arc(x + w/2, y + h/2, Math.min(w, h) * 0.4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ── Animation ──────────────────────────────────────────────────
function animate() {
  frame++;

  if (phase === 'explore') {
    const done = exploreStep();
    if (done || (vis[endNode] === 2)) {
      buildPath();
      phase = 'path';
      pathDrawIdx = 0;
    }
  } else if (phase === 'path') {
    pathDrawIdx += PATH_SPF;
    if (pathDrawIdx >= pathCells.length) {
      pathDrawIdx = pathCells.length;
      phase = 'hold';
      holdTimer = 0;
    }
  } else if (phase === 'hold') {
    holdTimer++;
    if (holdTimer >= HOLD_FRAMES) { phase = 'fade'; holdTimer = 0; }
  } else if (phase === 'fade') {
    holdTimer++;
    globalAlpha = 1 - holdTimer / FADE_FRAMES;
    if (holdTimer >= FADE_FRAMES) { reset(); }
  }

  render();
  requestAnimationFrame(animate);
}

reset();
requestAnimationFrame(animate);
