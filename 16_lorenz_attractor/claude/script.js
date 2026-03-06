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

// ── Lorenz parameters ─────────────────────────────────────────
const SIGMA = 10, RHO = 28, BETA = 8 / 3;
const DT    = 0.004;          // slower (was 0.007)
const MAX_TRAIL = 6000;
const STEP_PER_FRAME = 3;     // fewer steps per frame → clearer

// Slow camera rotation
let rotX = 0.45, rotZ = 0.0;
const ROT_SPEED_X = 0.0001, ROT_SPEED_Z = 0.00008;

// ── State ─────────────────────────────────────────────────────
const PARTICLES = [
  { x:  0.1, y:  0,   z: 20, trail: [] },
  { x: -0.1, y:  0,   z: 20, trail: [] },
  { x:  0,   y:  0.1, z: 20, trail: [] },
];

function stepLorenz(p) {
  const dx = SIGMA * (p.y - p.x);
  const dy = p.x * (RHO - p.z) - p.y;
  const dz = p.x * p.y - BETA * p.z;
  p.x += dx * DT;
  p.y += dy * DT;
  p.z += dz * DT;
  p.trail.push({ x: p.x, y: p.y, z: p.z });
  if (p.trail.length > MAX_TRAIL) p.trail.shift();
}

// ── Projection ────────────────────────────────────────────────
const SCALE = 17;
function project(x, y, z, cx, cz) {
  const cosZ = Math.cos(cz), sinZ = Math.sin(cz);
  let rx =  x * cosZ - y * sinZ;
  let ry =  x * sinZ + y * cosZ;
  const cosX = Math.cos(cx), sinX = Math.sin(cx);
  const ry2 =  ry * cosX - z * sinX;
  const rz2 =  ry * sinX + z * cosX;
  return {
    sx: CW / 2 + rx * SCALE,
    sy: CH / 2 - ry2 * SCALE - rz2 * 3,
  };
}

const COLORS = [
  { h: 185, s: 100, l: 65 },
  { h: 270, s: 100, l: 70 },
  { h: 50,  s: 100, l: 65 },
];

// Off-screen accumulation canvas
const acc = document.createElement('canvas');
acc.width = CW; acc.height = CH;
const accCtx = acc.getContext('2d');
accCtx.fillStyle = '#080808';
accCtx.fillRect(0, 0, CW, CH);

// ── Render ────────────────────────────────────────────────────
function render() {
  accCtx.fillStyle = 'rgba(8,8,8,0.025)';
  accCtx.fillRect(0, 0, CW, CH);

  for (let pi = 0; pi < PARTICLES.length; pi++) {
    const p = PARTICLES[pi];
    const col = COLORS[pi];
    const trail = p.trail;
    if (trail.length < 2) continue;

    accCtx.lineCap = 'round';
    // Draw last N segments
    const start = Math.max(1, trail.length - STEP_PER_FRAME * 2);
    for (let i = start; i < trail.length; i++) {
      const t  = i / trail.length;
      const pt = project(trail[i-1].x, trail[i-1].y, trail[i-1].z, rotX, rotZ);
      const pc = project(trail[i].x,   trail[i].y,   trail[i].z,   rotX, rotZ);
      const lit = 35 + t * 50;
      accCtx.strokeStyle = `hsl(${col.h},${col.s}%,${lit}%)`;
      accCtx.lineWidth   = 0.6 + t * 2.2;
      accCtx.globalAlpha = 0.5 + t * 0.5;
      accCtx.beginPath();
      accCtx.moveTo(pt.sx, pt.sy);
      accCtx.lineTo(pc.sx, pc.sy);
      accCtx.stroke();
    }
    accCtx.globalAlpha = 1;
  }

  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);
  ctx.drawImage(acc, 0, 0);

  // Glowing tip
  ctx.save();
  ctx.shadowBlur = 35;
  for (let pi = 0; pi < PARTICLES.length; pi++) {
    const p  = PARTICLES[pi];
    const col = COLORS[pi];
    const pt = project(p.x, p.y, p.z, rotX, rotZ);
    ctx.shadowColor = `hsl(${col.h},${col.s}%,80%)`;
    ctx.fillStyle   = `hsl(${col.h},${col.s}%,95%)`;
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Audio — ambient Lorenz drone ──────────────────────────────
let audioCtx = null;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.92, audioCtx.currentTime + 3);
    const _comp=audioCtx.createDynamicsCompressor();_comp.threshold.value=-12;_comp.knee.value=8;_comp.ratio.value=6;_comp.attack.value=0.003;_comp.release.value=0.12;
master.connect(_comp);
  _comp.connect(audioCtx.destination);

  // Convolver reverb
  const revBuf = audioCtx.createBuffer(2, audioCtx.sampleRate * 4, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = revBuf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length, 2.5);
  }
  const rev = audioCtx.createConvolver();
  rev.buffer = revBuf;
  rev.connect(master);

  // Three detuned drones — chaos feel
  [[55, 0.12], [55.3, 0.10], [82.4, 0.07], [110, 0.05]].forEach(([f, v], i) => {
    const osc = audioCtx.createOscillator();
    const g   = audioCtx.createGain();
    osc.type  = i < 2 ? 'sine' : 'triangle';
    osc.frequency.value = f;
    g.gain.value = v;
    osc.connect(g); g.connect(rev);
    osc.start();
    // LFO modulation
    const lfo = audioCtx.createOscillator();
    const lg  = audioCtx.createGain();
    lfo.frequency.value = 0.05 + i * 0.04;
    lg.gain.value = f * 0.008;
    lfo.connect(lg); lg.connect(osc.frequency);
    lfo.start();
  });

  // Occasional high chime when trail shifts
  function scheduleChime() {
    const now = audioCtx.currentTime;
    const freq = [261, 329, 392, 523, 659][Math.floor(Math.random()*5)];
    const osc  = audioCtx.createOscillator();
    const g    = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * (1 + Math.random() * 0.01);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.84, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    osc.connect(g); g.connect(rev);
    osc.start(now); osc.stop(now + 2.5);
    setTimeout(scheduleChime, 1500 + Math.random() * 3000);
  }
  setTimeout(scheduleChime, 1000);
}
document.addEventListener('click', initAudio, { once: true });
setTimeout(() => { try { initAudio(); } catch(e) {} }, 500);

// ── Animate ───────────────────────────────────────────────────
function animate() {
  rotX += ROT_SPEED_X;
  rotZ += ROT_SPEED_Z;
  for (let i = 0; i < STEP_PER_FRAME; i++) PARTICLES.forEach(p => stepLorenz(p));
  render();
  requestAnimationFrame(animate);
}

// Pre-warm
for (let i = 0; i < 5000; i++) PARTICLES.forEach(p => stepLorenz(p));
requestAnimationFrame(animate);



