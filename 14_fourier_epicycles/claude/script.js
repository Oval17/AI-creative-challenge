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

// ── Shape definitions (sampled paths) ─────────────────────────
function sampleShape(shapeFn, N) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const [x, y] = shapeFn(t);
    pts.push({ re: x, im: y });
  }
  return pts;
}

// Collection of interesting shapes
const SHAPES = [
  // Heart
  t => {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
    return [x * 22, y * 22];
  },
  // Star
  t => {
    const r = 1 + 0.4 * Math.cos(5 * t);
    return [r * 360 * Math.cos(t), r * 360 * Math.sin(t)];
  },
  // Lissajous
  t => [360 * Math.sin(3 * t + Math.PI/4), 360 * Math.sin(2 * t)],
  // Epitrochoid (spirograph)
  t => {
    const R = 5, r = 3, d = 5;
    return [
      (R+r)*Math.cos(t) - d*Math.cos((R+r)/r*t),
      (R+r)*Math.sin(t) - d*Math.sin((R+r)/r*t)
    ].map(v => v * 38);
  },
];

// ── DFT ────────────────────────────────────────────────────────
function dft(signal) {
  const N = signal.length;
  const result = [];
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n].re * Math.cos(angle) + signal[n].im * Math.sin(angle);
      im += -signal[n].re * Math.sin(angle) + signal[n].im * Math.cos(angle);
    }
    re /= N; im /= N;
    const amp   = Math.sqrt(re*re + im*im);
    const phase = Math.atan2(im, re);
    result.push({ freq: k, amp, phase, re, im });
  }
  // Sort by amplitude descending
  result.sort((a, b) => b.amp - a.amp);
  return result;
}

// ── State ──────────────────────────────────────────────────────
const N_SAMPLES = 256;
const N_CIRCLES = 64; // use top N_CIRCLES harmonics

let freqs       = [];
let path        = [];        // traced path points
let time        = 0;
let shapeIdx    = 0;
let phase2      = 'trace';   // 'trace' | 'hold' | 'fade'
let holdTimer   = 0;
let gAlpha      = 1;

const SPEED      = (2 * Math.PI) / (N_SAMPLES * 1.0); // complete one revolution per N_SAMPLES frames
const HOLD_F     = 80;
const FADE_F     = 50;

function loadShape(idx) {
  const pts  = sampleShape(SHAPES[idx % SHAPES.length], N_SAMPLES);
  freqs      = dft(pts).slice(0, N_CIRCLES);
  path       = [];
  time       = 0;
  phase2     = 'trace';
  holdTimer  = 0;
  gAlpha     = 1;
}

loadShape(0);

// ── Epicycle computation ───────────────────────────────────────
function computeEpicycles(t) {
  // Returns array of {cx,cy,r} for each circle, plus final tip point
  const cx0 = CW / 2, cy0 = CH / 2;
  let x = cx0, y = cy0;
  const circles = [];

  for (const f of freqs) {
    const prevX = x, prevY = y;
    const angle = f.freq * t + f.phase;
    x += f.amp * Math.cos(angle);
    y += f.amp * Math.sin(angle);
    circles.push({ x: prevX, y: prevY, r: f.amp, tipX: x, tipY: y });
  }
  return { circles, tipX: x, tipY: y };
}

// ── Render ─────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);

  ctx.globalAlpha = gAlpha;

  const { circles, tipX, tipY } = computeEpicycles(time);

  // Draw circles (only visible ones with r > threshold)
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (c.r < 1.5) continue;

    const t = i / circles.length;
    const hue = 200 + t * 120; // blue → green as circles get smaller
    const alpha = 0.08 + (1 - t) * 0.12;

    // Circle outline
    ctx.save();
    ctx.strokeStyle = `hsla(${hue},80%,60%,${alpha})`;
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();

    // Radius arm
    ctx.strokeStyle = `hsla(${hue},90%,70%,${alpha * 2.5})`;
    ctx.lineWidth   = 1.0;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.tipX, c.tipY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw traced path
  if (path.length > 1) {
    ctx.save();
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Gradient path: older points fade
    for (let i = 1; i < path.length; i++) {
      const t  = i / path.length;
      const hue = 160 + t * 80;  // teal → magenta as path progresses
      const alpha = 0.3 + t * 0.7;
      ctx.strokeStyle = `hsla(${hue},100%,65%,${alpha})`;
      ctx.lineWidth   = 1.5 + t * 1.5;
      ctx.beginPath();
      ctx.moveTo(path[i-1].x, path[i-1].y);
      ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Glow tip
  ctx.save();
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 20;
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
}

// ── Animation ──────────────────────────────────────────────────
function animate() {
  if (phase2 === 'trace') {
    const { tipX, tipY } = computeEpicycles(time);
    path.push({ x: tipX, y: tipY });
    time += SPEED;

    if (path.length >= N_SAMPLES) {
      phase2 = 'hold';
      holdTimer = 0;
    }
  } else if (phase2 === 'hold') {
    // Keep spinning but don't extend path
    time += SPEED;
    holdTimer++;
    if (holdTimer >= HOLD_F) { phase2 = 'fade'; holdTimer = 0; }
  } else if (phase2 === 'fade') {
    time += SPEED;
    holdTimer++;
    gAlpha = 1 - holdTimer / FADE_F;
    if (holdTimer >= FADE_F) {
      shapeIdx++;
      loadShape(shapeIdx);
    }
  }

  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
