'use strict';

// ── Scale wrapper to viewport ────────────────────────────────
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

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('fractalCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1080, CH = 1350;
canvas.width = CW; canvas.height = CH;

// ── Zoom target — deep Mandelbrot point (Seahorse Valley) ────
const TARGET_RE = -0.7436447860;
const TARGET_IM =  0.1318252536;

// ── State ────────────────────────────────────────────────────
let zoom       = 1.0;
const ZOOM_SPEED = 1.008;          // multiply per frame (~60fps smooth zoom)
const MAX_ZOOM   = 1e11;           // reset after this depth
const MAX_ITER   = 300;

// ImageData for direct pixel writes
const imgData = ctx.createImageData(CW, CH);
const pixels  = imgData.data;

// ── Smooth iteration count (escape-time + fractional) ────────
function mandelbrot(cx, cy) {
  let zx = 0, zy = 0, iter = 0;
  while (iter < MAX_ITER) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) break;
    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
    iter++;
  }
  if (iter === MAX_ITER) return -1; // inside set

  // Smooth colouring (continuous escape time)
  const log2 = Math.log2(zx * zx + zy * zy);
  return iter + 1 - Math.log2(log2 / 2);
}

// ── Cosmic palette — maps smooth t [0,1] to RGB ──────────────
function palette(t) {
  // 5-stop cosmic gradient: deep blue → purple → cyan → gold → white
  const stops = [
    [  2,   2,  20],   // 0.0 – deep space
    [ 10,   0,  80],   // 0.2 – deep violet
    [  0, 100, 200],   // 0.4 – electric blue
    [  0, 230, 210],   // 0.6 – cyan
    [255, 200,  50],   // 0.8 – gold
    [255, 255, 255],   // 1.0 – white core
  ];
  const scaled = t * (stops.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(i0 + 1, stops.length - 1);
  const f  = scaled - i0;
  const a  = stops[i0], b = stops[i1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

// ── Render one frame ─────────────────────────────────────────
function render() {
  const scale = 3.5 / zoom;                   // complex-plane extent
  const aspect = CW / CH;
  const reRange = scale * aspect;
  const imRange = scale;

  const reMin = TARGET_RE - reRange / 2;
  const imMin = TARGET_IM - imRange / 2;
  const reStep = reRange / CW;
  const imStep = imRange / CH;

  let idx = 0;
  for (let py = 0; py < CH; py++) {
    const im = imMin + py * imStep;
    for (let px = 0; px < CW; px++) {
      const re = reMin + px * reStep;
      const smooth = mandelbrot(re, im);

      let r, g, b;
      if (smooth < 0) {
        // Inside set — pure black
        r = g = b = 0;
      } else {
        // Map smooth value to palette with cycling
        const t = (smooth % 64) / 64;
        // Add a twist: cycle through palette with period 64 iters
        const [pr, pg, pb] = palette((Math.sin(t * Math.PI) + 1) / 2);
        // Brightness boost near boundary
        const bright = Math.pow(t, 0.5);
        r = pr * bright;
        g = pg * bright;
        b = pb * bright;
      }

      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
      idx += 4;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Animation loop ───────────────────────────────────────────
let lastTime = 0;
const TARGET_FPS = 60;
const FRAME_MS   = 1000 / TARGET_FPS;

// We render every 2 frames to reduce CPU load (effective 30fps render)
let frameCount = 0;

function animate(ts) {
  requestAnimationFrame(animate);
  if (ts - lastTime < FRAME_MS) return;
  lastTime = ts;

  frameCount++;
  // Render every 2nd frame for performance, still animates zoom each frame
  if (frameCount % 2 === 0) {
    render();
  }

  zoom *= ZOOM_SPEED;
  if (zoom > MAX_ZOOM) zoom = 1.0;  // smooth reset to start
}

// First render immediately so screen isn't blank
render();
requestAnimationFrame(animate);
