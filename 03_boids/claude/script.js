'use strict';
// ── Scale wrapper ────────────────────────────────────────────
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

// ── Canvas ───────────────────────────────────────────────────
const canvas = document.getElementById('boidsCanvas');
const ctx    = canvas.getContext('2d');
const CW = W, CH = 1350;
canvas.width = CW; canvas.height = CH;

// ── Config ───────────────────────────────────────────────────
const NUM_BOIDS       = 180;
const MAX_SPEED       = 3.2;
const MIN_SPEED       = 1.4;
const PERCEPTION_R    = 80;
const SEP_RADIUS      = 26;
const ALIGN_W         = 0.05;
const COHESION_W      = 0.003;
const SEP_W           = 0.09;
const EDGE_MARGIN     = 70;
const EDGE_FORCE      = 0.45;
const TRAIL_LEN       = 12;
const CELL            = 82;

// ── Spatial grid ─────────────────────────────────────────────
const COLS = Math.ceil(CW / CELL);
const ROWS = Math.ceil(CH / CELL);
let grid = [];

function buildGrid(boids) {
  grid = new Array(COLS * ROWS).fill(null).map(() => []);
  for (const b of boids) {
    const cx = Math.floor(b.x / CELL);
    const cy = Math.floor(b.y / CELL);
    const idx = cy * COLS + cx;
    if (grid[idx]) grid[idx].push(b);
  }
}

function getNeighbours(b) {
  const cx = Math.floor(b.x / CELL);
  const cy = Math.floor(b.y / CELL);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const cell = grid[ny * COLS + nx];
      if (cell) for (const o of cell) if (o !== b) out.push(o);
    }
  }
  return out;
}

// ── Boid ─────────────────────────────────────────────────────
class Boid {
  constructor() {
    this.x = Math.random() * CW;
    this.y = Math.random() * CH;
    const a = Math.random() * Math.PI * 2;
    const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.hue = 160 + Math.random() * 80;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();

    const neighbours = getNeighbours(this);
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    let total = 0, stotal = 0;

    for (const o of neighbours) {
      const dx = o.x - this.x, dy = o.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < PERCEPTION_R * PERCEPTION_R) {
        ax += o.vx; ay += o.vy;
        cx += o.x;  cy += o.y;
        total++;
        if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 0) {
          const d = Math.sqrt(d2);
          sx -= dx / d; sy -= dy / d; stotal++;
        }
      }
    }

    if (total > 0) {
      ax /= total; ay /= total;
      this.vx += (ax - this.vx) * ALIGN_W;
      this.vy += (ay - this.vy) * ALIGN_W;
      this.vx += (cx / total - this.x) * COHESION_W;
      this.vy += (cy / total - this.y) * COHESION_W;
    }
    if (stotal > 0) {
      this.vx += (sx / stotal) * SEP_W;
      this.vy += (sy / stotal) * SEP_W;
    }

    if (this.x < EDGE_MARGIN)          this.vx += EDGE_FORCE;
    if (this.x > CW - EDGE_MARGIN)     this.vx -= EDGE_FORCE;
    if (this.y < EDGE_MARGIN)          this.vy += EDGE_FORCE;
    if (this.y > CH - EDGE_MARGIN)     this.vy -= EDGE_FORCE;

    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > MAX_SPEED) { this.vx = this.vx / spd * MAX_SPEED; this.vy = this.vy / spd * MAX_SPEED; }
    if (spd < MIN_SPEED && spd > 0) { this.vx = this.vx / spd * MIN_SPEED; this.vy = this.vy / spd * MIN_SPEED; }

    this.x += this.vx;
    this.y += this.vy;
  }

  drawTrail() {
    const n = this.trail.length;
    if (n < 2) return;
    ctx.save();
    ctx.shadowBlur = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.strokeStyle = `hsla(${(this.hue + (1 - t) * 35) % 360},100%,68%,${t * t * 0.6})`;
      ctx.lineWidth = t * 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBody() {
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.shadowColor = `hsla(${this.hue},100%,85%,1)`;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, 3.2);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, -3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Web Audio ambient soundscape ─────────────────────────────
let audioCtx = null;
let droneGain = null, windGain = null;
let audioStarted = false;

function initAudio() {
  if (audioStarted) return;
  audioStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // --- Drone: two detuned sine oscillators
  droneGain = audioCtx.createGain();
  droneGain.gain.setValueAtTime(0, audioCtx.currentTime);
  droneGain.gain.linearRampToValueAtTime(0.07, audioCtx.currentTime + 2);
  droneGain.connect(audioCtx.destination);

  [110, 110.3, 220.1].forEach(freq => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = 0.33;
    osc.connect(g);
    g.connect(droneGain);
    osc.start();
  });

  // --- Wind: filtered noise
  windGain = audioCtx.createGain();
  windGain.gain.setValueAtTime(0, audioCtx.currentTime);
  windGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 3);
  windGain.connect(audioCtx.destination);

  const bufSize = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = 600; filt.Q.value = 0.4;
  noise.connect(filt); filt.connect(windGain);
  noise.start();

  // LFO on wind filter
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 180;
  lfo.frequency.value = 0.08;
  lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
  lfo.start();
}

// ── Audio overlay ────────────────────────────────────────────
const overlay = document.getElementById('audioOverlay');
function startAudio() {
  initAudio();
  if (audioCtx) {
    audioCtx.resume().catch(() => {});
  }
  overlay.classList.add('hidden');
}
overlay.addEventListener('click', startAudio);
// Also try on any body click (fallback)
document.addEventListener('click', startAudio, { once: true });

// ── Init boids ───────────────────────────────────────────────
const boids = Array.from({ length: NUM_BOIDS }, () => new Boid());

ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, CW, CH);

// ── Animation loop ───────────────────────────────────────────
function animate() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CW, CH);

  buildGrid(boids);
  for (const b of boids) b.update();

  // draw trails first (no shadow → fast)
  for (const b of boids) b.drawTrail();
  // draw bodies on top (shadow only here)
  for (const b of boids) b.drawBody();

  requestAnimationFrame(animate);
}

animate();
