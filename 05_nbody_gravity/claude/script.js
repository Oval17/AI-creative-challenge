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
const N         = 300;
const G         = 120;
const SOFTENING = 22;
const DT        = 0.032;   // faster timestep
const TRAIL_LEN = 30;
const DAMPING   = 0.9995;

// Grid-based force approximation — only interact with nearby cells
const CELL_SIZE = 150;
const GCOLS = Math.ceil(CW / CELL_SIZE);
const GROWS = Math.ceil(CH / CELL_SIZE);

const STAR_COLORS = [
  '#ffffff', '#aad4ff', '#ffd8a0', '#ffaaaa',
  '#aaffdd', '#c8a0ff', '#80dfff', '#ffe066',
];

// ── Bodies stored as flat arrays for speed ───────────────────
const px  = new Float32Array(N); // x
const py  = new Float32Array(N); // y
const pvx = new Float32Array(N); // vx
const pvy = new Float32Array(N); // vy
const pm  = new Float32Array(N); // mass
const pr  = new Float32Array(N); // radius
const pc  = new Array(N);        // colour string
const trails = Array.from({length: N}, () => []);

function initBodies() {
  for (let i = 0; i < N; i++) {
    const cluster = i < N / 2 ? 0 : 1;
    const cx = cluster === 0 ? CW * 0.33 : CW * 0.67;
    const cy = CH * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 240;
    px[i] = cx + Math.cos(angle) * r;
    py[i] = cy + Math.sin(angle) * r;
    const orbSpeed = 0.7 + Math.random() * 1.1;
    const dir = cluster === 0 ? 1 : -1;
    pvx[i] = -Math.sin(angle) * orbSpeed * dir + (Math.random()-0.5) * 0.5;
    pvy[i] =  Math.cos(angle) * orbSpeed * dir + (Math.random()-0.5) * 0.5;
    pm[i]  = 0.5 + Math.random() * 1.8;
    pr[i]  = 1.0 + pm[i] * 0.6;
    pc[i]  = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
  }
}
initBodies();

// ── Grid-based N-body (O(n * k) where k = neighbours per cell) ──
const ax = new Float32Array(N);
const ay = new Float32Array(N);
const grid = [];

function buildGrid() {
  grid.length = 0;
  for (let i = 0; i < GCOLS * GROWS; i++) grid[i] = [];
  for (let i = 0; i < N; i++) {
    const cx = Math.max(0, Math.min(GCOLS-1, Math.floor(px[i] / CELL_SIZE)));
    const cy = Math.max(0, Math.min(GROWS-1, Math.floor(py[i] / CELL_SIZE)));
    grid[cy * GCOLS + cx].push(i);
  }
}

function step() {
  buildGrid();
  const soft2 = SOFTENING * SOFTENING;
  ax.fill(0); ay.fill(0);

  for (let gi = 0; gi < N; gi++) {
    const gcx = Math.max(0, Math.min(GCOLS-1, Math.floor(px[gi] / CELL_SIZE)));
    const gcy = Math.max(0, Math.min(GROWS-1, Math.floor(py[gi] / CELL_SIZE)));

    // Check 3x3 neighbourhood of cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gcx + dx, ny = gcy + dy;
        if (nx < 0 || ny < 0 || nx >= GCOLS || ny >= GROWS) continue;
        const cell = grid[ny * GCOLS + nx];
        for (let k = 0; k < cell.length; k++) {
          const gj = cell[k];
          if (gj <= gi) continue;
          const ddx = px[gj] - px[gi];
          const ddy = py[gj] - py[gi];
          const d2 = ddx*ddx + ddy*ddy + soft2;
          const inv_d = 1.0 / Math.sqrt(d2);
          const f = G * inv_d * inv_d * inv_d;
          const fx = f * ddx, fy = f * ddy;
          ax[gi] += fx * pm[gj];
          ay[gi] += fy * pm[gj];
          ax[gj] -= fx * pm[gi];
          ay[gj] -= fy * pm[gi];
        }
      }
    }
  }

  // Integrate
  for (let i = 0; i < N; i++) {
    pvx[i] = (pvx[i] + ax[i] * DT) * DAMPING;
    pvy[i] = (pvy[i] + ay[i] * DT) * DAMPING;
    px[i] += pvx[i] * DT * 60;
    py[i] += pvy[i] * DT * 60;

    trails[i].push({ x: px[i], y: py[i] });
    if (trails[i].length > TRAIL_LEN) trails[i].shift();

    const margin = 60;
    if (px[i] < -margin)     { px[i] = -margin;      pvx[i] *= -0.4; }
    if (px[i] > CW + margin) { px[i] = CW + margin;  pvx[i] *= -0.4; }
    if (py[i] < -margin)     { py[i] = -margin;       pvy[i] *= -0.4; }
    if (py[i] > CH + margin) { py[i] = CH + margin;   pvy[i] *= -0.4; }
  }
}

