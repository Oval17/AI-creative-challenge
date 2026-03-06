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

// ── Stable Fluids (Jos Stam) — grid-based ────────────────────
// Keep grid small for performance: 160 × 200 cells
const N  = 160;   // columns
const M  = 200;   // rows
const SZ = (N + 2) * (M + 2);

function idx(x, y) { return x + (N + 2) * y; }

let u   = new Float32Array(SZ);   // x velocity
let v   = new Float32Array(SZ);   // y velocity
let u0  = new Float32Array(SZ);
let v0  = new Float32Array(SZ);
let d   = new Float32Array(SZ);   // density
let d0  = new Float32Array(SZ);

// Color ink — RGB density grids
let rD  = new Float32Array(SZ);
let gD  = new Float32Array(SZ);
let bD  = new Float32Array(SZ);
let rD0 = new Float32Array(SZ);
let gD0 = new Float32Array(SZ);
let bD0 = new Float32Array(SZ);

const VISC = 0.00001;
const DIFF = 0.00001;
const DT   = 0.12;

// ── Fluid solver ──────────────────────────────────────────────
function setBnd(b, x) {
  for (let i = 1; i <= N; i++) {
    x[idx(0,   i)] = b === 1 ? -x[idx(1, i)] : x[idx(1, i)];
    x[idx(N+1, i)] = b === 1 ? -x[idx(N, i)] : x[idx(N, i)];
  }
  for (let j = 1; j <= M; j++) {
    x[idx(j, 0  )] = b === 2 ? -x[idx(j, 1)] : x[idx(j, 1)];
    x[idx(j, M+1)] = b === 2 ? -x[idx(j, M)] : x[idx(j, M)];
  }
  x[idx(0,0)]     = 0.5*(x[idx(1,0)]     + x[idx(0,1)]);
  x[idx(0,M+1)]   = 0.5*(x[idx(1,M+1)]   + x[idx(0,M)]);
  x[idx(N+1,0)]   = 0.5*(x[idx(N,0)]     + x[idx(N+1,1)]);
  x[idx(N+1,M+1)] = 0.5*(x[idx(N,M+1)]   + x[idx(N+1,M)]);
}

function linSolve(b, x, x0, a, c) {
  const inv = 1 / c;
  for (let k = 0; k < 10; k++) {
    for (let j = 1; j <= M; j++) {
      for (let i = 1; i <= N; i++) {
        x[idx(i,j)] = (x0[idx(i,j)] + a * (
          x[idx(i-1,j)] + x[idx(i+1,j)] +
          x[idx(i,j-1)] + x[idx(i,j+1)]
        )) * inv;
      }
    }
    setBnd(b, x);
  }
}

function diffuse(b, x, x0, diff) {
  const a = DT * diff * N * M;
  linSolve(b, x, x0, a, 1 + 4 * a);
}

function advect(b, d, d0, u, v) {
  const dt0x = DT * N, dt0y = DT * M;
  for (let j = 1; j <= M; j++) {
    for (let i = 1; i <= N; i++) {
      let x = i - dt0x * u[idx(i,j)];
      let y = j - dt0y * v[idx(i,j)];
      x = Math.max(0.5, Math.min(N + 0.5, x));
      y = Math.max(0.5, Math.min(M + 0.5, y));
      const i0 = Math.floor(x), i1 = i0 + 1;
      const j0 = Math.floor(y), j1 = j0 + 1;
      const s1 = x - i0, s0 = 1 - s1;
      const t1 = y - j0, t0 = 1 - t1;
      d[idx(i,j)] = s0*(t0*d0[idx(i0,j0)] + t1*d0[idx(i0,j1)]) +
                    s1*(t0*d0[idx(i1,j0)] + t1*d0[idx(i1,j1)]);
    }
  }
  setBnd(b, d);
}

