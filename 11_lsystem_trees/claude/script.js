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

// Accumulation canvas: we draw newly revealed segments onto this each frame
// then blit it to main canvas. This means we NEVER redraw old segments.
const acc = document.createElement('canvas');
acc.width = CW; acc.height = CH;
const accCtx = acc.getContext('2d');

// ── L-System presets ──────────────────────────────────────────
const PRESETS = [
  {
    axiom: 'X',
    rules: { F: 'FF', X: 'F+[[X]-X]-F[-FX]+X' },
    angle: 25, iterations: 6, len: 11,
    startAngle: -Math.PI / 2,
  },
  {
    axiom: 'F',
    rules: { F: 'F[+F]F[-F]F' },
    angle: 25.7, iterations: 5, len: 14,
    startAngle: -Math.PI / 2,
  },
  {
    axiom: 'F',
    rules: { F: 'F[+F]F[-F][F]' },
    angle: 20, iterations: 5, len: 14,
    startAngle: -Math.PI / 2,
  },
  {
    axiom: 'F',
    rules: { F: 'FF-[-F+F+F]+[+F-F-F]' },
    angle: 22.5, iterations: 4, len: 18,
    startAngle: -Math.PI / 2,
  },
];

// ── L-System expansion ────────────────────────────────────────
function expand(axiom, rules, iters) {
  let s = axiom;
  for (let i = 0; i < iters; i++) {
    let n = '';
    for (const c of s) n += rules[c] !== undefined ? rules[c] : c;
    s = n;
  }
  return s;
}

// ── Build segment list ────────────────────────────────────────
function buildSegments(lstr, angleDeg, len, sx, sy, sa) {
  const segs = [];
  const stack = [];
  let x = sx, y = sy, a = sa, depth = 0, maxDepth = 0;
  // Pre-compute maxDepth
  let tmp = 0;
  for (const c of lstr) {
    if (c === '[') { tmp++; if (tmp > maxDepth) maxDepth = tmp; }
    else if (c === ']') tmp--;
  }
  const rad = angleDeg * Math.PI / 180;
  for (const c of lstr) {
    if (c === 'F') {
      const nx = x + len * Math.cos(a), ny = y + len * Math.sin(a);
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, depth, maxDepth });
      x = nx; y = ny;
    } else if (c === '+') { a += rad;
    } else if (c === '-') { a -= rad;
    } else if (c === '[') { stack.push({ x, y, a, depth }); depth++;
    } else if (c === ']') { const sv = stack.pop(); x=sv.x; y=sv.y; a=sv.a; depth=sv.depth; }
  }
  return segs;
}

// ── Segment color ─────────────────────────────────────────────
function segColor(depth, maxDepth) {
  const r = maxDepth > 0 ? depth / maxDepth : 0;
  const hue = 30 + r * 135;       // amber → green → teal
  const sat = 75 + r * 20;
  const lit = 32 + r * 42;
  return { hue, sat, lit, r };
}

// ── Animation state ───────────────────────────────────────────
let presetIdx  = 0;
let segments   = [];
let drawn      = 0;   // how many segments already drawn onto acc
let phase      = 'grow';
let phaseTimer = 0;
let gAlpha     = 1.0;

const GROW_PER_FRAME = 8;   // segments per frame — visible, satisfying growth
const HOLD_FRAMES    = 120;
const FADE_FRAMES    = 55;

function loadPreset(idx) {
  const p    = PRESETS[idx % PRESETS.length];
  const lstr = expand(p.axiom, p.rules, p.iterations);

  // Find bounding box to auto-scale tree to fill most of canvas
  const rawSegs = buildSegments(lstr, p.angle, p.len, 0, 0, p.startAngle);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of rawSegs) {
    minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
  }
  const treeW = maxX - minX || 1;
  const treeH = maxY - minY || 1;
  const margin = 60;
  const scale  = Math.min((CW - margin*2) / treeW, (CH * 0.82) / treeH);
  // Place trunk base at bottom-center
  const ox = CW/2 - (minX + treeW/2) * scale;
  const oy = CH - margin - (maxY * scale);   // keep bottom at canvas bottom

  segments = buildSegments(lstr, p.angle, p.len * scale, ox, oy, p.startAngle);

  // Clear accumulation canvas
  accCtx.clearRect(0, 0, CW, CH);
  drawn      = 0;
  phase      = 'grow';
  phaseTimer = 0;
  gAlpha     = 1.0;
}

loadPreset(0);

// ── Draw new segments onto acc (incremental) ──────────────────
function drawNewSegments(from, to) {
  accCtx.lineCap = 'round';
  accCtx.shadowBlur = 0;

  // Group new segments by depth for batched strokes
  const newSegs = segments.slice(from, to);
  if (newSegs.length === 0) return;
  const maxD = newSegs[0].maxDepth || 1;
  const byDepth = Array.from({ length: maxD + 1 }, () => []);
  for (const seg of newSegs) byDepth[Math.min(seg.depth, maxD)].push(seg);

  for (let d = 0; d <= maxD; d++) {
    const group = byDepth[d];
    if (!group.length) continue;
    const { hue, sat, lit, r } = segColor(d, maxD);
    const lw = Math.max(0.5, 3.5 * (1-r) * (1-r));
    accCtx.strokeStyle = `hsl(${hue},${sat}%,${lit}%)`;
    accCtx.lineWidth   = lw;
    accCtx.beginPath();
    for (const seg of group) {
      accCtx.moveTo(seg.x1, seg.y1);
      accCtx.lineTo(seg.x2, seg.y2);
    }
    accCtx.stroke();
  }
}

// ── Audio ─────────────────────────────────────────────────────
let ac = null, masterGain = null;

function startAudio() {
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    masterGain = ac.createGain();
    masterGain.gain.value = 0.10;
    masterGain.connect(ac.destination);
    [110, 220, 330].forEach((f, i) => {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f + Math.random();
      g.gain.value = 0.15 / (i+1);
      osc.connect(g); g.connect(masterGain); osc.start();
    });
    function tick() {
      if (!ac) return;
      if (phase === 'grow') {
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate*0.03), ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i=0; i<d.length; i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.3));
        const src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = buf; g.gain.value = 0.06;
        src.connect(g); g.connect(masterGain); src.start();
      }
      setTimeout(tick, 85 + Math.random()*100);
    }
    tick();
    document.addEventListener('click', () => { if (ac.state==='suspended') ac.resume(); });
  } catch(e) {}
}
startAudio();

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = gAlpha;
  ctx.drawImage(acc, 0, 0);
  ctx.globalAlpha = 1.0;
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  if (phase === 'grow') {
    const next = Math.min(drawn + GROW_PER_FRAME, segments.length);
    drawNewSegments(drawn, next);
    drawn = next;
    if (drawn >= segments.length) { phase = 'hold'; phaseTimer = 0; }
  } else if (phase === 'hold') {
    phaseTimer++;
    if (phaseTimer >= HOLD_FRAMES) { phase = 'fade'; phaseTimer = 0; }
  } else if (phase === 'fade') {
    phaseTimer++;
    gAlpha = 1 - phaseTimer / FADE_FRAMES;
    if (phaseTimer >= FADE_FRAMES) {
      presetIdx = (presetIdx + 1) % PRESETS.length;
      loadPreset(presetIdx);
    }
  }
  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
