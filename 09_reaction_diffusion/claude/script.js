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

// ── Gray-Scott simulation grid (downsampled 4x for speed) ────
const SCALE = 4;
const GW = Math.floor(CW / SCALE);
const GH = Math.floor(CH / SCALE);
const N  = GW * GH;

// Two chemical concentrations: A and B
let A  = new Float32Array(N);
let B  = new Float32Array(N);
let nA = new Float32Array(N);
let nB = new Float32Array(N);

// Gray-Scott parameters — "coral" preset (nice organic blobs)
const dA = 1.0;
const dB = 0.5;
const f  = 0.0545;   // feed rate
const k  = 0.062;    // kill rate

// ── Initialize ────────────────────────────────────────────────
function init() {
  // Fill A=1, B=0 everywhere
  for (let i = 0; i < N; i++) { A[i] = 1; B[i] = 0; }

  // Seed several random 5×5 B patches
  const numSeeds = 18;
  for (let s = 0; s < numSeeds; s++) {
    const cx = 3 + Math.floor(Math.random() * (GW - 6));
    const cy = 3 + Math.floor(Math.random() * (GH - 6));
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const r = cy + dy, c = cx + dx;
        if (r >= 0 && r < GH && c >= 0 && c < GW) {
          const i = r * GW + c;
          A[i] = 0.5 + Math.random() * 0.1;
          B[i] = 0.25 + Math.random() * 0.1;
        }
      }
    }
  }
}

// ── Laplacian (5-point stencil with wrap) ─────────────────────
function lap(grid, x, y) {
  const c  = y * GW + x;
  const l  = y * GW + (x - 1 + GW) % GW;
  const r  = y * GW + (x + 1) % GW;
  const u  = ((y - 1 + GH) % GH) * GW + x;
  const d  = ((y + 1) % GH) * GW + x;
  return grid[l] + grid[r] + grid[u] + grid[d] - 4 * grid[c];
}

// ── Step ──────────────────────────────────────────────────────
const DT = 1.0;
function step() {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i  = y * GW + x;
      const a  = A[i], b = B[i];
      const ab2 = a * b * b;
      const la = lap(A, x, y);
      const lb = lap(B, x, y);
      nA[i] = a + DT * (dA * la - ab2 + f * (1 - a));
      nB[i] = b + DT * (dB * lb + ab2 - (k + f) * b);
      // clamp
      if (nA[i] < 0) nA[i] = 0; if (nA[i] > 1) nA[i] = 1;
      if (nB[i] < 0) nB[i] = 0; if (nB[i] > 1) nB[i] = 1;
    }
  }
  // swap
  const tmp = A; A = nA; nA = tmp;
  const tmp2 = B; B = nB; nB = tmp2;
}

// ── Render ────────────────────────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

// Neon palette: map B concentration to colour
// B≈0 = dark indigo, B≈0.5 = magenta, B≈1 = bright cyan/white
function toColor(b) {
  const t = Math.min(1, Math.max(0, b * 2.5)); // boost contrast
  // Interpolate: dark navy → neon green → bright white
  const r = Math.round(t < 0.5 ? t * 2 * 60        : 60  + (t - 0.5) * 2 * 195);
  const g = Math.round(t < 0.5 ? t * 2 * 220        : 220 + (t - 0.5) * 2 * 35);
  const bv= Math.round(t < 0.5 ? 30 + t * 2 * 100   : 130 + (t - 0.5) * 2 * 125);
  return [r, g, bv];
}

function render() {
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const val = B[gy * GW + gx];
      const [r, g, bv] = toColor(val);
      // Fill SCALE×SCALE block
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const py = gy * SCALE + dy;
          const px = gx * SCALE + dx;
          if (py >= CH || px >= CW) continue;
          const idx = (py * CW + px) * 4;
          buf[idx]     = r;
          buf[idx + 1] = g;
          buf[idx + 2] = bv;
          buf[idx + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Animation ─────────────────────────────────────────────────
const STEPS_PER_FRAME = 8;

function animate() {
  for (let i = 0; i < STEPS_PER_FRAME; i++) step();
  render();
  requestAnimationFrame(animate);
}

init();
requestAnimationFrame(animate);