// ── Draw ─────────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = 'rgba(10,10,10,0.22)';
  ctx.fillRect(0, 0, CW, CH);

  for (let i = 0; i < N; i++) {
    const trail = trails[i];
    const n = trail.length;
    if (n < 2) continue;

    // Trail
    ctx.save();
    for (let t = 1; t < n; t++) {
      const f = t / n;
      ctx.globalAlpha = f * f * 0.45;
      ctx.strokeStyle = pc[i];
      ctx.lineWidth   = f * pr[i] * 1.1;
      ctx.beginPath();
      ctx.moveTo(trail[t-1].x, trail[t-1].y);
      ctx.lineTo(trail[t].x, trail[t].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Star core with glow
    ctx.save();
    ctx.shadowColor = pc[i];
    ctx.shadowBlur  = pr[i] * 8;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(px[i], py[i], pr[i], 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = pr[i] * 20;
    ctx.fillStyle   = pc[i];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(px[i], py[i], pr[i] * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Audio — space ambient + collision pings ───────────────────
let ac = null, master = null;
let audioReady = false;

async function startAudio() {
  if (audioReady) {
    // If context suspended (browser policy), resume it
    if (ac && ac.state === 'suspended') await ac.resume();
    return;
  }

  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    await ac.resume(); // Force resume immediately

    master = ac.createGain();
    master.gain.setValueAtTime(0, ac.currentTime);
    master.gain.linearRampToValueAtTime(0.55, ac.currentTime + 3);
    master.connect(ac.destination);

    // Sub-bass gravitational hum
    const sub = ac.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 42;
    const sg = ac.createGain(); sg.gain.value = 0.4;
    sub.connect(sg); sg.connect(master); sub.start();

    // Mid harmonic
    const mid = ac.createOscillator();
    mid.type = 'triangle';
    mid.frequency.value = 84.2;
    const mg = ac.createGain(); mg.gain.value = 0.15;
    mid.connect(mg); mg.connect(master); mid.start();

    // High shimmer
    const high = ac.createOscillator();
    high.type = 'sine';
    high.frequency.value = 336;
    const hg = ac.createGain(); hg.gain.value = 0.06;
    const hLFO = ac.createOscillator();
    const hLG = ac.createGain(); hLG.gain.value = 0.05;
    hLFO.frequency.value = 0.3;
    hLFO.connect(hLG); hLG.connect(hg.gain);
    high.connect(hg); hg.connect(master); high.start(); hLFO.start();

    // Space wind (filtered noise)
    const bufLen = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 350; bp.Q.value = 0.4;
    const wg = ac.createGain(); wg.gain.value = 0.05;
    src.connect(bp); bp.connect(wg); wg.connect(master); src.start();

    // LFO breath on master
    const lfo = ac.createOscillator();
    const lg = ac.createGain(); lg.gain.value = 0.07;
    lfo.frequency.value = 0.08;
    lfo.connect(lg); lg.connect(master.gain); lfo.start();

    audioReady = true;
  } catch(e) {
    console.warn('Audio init failed:', e);
  }
}

// Collision/close-encounter ping sound
let lastPingTime = 0;
function triggerPing(freq, intensity) {
  if (!ac || !audioReady || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (now - lastPingTime < 0.09) return;
  lastPingTime = now;

  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.25, now + 0.4);
  env.gain.setValueAtTime(intensity * 0.2, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(env); env.connect(master);
  osc.start(now); osc.stop(now + 0.4);

  // Second harmonic ping
  const osc2 = ac.createOscillator();
  const env2 = ac.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 1.5, now);
  osc2.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.25);
  env2.gain.setValueAtTime(intensity * 0.08, now);
  env2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc2.connect(env2); env2.connect(master);
  osc2.start(now); osc2.stop(now + 0.25);
}

// Detect close encounters and ping
let closePingCooldown = 0;
function detectPings() {
  if (closePingCooldown > 0) { closePingCooldown--; return; }
  const threshold = SOFTENING * 2.0;
  const t2 = threshold * threshold;
  for (let k = 0; k < 50; k++) {
    const i = Math.floor(Math.random() * N);
    const j = Math.floor(Math.random() * N);
    if (i === j) continue;
    const dx = px[j] - px[i], dy = py[j] - py[i];
    if (dx*dx + dy*dy < t2) {
      const speed = Math.sqrt(pvx[i]*pvx[i] + pvy[i]*pvy[i]);
      const freq = 180 + speed * 90;
      triggerPing(Math.min(freq, 1400), Math.min(speed / 2.5, 1));
      closePingCooldown = 2;
      break;
    }
  }
}

// Try auto-start, then ensure it fires on first interaction
startAudio();
['click','keydown','touchstart','pointerdown','mousemove'].forEach(ev =>
  document.addEventListener(ev, () => startAudio(), { once: true, passive: true })
);

// ── Respawn on collapse ───────────────────────────────────────
let frameNum = 0;
function maybeRespawn() {
  if (frameNum % 400 !== 0) return;
  let spread = 0;
  for (let i = 0; i < N; i++) spread = Math.max(spread, Math.abs(px[i] - CW/2), Math.abs(py[i] - CH/2));
  if (spread < 60) initBodies();
}

// ── Loop ─────────────────────────────────────────────────────
function animate() {
  step();
  detectPings();
  draw();
  frameNum++;
  maybeRespawn();
  requestAnimationFrame(animate);
}

ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, CW, CH);
requestAnimationFrame(animate);
