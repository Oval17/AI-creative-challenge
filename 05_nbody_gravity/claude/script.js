'use strict';

// ── Scale wrapper ────────────────────────────────────────────
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

// ── Canvas ───────────────────────────────────────────────────
const canvas = document.getElementById('simCanvas');
const ctx    = canvas.getContext('2d');
const CW = 1080, CH = 1350;
canvas.width = CW; canvas.height = CH;

// ── Config ───────────────────────────────────────────────────
const N          = 100;
const G          = 80;        // gravitational constant (tuned for drama)
const SOFTENING  = 18;        // avoid singularity
const DT         = 0.016;     // time step
const TRAIL_LEN  = 55;
const DAMPING    = 0.9998;    // very slight energy loss

// ── Particle colours ─────────────────────────────────────────
const STAR_COLORS = [
  '#ffffff', '#aad4ff', '#ffd8a0', '#ffaaaa',
  '#aaffdd', '#c8a0ff', '#80dfff', '#ffe066',
];

// ── Particle class ───────────────────────────────────────────
class Body {
  constructor() {
    // Spawn in two counter-rotating clusters for instant orbital motion
    const cluster = Math.random() < 0.5 ? 0 : 1;
    const cx = cluster === 0 ? CW * 0.35 : CW * 0.65;
    const cy = CH * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 200;

    this.x = cx + Math.cos(angle) * r;
    this.y = cy + Math.sin(angle) * r;

    // Orbital velocity perpendicular to radius, opposing clusters
    const orbSpeed = 0.6 + Math.random() * 0.8;
    const dir = cluster === 0 ? 1 : -1;
    this.vx = -Math.sin(angle) * orbSpeed * dir + (Math.random() - 0.5) * 0.4;
    this.vy =  Math.cos(angle) * orbSpeed * dir + (Math.random() - 0.5) * 0.4;

    this.mass = 0.6 + Math.random() * 2.2;
    this.r    = 1.2 + this.mass * 0.7;
    this.hue  = 180 + Math.random() * 200;
    this.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    this.trail = [];
  }
}

// ── Init ─────────────────────────────────────────────────────
let bodies = Array.from({ length: N }, () => new Body());

// ── Physics step ─────────────────────────────────────────────
function step() {
  const soft2 = SOFTENING * SOFTENING;

  // Reset accelerations
  for (const b of bodies) { b.ax = 0; b.ay = 0; }

  // O(n²) gravity
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const d2 = dx * dx + dy * dy + soft2;
      const d  = Math.sqrt(d2);
      const f  = G / d2;
      const fx = f * dx / d;
      const fy = f * dy / d;
      bi.ax += fx * bj.mass;
      bi.ay += fy * bj.mass;
      bj.ax -= fx * bi.mass;
      bj.ay -= fy * bi.mass;
    }
  }

  // Integrate & record trails
  for (const b of bodies) {
    b.vx = (b.vx + b.ax * DT) * DAMPING;
    b.vy = (b.vy + b.ay * DT) * DAMPING;
    b.x += b.vx * DT * 60;
    b.y += b.vy * DT * 60;

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > TRAIL_LEN) b.trail.shift();

    // Soft boundary — bounce with dampening if far out
    const margin = 40;
    if (b.x < -margin)     { b.x = -margin;      b.vx *= -0.5; }
    if (b.x > CW + margin) { b.x = CW + margin;  b.vx *= -0.5; }
    if (b.y < -margin)     { b.y = -margin;       b.vy *= -0.5; }
    if (b.y > CH + margin) { b.y = CH + margin;   b.vy *= -0.5; }
  }
}

// ── Draw ─────────────────────────────────────────────────────
function draw() {
  // Fade background (trail effect)
  ctx.fillStyle = 'rgba(10,10,10,0.18)';
  ctx.fillRect(0, 0, CW, CH);

  for (const b of bodies) {
    const n = b.trail.length;
    if (n < 2) continue;

    // Trail
    ctx.save();
    ctx.shadowBlur = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      ctx.beginPath();
      ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
      ctx.lineTo(b.trail[i].x, b.trail[i].y);
      ctx.strokeStyle = b.color.replace(')', `,${t * t * 0.55})`).replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba(');

      // Build rgba from hex color
      const alpha = t * t * 0.5;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = t * b.r * 0.9;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Glow core
    ctx.save();
    ctx.shadowColor = b.color;
    ctx.shadowBlur  = b.r * 6;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    // Coloured halo
    ctx.shadowBlur = b.r * 14;
    ctx.fillStyle  = b.color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Occasional gentle re-injection ───────────────────────────
// If energy collapses (all merged) respawn scattered bodies
let frameNum = 0;
function maybeRespawn() {
  // Every 600 frames check if spread is too small
  if (frameNum % 600 !== 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of bodies) {
    if (b.x < minX) minX = b.x;
    if (b.x > maxX) maxX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.y > maxY) maxY = b.y;
  }
  if (maxX - minX < 80 && maxY - minY < 80) {
    // Gentle reinit — spread them out again
    bodies = Array.from({ length: N }, () => new Body());
  }
}

// ── Ambient audio ─────────────────────────────────────────────
let audioStarted = false;
function initAudio() {
  if (audioStarted) return;
  audioStarted = true;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(0.4, ac.currentTime + 3);
  master.connect(ac.destination);

  // Deep space drone
  [40, 80.1, 160.2].forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = i === 0 ? 0.5 : 0.2;
    osc.connect(g); g.connect(master); osc.start();
  });

  // Cosmic shimmer – filtered noise
  const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 800;
  const ng = ac.createGain(); ng.gain.value = 0.03;
  noise.connect(hp); hp.connect(ng); ng.connect(master); noise.start();

  // Slow LFO on master volume for breathing effect
  const lfo = ac.createOscillator();
  const lg = ac.createGain(); lg.gain.value = 0.08;
  lfo.frequency.value = 0.06;
  lfo.connect(lg); lg.connect(master.gain); lfo.start();
}

initAudio();
['click','keydown','touchstart','pointerdown'].forEach(ev =>
  document.addEventListener(ev, initAudio, { once: true, passive: true })
);

// ── Loop ─────────────────────────────────────────────────────
function animate() {
  step();
  step(); // two physics steps per frame for stability
  draw();
  frameNum++;
  maybeRespawn();
  requestAnimationFrame(animate);
}

// Clear canvas first
ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, CW, CH);
requestAnimationFrame(animate);
