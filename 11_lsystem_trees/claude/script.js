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

// ── L-System presets ───────────────────────────────────────────
// Multiple tree variations to cycle through
const PRESETS = [
  {
    name: 'Fractal Plant',
    axiom: 'X',
    rules: { F: 'FF', X: 'F+[[X]-X]-F[-FX]+X' },
    angle: 25,
    iterations: 6,
    len: 7,
    startAngle: -Math.PI / 2,
  },
  {
    name: 'Symmetric Tree',
    axiom: 'F',
    rules: { F: 'F[+F]F[-F]F' },
    angle: 25.7,
    iterations: 5,
    len: 9,
    startAngle: -Math.PI / 2,
  },
  {
    name: 'Dragon Branch',
    axiom: 'F',
    rules: { F: 'F[+F]F[-F][F]' },
    angle: 20,
    iterations: 5,
    len: 10,
    startAngle: -Math.PI / 2,
  },
  {
    name: 'Sparse Bush',
    axiom: 'F',
    rules: { F: 'FF-[-F+F+F]+[+F-F-F]' },
    angle: 22.5,
    iterations: 4,
    len: 14,
    startAngle: -Math.PI / 2,
  },
];

// ── Expand L-System string ────────────────────────────────────
function expand(axiom, rules, iterations) {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of s) {
      next += rules[ch] !== undefined ? rules[ch] : ch;
    }
    s = next;
  }
  return s;
}

// ── Parse L-string into a flat list of segments ───────────────
// Returns array of {x1,y1,x2,y2,depth,maxDepth}
function buildSegments(lstr, angle, len, startX, startY, startAngle) {
  const segs = [];
  const stack = [];
  let x = startX, y = startY, a = startAngle;
  let depth = 0, maxDepth = 0;

  // First pass: compute max depth
  let d = 0;
  for (const c of lstr) {
    if (c === '[') { d++; if (d > maxDepth) maxDepth = d; }
    else if (c === ']') d--;
  }

  const rad = (angle * Math.PI) / 180;

  for (const c of lstr) {
    if (c === 'F') {
      const nx = x + len * Math.cos(a);
      const ny = y + len * Math.sin(a);
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth, maxDepth });
      x = nx; y = ny;
    } else if (c === '+') {
      a += rad;
    } else if (c === '-') {
      a -= rad;
    } else if (c === '[') {
      stack.push({ x, y, a, depth });
      depth++;
    } else if (c === ']') {
      const s = stack.pop();
      x = s.x; y = s.y; a = s.a; depth = s.depth;
    }
  }
  return segs;
}

// ── Color per branch depth ────────────────────────────────────
// Trunk = warm amber, tips = bright green/teal, glow fades inward
function branchColor(depth, maxDepth, t) {
  // t = progress [0,1]
  const ratio = maxDepth > 0 ? depth / maxDepth : 0;
  // Hue: 35 (amber trunk) → 130 (green mid) → 160 (teal tips)
  const hue = 35 + ratio * 130;
  const sat = 70 + ratio * 30;
  const lit = 35 + ratio * 45;
  return `hsl(${hue},${sat}%,${lit}%)`;
}

function glowColor(depth, maxDepth) {
  const ratio = maxDepth > 0 ? depth / maxDepth : 0;
  const hue = 35 + ratio * 130;
  return `hsl(${hue},100%,60%)`;
}

// ── Animation state ───────────────────────────────────────────
let presetIdx = 0;
let segments  = [];
let drawCount = 0;  // how many segments drawn so far
let phase     = 'grow';  // 'grow' | 'hold' | 'fade'
let phaseTimer = 0;
let globalAlpha = 1.0;

const GROW_SPEED   = 3;    // segments revealed per frame
const HOLD_FRAMES  = 120;  // 2s hold when fully grown
const FADE_FRAMES  = 60;   // 1s fade out

function loadPreset(idx) {
  const p = PRESETS[idx % PRESETS.length];
  const lstr = expand(p.axiom, p.rules, p.iterations);

  // Center tree at bottom-center of canvas
  const startX = CW / 2;
  const startY = CH - 60;

  segments  = buildSegments(lstr, p.angle, p.len, startX, startY, p.startAngle);
  drawCount = 0;
  phase     = 'grow';
  phaseTimer = 0;
  globalAlpha = 1.0;
}

loadPreset(0);

// ── Render ─────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);

  const count = Math.min(drawCount, segments.length);
  ctx.globalAlpha = globalAlpha;

  for (let i = 0; i < count; i++) {
    const seg = segments[i];
    const col   = branchColor(seg.depth, seg.maxDepth, i / segments.length);
    const glow  = glowColor(seg.depth, seg.maxDepth);

    // Line width thinner for higher-depth branches
    const depthRatio = seg.maxDepth > 0 ? 1 - seg.depth / seg.maxDepth : 1;
    const lw = Math.max(0.8, 3.5 * depthRatio * depthRatio);

    // Glow pass
    ctx.save();
    ctx.strokeStyle = glow;
    ctx.lineWidth   = lw * 3;
    ctx.globalAlpha = globalAlpha * 0.25 * depthRatio;
    ctx.lineCap = 'round';
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.restore();

    // Main branch
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth   = lw;
    ctx.lineCap = 'round';
    ctx.globalAlpha = globalAlpha;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1.0;
}

// ── Animate ────────────────────────────────────────────────────
function animate() {
  if (phase === 'grow') {
    drawCount += GROW_SPEED;
    if (drawCount >= segments.length) {
      drawCount = segments.length;
      phase = 'hold';
      phaseTimer = 0;
    }
  } else if (phase === 'hold') {
    phaseTimer++;
    if (phaseTimer >= HOLD_FRAMES) {
      phase = 'fade';
      phaseTimer = 0;
    }
  } else if (phase === 'fade') {
    phaseTimer++;
    globalAlpha = 1 - phaseTimer / FADE_FRAMES;
    if (phaseTimer >= FADE_FRAMES) {
      presetIdx = (presetIdx + 1) % PRESETS.length;
      loadPreset(presetIdx);
    }
  }

  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
