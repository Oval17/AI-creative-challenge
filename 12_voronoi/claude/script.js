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

// ── Seeds ──────────────────────────────────────────────────────
const N_SEEDS = 28;

// Neon palette — distinct but harmonious
const PALETTE = [
  [0,   210, 255],   // cyan
  [180, 0,   255],   // violet
  [0,   255, 140],   // mint green
  [255, 60,  180],   // hot pink
  [255, 160, 0  ],   // amber
  [0,   160, 255],   // sky blue
  [255, 80,  60 ],   // coral
  [80,  255, 180],   // seafoam
  [200, 0,   255],   // purple
  [255, 220, 0  ],   // gold
  [0,   255, 255],   // aqua
  [255, 100, 220],   // pink
];

function randColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

const seeds = [];
for (let i = 0; i < N_SEEDS; i++) {
  const speed = 0.4 + Math.random() * 0.5;
  const angle = Math.random() * Math.PI * 2;
  seeds.push({
    x:   Math.random() * CW,
    y:   Math.random() * CH,
    vx:  Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed,
    col: randColor(),
  });
}

// ── Pixel buffer ───────────────────────────────────────────────
// Downsample for performance: render at 1/3 resolution, upscale
const SCALE = 3;
const SW = Math.ceil(CW / SCALE);
const SH = Math.ceil(CH / SCALE);
const offscreen = document.createElement('canvas');
offscreen.width  = SW;
offscreen.height = SH;
const offCtx = offscreen.getContext('2d');
const imgData = offCtx.createImageData(SW, SH);
const buf     = imgData.data;

// Precompute scaled seed positions
const sx = new Float32Array(N_SEEDS);
const sy = new Float32Array(N_SEEDS);

function updateSeeds() {
  for (const s of seeds) {
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < 0)    { s.x = 0;   s.vx *= -1; }
    if (s.x > CW)   { s.x = CW;  s.vx *= -1; }
    if (s.y < 0)    { s.y = 0;   s.vy *= -1; }
    if (s.y > CH)   { s.y = CH;  s.vy *= -1; }
  }
  for (let i = 0; i < N_SEEDS; i++) {
    sx[i] = seeds[i].x / SCALE;
    sy[i] = seeds[i].y / SCALE;
  }
}

function renderVoronoi() {
  for (let py = 0; py < SH; py++) {
    for (let px = 0; px < SW; px++) {
      let minDist  = Infinity;
      let secDist  = Infinity;
      let closest  = 0;

      for (let i = 0; i < N_SEEDS; i++) {
        const dx = px - sx[i];
        const dy = py - sy[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist) {
          secDist = minDist;
          minDist = d2;
          closest = i;
        } else if (d2 < secDist) {
          secDist = d2;
        }
      }

      const col = seeds[closest].col;

      // Edge proximity: difference between closest and second closest distances
      const edgeDist = Math.sqrt(secDist) - Math.sqrt(minDist);
      // 0 = on edge, larger = interior
      const edgeFactor = Math.min(1, edgeDist / 6); // 0→1 as we move away from edge

      // Interior darkening: cells fade darker toward center
      // slight vignette per cell using minDist
      const cellVignette = Math.min(1, Math.sqrt(minDist) / 80);
      const bright = 0.12 + edgeFactor * 0.55 + cellVignette * 0.15;
      // Edge glow: brighten pixels near the boundary
      const edgeGlow = edgeDist < 4 ? (1 - edgeDist / 4) * 0.9 : 0;

      const idx = (py * SW + px) * 4;
      buf[idx]   = Math.min(255, Math.round(col[0] * bright + 255 * edgeGlow * 0.8));
      buf[idx+1] = Math.min(255, Math.round(col[1] * bright + 255 * edgeGlow * 0.8));
      buf[idx+2] = Math.min(255, Math.round(col[2] * bright + 255 * edgeGlow * 0.9));
      buf[idx+3] = 255;
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Upscale to full canvas with smooth interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen, 0, 0, CW, CH);

  // Draw seed points as bright glowing dots
  for (const s of seeds) {
    const col = `rgb(${s.col[0]},${s.col[1]},${s.col[2]})`;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 14);
    grad.addColorStop(0, col.replace('rgb','rgba').replace(')', ',0.9)'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Bright white core
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Audio ──────────────────────────────────────────────────────
function startAudio() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();

    const master = ac.createGain();
    master.gain.value = 0.10;
    master.connect(ac.destination);

    // Slow evolving ambient pad — sounds like glass/crystal humming
    [90, 135, 180, 270].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = f + Math.random() * 1.5;
      // Slow LFO vibrato
      const lfo = ac.createOscillator();
      const lfoG = ac.createGain();
      lfo.frequency.value = 0.15 + i * 0.05;
      lfoG.gain.value = 0.8;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      lfo.start();
      g.gain.value = 0.15 / (i + 1);
      osc.connect(g); g.connect(master); osc.start();
    });

    document.addEventListener('click', () => { if (ac.state === 'suspended') ac.resume(); });
  } catch(e) {}
}

startAudio();

// ── Animation loop ─────────────────────────────────────────────
function animate() {
  updateSeeds();
  renderVoronoi();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);



