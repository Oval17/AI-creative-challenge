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
const DT    = 0.007;
const MAX_TRAIL = 4000;   // points kept in history
const STEP_PER_FRAME = 6; // integration steps per frame

// Slow camera rotation
let rotX = 0.0, rotZ = 0.0;
const ROT_SPEED_X = 0.0003, ROT_SPEED_Z = 0.00015;

// ── State ─────────────────────────────────────────────────────
// Two attractors starting from slightly different initial conditions
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
// 3D → 2D with rotation around X and Z axes, then isometric-ish project
const SCALE = 14;
function project(x, y, z, cx, cz) {
  // Rotate around Z
  const cosZ = Math.cos(cz), sinZ = Math.sin(cz);
  let rx =  x * cosZ - y * sinZ;
  let ry =  x * sinZ + y * cosZ;
  let rz =  z;
  // Rotate around X
  const cosX = Math.cos(cx), sinX = Math.sin(cx);
  const ry2 =  ry * cosX - rz * sinX;
  const rz2 =  ry * sinX + rz * cosX;
  return {
    sx: CW / 2 + rx * SCALE,
    sy: CH / 2 - ry2 * SCALE - rz2 * 4,
  };
}

// ── Colors per particle ───────────────────────────────────────
const COLORS = [
  { h: 195, s: 100, l: 65 },   // cyan
  { h: 280, s: 100, l: 70 },   // violet
  { h: 45,  s: 100, l: 65 },   // amber
];

// ── Accumulation canvas for trail fade ───────────────────────
const acc = document.createElement('canvas');
acc.width = CW; acc.height = CH;
const accCtx = acc.getContext('2d');

// ── Render ─────────────────────────────────────────────────────
function render() {
  // Fade accumulation slightly
  accCtx.fillStyle = 'rgba(8,8,8,0.04)';
  accCtx.fillRect(0, 0, CW, CH);

  // Draw each particle's trail (only the newest segment this frame)
  for (let pi = 0; pi < PARTICLES.length; pi++) {
    const p   = PARTICLES[pi];
    const col = COLORS[pi];
    const trail = p.trail;
    if (trail.length < 2) continue;

    // Draw full trail (incrementally each frame → accumulation handles persistence)
    accCtx.lineCap = 'round';
    for (let i = Math.max(1, trail.length - STEP_PER_FRAME); i < trail.length; i++) {
      const t  = i / trail.length;
      const pt = project(trail[i-1].x, trail[i-1].y, trail[i-1].z, rotX, rotZ);
      const pc = project(trail[i].x,   trail[i].y,   trail[i].z,   rotX, rotZ);
      const lit = 40 + t * 45;
      accCtx.strokeStyle = `hsl(${col.h},${col.s}%,${lit}%)`;
      accCtx.lineWidth   = 0.8 + t * 1.8;
      accCtx.globalAlpha = 0.55 + t * 0.45;
      accCtx.beginPath();
      accCtx.moveTo(pt.sx, pt.sy);
      accCtx.lineTo(pc.sx, pc.sy);
      accCtx.stroke();
    }
    accCtx.globalAlpha = 1;
  }

  // Blit to main canvas
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);
  ctx.drawImage(acc, 0, 0);

  // Glowing tip for each particle
  ctx.save();
  ctx.shadowBlur = 30;
  for (let pi = 0; pi < PARTICLES.length; pi++) {
    const p   = PARTICLES[pi];
    const col = COLORS[pi];
    const pt  = project(p.x, p.y, p.z, rotX, rotZ);
    ctx.shadowColor = `hsl(${col.h},${col.s}%,75%)`;
    ctx.fillStyle   = `hsl(${col.h},${col.s}%,90%)`;
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  rotX += ROT_SPEED_X;
  rotZ += ROT_SPEED_Z;

  for (let i = 0; i < STEP_PER_FRAME; i++) {
    PARTICLES.forEach(p => stepLorenz(p));
  }

  render();
  requestAnimationFrame(animate);
}

// Pre-warm the attractor so it starts in the "butterfly"
for (let i = 0; i < 3000; i++) PARTICLES.forEach(p => stepLorenz(p));

requestAnimationFrame(animate);
