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

// ── Cave grid ─────────────────────────────────────────────────
const COLS = 106, ROWS = 134;
const CELL_W = CW / COLS, CELL_H = CH / ROWS;

// 0 = open space, 1 = wall
let grid    = new Uint8Array(COLS * ROWS);
let gridTmp = new Uint8Array(COLS * ROWS);

function G(x, y) { return x + y * COLS; }

// ── Cellular automata ─────────────────────────────────────────
function randomize(fillProb) {
  for (let i = 0; i < COLS * ROWS; i++) {
    grid[i] = Math.random() < fillProb ? 1 : 0;
  }
  // Always fill border
  for (let x = 0; x < COLS; x++) { grid[G(x, 0)] = 1; grid[G(x, ROWS-1)] = 1; }
  for (let y = 0; y < ROWS; y++) { grid[G(0, y)] = 1; grid[G(COLS-1, y)] = 1; }
}

function countNeighbors(x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { n++; continue; }
      n += grid[G(nx, ny)];
    }
  }
  return n;
}

function caStep() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const n = countNeighbors(x, y);
      // Birth/survival rule: born if ≥5 neighbors; survives if ≥4
      gridTmp[G(x, y)] = (grid[G(x, y)] === 1) ? (n >= 4 ? 1 : 0) : (n >= 5 ? 1 : 0);
    }
  }
  // Swap
  const tmp = grid; grid = gridTmp; gridTmp = tmp;
  // Re-fill border
  for (let x = 0; x < COLS; x++) { grid[G(x, 0)] = 1; grid[G(x, ROWS-1)] = 1; }
  for (let y = 0; y < ROWS; y++) { grid[G(0, y)] = 1; grid[G(COLS-1, y)] = 1; }
}

// ── Build cave (generate + smooth) ────────────────────────────
function buildCave() {
  randomize(0.48);
  for (let i = 0; i < 5; i++) caStep();
}

// ── Lighting / depth shading ──────────────────────────────────
// Compute distance-to-wall for open cells (simple BFS flood)
function computeDepth() {
  const depth = new Float32Array(COLS * ROWS).fill(-1);
  const queue = [];
  // Seed: all wall-adjacent open cells have depth 0
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[G(x, y)] === 0) {
        let adj = false;
        for (let dy = -1; dy <= 1 && !adj; dy++) {
          for (let dx = -1; dx <= 1 && !adj; dx++) {
            const nx = x+dx, ny = y+dy;
            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && grid[G(nx, ny)] === 1) adj = true;
          }
        }
        if (adj) { depth[G(x, y)] = 0; queue.push(x + y * COLS); }
      }
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const x = idx % COLS, y = (idx / COLS) | 0;
    const d = depth[idx];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x+dx, ny = y+dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          const ni = G(nx, ny);
          if (grid[ni] === 0 && depth[ni] < 0) {
            depth[ni] = d + 1;
            queue.push(ni);
          }
        }
      }
    }
  }
  return depth;
}

// ── Audio ─────────────────────────────────────────────────────
let aCtx = null;
function initAudio() {
  if (aCtx) return;
  aCtx = new (window.AudioContext || window.webkitAudioContext)();
  const master = aCtx.createGain();
  master.gain.setValueAtTime(0, aCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.38, aCtx.currentTime + 3);
  master.connect(aCtx.destination);
  // reverb (long cave echo)
  const rb = aCtx.createBuffer(2, aCtx.sampleRate * 5, aCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = rb.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length,1.5);
  }
  const rev = aCtx.createConvolver(); rev.buffer = rb; rev.connect(master);
  // low cave rumble drone
  [40, 60, 80].forEach((f, i) => {
    const o = aCtx.createOscillator(); const g = aCtx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.10 - i * 0.02;
    o.connect(g); g.connect(rev); o.start();
  });
  // cave wind: band-passed noise
  const nb = aCtx.createBuffer(1, aCtx.sampleRate*2, aCtx.sampleRate);
  const nd = nb.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  const ns = aCtx.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const bp = aCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=180; bp.Q.value=1.2;
  const ng = aCtx.createGain(); ng.gain.value = 0.18;
  ns.connect(bp); bp.connect(ng); ng.connect(rev); ns.start();
  // drip sounds — spaced randomly
  function drip() {
    const now = aCtx.currentTime;
    const o = aCtx.createOscillator(); const g = aCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900 + Math.random()*400, now);
    o.frequency.exponentialRampToValueAtTime(300 + Math.random()*200, now + 0.15);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o.connect(g); g.connect(rev);
    o.start(now); o.stop(now + 0.55);
    setTimeout(drip, 800 + Math.random() * 3500);
  }
  setTimeout(drip, 400);
  // occasional low distant boom
  function boom() {
    const now = aCtx.currentTime;
    const o = aCtx.createOscillator(); const g = aCtx.createGain();
    o.type = 'sine'; o.frequency.value = 50 + Math.random()*20;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    o.connect(g); g.connect(rev); o.start(now); o.stop(now + 2.5);
    setTimeout(boom, 6000 + Math.random() * 10000);
  }
  setTimeout(boom, 3000);
}
document.addEventListener('click', initAudio, { once: true });
setTimeout(() => { try { initAudio(); } catch(e) {} }, 500);