function project(u, v, p, div) {
  for (let j = 1; j <= M; j++) {
    for (let i = 1; i <= N; i++) {
      div[idx(i,j)] = -0.5*(u[idx(i+1,j)]-u[idx(i-1,j)]+v[idx(i,j+1)]-v[idx(i,j-1)]);
      p[idx(i,j)] = 0;
    }
  }
  setBnd(0, div); setBnd(0, p);
  linSolve(0, p, div, 1, 4);
  for (let j = 1; j <= M; j++) {
    for (let i = 1; i <= N; i++) {
      u[idx(i,j)] -= 0.5*(p[idx(i+1,j)]-p[idx(i-1,j)]);
      v[idx(i,j)] -= 0.5*(p[idx(i,j+1)]-p[idx(i,j-1)]);
    }
  }
  setBnd(1, u); setBnd(2, v);
}

function velStep() {
  const tmp = u0; u0 = u; u = tmp;
  diffuse(1, u, u0, VISC);
  const tmp2 = v0; v0 = v; v = tmp2;
  diffuse(2, v, v0, VISC);
  project(u, v, u0, v0);
  const tu = u0; u0 = u; u = tu;
  const tv = v0; v0 = v; v = tv;
  advect(1, u, u0, u0, v0);
  advect(2, v, v0, u0, v0);
  project(u, v, u0, v0);
}

function denStep(x, x0) {
  const tmp = x0; x0 = x; x = tmp;
  // (diffuse disabled for performance — advect only gives nice look)
  const tu = x0; x0 = x; x = tu;
  advect(0, x, x0, u, v);
  return x;
}

// ── Autonomous sources ────────────────────────────────────────
let srcAngle = 0;

function addSources() {
  srcAngle += 0.012;
  const cx = Math.round(N / 2 + Math.sin(srcAngle) * N * 0.28);
  const cy = Math.round(M / 2 + Math.cos(srcAngle * 0.7) * M * 0.22);

  // Velocity impulse
  const speed = 2.5;
  const dir   = srcAngle + Math.PI / 2;
  u[idx(cx, cy)] += Math.cos(dir) * speed;
  v[idx(cx, cy)] += Math.sin(dir) * speed;

  // Color ink
  rD[idx(cx, cy)] += 120;
  gD[idx(cx, cy)] += 60 + 40 * Math.sin(srcAngle * 2);
  bD[idx(cx, cy)] += 180 + 60 * Math.cos(srcAngle * 1.3);

  // Second source (opposite side)
  const cx2 = N + 1 - cx, cy2 = M + 1 - cy;
  u[idx(cx2, cy2)] -= Math.cos(dir) * speed;
  v[idx(cx2, cy2)] -= Math.sin(dir) * speed;
  rD[idx(cx2, cy2)] += 60 + 40 * Math.cos(srcAngle);
  gD[idx(cx2, cy2)] += 120;
  bD[idx(cx2, cy2)] += 80 + 60 * Math.sin(srcAngle * 1.7);
}

// ── Render via ImageData ──────────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const pixels  = imgData.data;

const cellW = CW / N;
const cellH = CH / M;

function render() {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, CW, CH);

  for (let j = 1; j <= M; j++) {
    for (let i = 1; i <= N; i++) {
      const r = Math.min(255, rD[idx(i,j)] * 2.2);
      const g = Math.min(255, gD[idx(i,j)] * 2.2);
      const b = Math.min(255, bD[idx(i,j)] * 2.2);
      if (r < 2 && g < 2 && b < 2) continue;
      const px = Math.floor((i - 1) * cellW);
      const py = Math.floor((j - 1) * cellH);
      const pw = Math.ceil(cellW) + 1;
      const ph = Math.ceil(cellH) + 1;
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(px, py, pw, ph);
    }
  }
}

// ── Step ──────────────────────────────────────────────────────
function step() {
  addSources();
  velStep();
  rD = denStep(rD, rD0);
  gD = denStep(gD, gD0);
  bD = denStep(bD, bD0);

  // Fade density slowly
  for (let i = 0; i < SZ; i++) {
    rD[i] *= 0.992;
    gD[i] *= 0.992;
    bD[i] *= 0.992;
  }
}

function animate() {
  step();
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