// ── Drip particles (ambient atmosphere) ──────────────────────
const drips = [];
function spawnDrip() {
  // Find a random open cell near top
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = 1 + Math.floor(Math.random() * (COLS - 2));
    const y = 5 + Math.floor(Math.random() * (ROWS / 3));
    if (grid[G(x, y)] === 0) {
      drips.push({
        x: (x + 0.5) * CELL_W + (Math.random() - 0.5) * CELL_W,
        y: (y + 0.5) * CELL_H,
        vy: 0.8 + Math.random() * 1.5,
        alpha: 0.6 + Math.random() * 0.4,
        size: 1.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 80 + Math.random() * 120,
      });
      break;
    }
  }
}
for (let i = 0; i < 40; i++) spawnDrip();

// ── State ─────────────────────────────────────────────────────
let depth = null;
let maxDepth = 1;
let revealFrame = 0;
let totalFrames = 80;  // frames to animate the cave reveal
let phase = 'reveal'; // 'reveal' | 'hold' | 'fade' | 'regen'
let phaseTimer = 0;
let globalAlpha = 1;

// Pre-render cave to offscreen canvas
const offC = document.createElement('canvas');
offC.width = CW; offC.height = CH;
const offCtx = offC.getContext('2d');

function prerenderCave() {
  offCtx.clearRect(0, 0, CW, CH);
  offCtx.fillStyle = '#050505';
  offCtx.fillRect(0, 0, CW, CH);

  depth = computeDepth();
  maxDepth = 0;
  for (let i = 0; i < depth.length; i++) if (depth[i] > maxDepth) maxDepth = depth[i];
  maxDepth = Math.max(1, maxDepth);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * CELL_W, py = y * CELL_H;
      if (grid[G(x, y)] === 1) {
        // Wall — dark stone with subtle teal tint
        const shade = 15 + Math.floor(Math.random() * 12);
        offCtx.fillStyle = `rgb(${shade},${shade+4},${shade+8})`;
        offCtx.fillRect(px, py, CELL_W + 1, CELL_H + 1);
      } else {
        // Open cell — depth-based lighting
        const d  = depth[G(x, y)];
        const dt = d < 0 ? 0 : Math.min(1, d / (maxDepth * 0.6));
        // Cyan/teal luminous cave interior
        const r = Math.floor(dt * 20);
        const g = Math.floor(25 + dt * 80);
        const b = Math.floor(35 + dt * 120);
        offCtx.fillStyle = `rgb(${r},${g},${b})`;
        offCtx.fillRect(px, py, CELL_W + 1, CELL_H + 1);
      }
    }
  }

  // Subtle glowing vein lines along cave walls
  offCtx.save();
  offCtx.strokeStyle = 'rgba(80,200,255,0.18)';
  offCtx.lineWidth = 1;
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[G(x,y)] === 1 && (
        grid[G(x+1,y)] === 0 || grid[G(x-1,y)] === 0 ||
        grid[G(x,y+1)] === 0 || grid[G(x,y-1)] === 0)) {
        offCtx.strokeRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H);
      }
    }
  }
  offCtx.restore();
}

buildCave();
prerenderCave();

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, CW, CH);

  ctx.globalAlpha = globalAlpha;

  if (phase === 'reveal') {
    // Reveal row by row from top
    const revealY = Math.floor((revealFrame / totalFrames) * ROWS);
    const clipH   = revealY * CELL_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CW, clipH);
    ctx.clip();
    ctx.drawImage(offC, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(offC, 0, 0);
  }

  // Drip particles
  ctx.globalAlpha = globalAlpha;
  for (const drip of drips) {
    const t = drip.life / drip.maxLife;
    const a = drip.alpha * (1 - t * 0.6);
    ctx.fillStyle = `rgba(100,220,255,${a})`;
    ctx.beginPath();
    ctx.arc(drip.x, drip.y, drip.size * (1 - t * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  // Update drips
  for (const drip of drips) {
    drip.y  += drip.vy;
    drip.life++;
    if (drip.life >= drip.maxLife || drip.y > CH) {
      Object.assign(drip, (() => { spawnDrip(); return drips.pop(); })());
    }
  }
  if (Math.random() < 0.04) spawnDrip();
  if (drips.length > 60) drips.shift();

  if (phase === 'reveal') {
    revealFrame++;
    if (revealFrame >= totalFrames) { phase = 'hold'; phaseTimer = 0; }
  } else if (phase === 'hold') {
    phaseTimer++;
    if (phaseTimer >= 140) { phase = 'fade'; phaseTimer = 0; }
  } else if (phase === 'fade') {
    phaseTimer++;
    globalAlpha = 1 - phaseTimer / 55;
    if (phaseTimer >= 55) { phase = 'regen'; phaseTimer = 0; }
  } else if (phase === 'regen') {
    buildCave();
    prerenderCave();
    revealFrame = 0;
    globalAlpha = 1;
    phase = 'reveal';
  }

  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
