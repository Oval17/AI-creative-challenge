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
const NUM_BARS = 80;
const BAR_GAP  = 4;
const BAR_W    = Math.floor((CW - (NUM_BARS + 1) * BAR_GAP) / NUM_BARS);
const MAX_H    = CH - 160;
const BASE_Y   = CH - 60;
const STEP_MS  = 36;

// ── Palettes per algorithm ────────────────────────────────────
const PALETTES = {
  bubble: ['#ff2d78','#ff8c00','#ffe600','#00f0ff'],
  quick:  ['#7b2fff','#00cfff','#00ffb8','#ffffff'],
};

const ALGO_LABELS = { bubble: 'Bubble Sort', quick: 'Quick Sort' };

// ── State ─────────────────────────────────────────────────────
let arr         = [];
let steps       = [];
let stepIdx     = 0;
let lastStepT   = 0;
let highlighted = {};
let algoName    = 'bubble';
let labelAlpha  = 0;
let phase       = 'sorting';

// ── Array helpers ─────────────────────────────────────────────
function makeArray() {
  arr = Array.from({ length: NUM_BARS }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Bubble sort generator ─────────────────────────────────────
function* bubbleGen(a) {
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      yield { t: 'cmp', i: j, j: j + 1 };
      if (a[j] > a[j + 1]) {
        [a[j], a[j+1]] = [a[j+1], a[j]];
        yield { t: 'swp', i: j, j: j + 1 };
      }
    }
    yield { t: 'done', i: n - i - 1 };
  }
  yield { t: 'done', i: 0 };
}

// ── Quick sort generator ──────────────────────────────────────
function* quickGen(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return;
  yield { t: 'pivot', i: hi };
  const pivot = a[hi];
  let p = lo;
  for (let j = lo; j < hi; j++) {
    yield { t: 'cmp', i: j, j: hi };
    if (a[j] <= pivot) {
      if (p !== j) { [a[p], a[j]] = [a[j], a[p]]; yield { t: 'swp', i: p, j }; }
      p++;
    }
  }
  [a[p], a[hi]] = [a[hi], a[p]];
  yield { t: 'swp', i: p, j: hi };
  yield { t: 'done', i: p };
  yield* quickGen(a, lo, p - 1);
  yield* quickGen(a, p + 1, hi);
}

// ── Start a sort run ──────────────────────────────────────────
function startSort(algo) {
  makeArray();
  algoName   = algo;
  labelAlpha = 1.5;
  highlighted = {};
  stepIdx    = 0;
  lastStepT  = 0;
  phase      = 'sorting';

  const a   = [...arr];
  const gen = algo === 'bubble' ? bubbleGen(a) : quickGen(a);
  steps = [];
  for (const s of gen) steps.push(s);
}

// ── Apply one step ────────────────────────────────────────────
function applyStep(step) {
  if ((step.t === 'cmp' || step.t === 'swp') && ac && audioReady) {
    beep(arr[step.i]);
  }
  if (step.t === 'swp') {
    [arr[step.i], arr[step.j]] = [arr[step.j], arr[step.i]];
  }
}

// ── Draw ──────────────────────────────────────────────────────
function getBarGrad(bx, by, bh, pal) {
  const grad = ctx.createLinearGradient(bx, by, bx, BASE_Y);
  const n = pal.length;
  pal.forEach((c, i) => grad.addColorStop(i / (n - 1), c));
  return grad;
}

function draw() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, CW, CH);

  const pal = PALETTES[algoName];

  for (let i = 0; i < NUM_BARS; i++) {
    const val = arr[i];
    const bh  = Math.max(4, (val / NUM_BARS) * MAX_H);
    const bx  = BAR_GAP + i * (BAR_W + BAR_GAP);
    const by  = BASE_Y - bh;
    const hl  = highlighted[i];

    let color;
    if (hl === 'cmp')   color = '#ffffff';
    else if (hl === 'swp')  color = '#ff2d78';
    else if (hl === 'pivot') color = '#ffe600';
    else if (hl === 'done')  color = '#00ff88';
    else color = getBarGrad(bx, by, bh, pal);

    if (hl === 'swp' || hl === 'cmp' || hl === 'pivot') {
      ctx.save();
      ctx.shadowColor = hl === 'swp' ? '#ff2d78' : hl === 'pivot' ? '#ffe600' : '#aaaaff';
      ctx.shadowBlur  = 22;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, BAR_W, bh, [3, 3, 0, 0]);
    ctx.fill();

    if (hl === 'swp' || hl === 'cmp' || hl === 'pivot') ctx.restore();
  }

  // Fading algorithm label
  if (labelAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(labelAlpha, 1);
    ctx.font = '300 54px "Cormorant Garamond", serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(ALGO_LABELS[algoName], CW / 2, 110);
    ctx.restore();
    labelAlpha -= 0.005;
  }
}

// ── Animation loop ────────────────────────────────────────────
function animate(ts) {
  if (phase === 'sorting' && ts - lastStepT >= STEP_MS) {
    lastStepT = ts;
    // Retain 'done' highlights, clear others
    const keep = {};
    for (const k in highlighted) { if (highlighted[k] === 'done') keep[k] = 'done'; }
    highlighted = keep;

    if (stepIdx < steps.length) {
      const step = steps[stepIdx++];
      applyStep(step);
      if (step.t === 'cmp')   { highlighted[step.i] = 'cmp';  highlighted[step.j] = 'cmp'; }
      if (step.t === 'swp')   { highlighted[step.i] = 'swp';  highlighted[step.j] = 'swp'; }
      if (step.t === 'pivot') { highlighted[step.i] = 'pivot'; }
      if (step.t === 'done')  { highlighted[step.i] = 'done'; }
    } else {
      phase = 'done';
      highlighted = {};
      for (let i = 0; i < NUM_BARS; i++) highlighted[i] = 'done';
      setTimeout(() => startSort(algoName === 'bubble' ? 'quick' : 'bubble'), 1600);
    }
  }

  draw();
  requestAnimationFrame(animate);
}

// ── Audio ─────────────────────────────────────────────────────
let ac = null, audioReady = false, masterGain = null;

async function startAudio() {
  if (audioReady) { if (ac.state === 'suspended') await ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    await ac.resume();

    masterGain = ac.createGain();
    masterGain.gain.setValueAtTime(0, ac.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.35, ac.currentTime + 2);
    masterGain.connect(ac.destination);

    // Ambient hum
    const hum = ac.createOscillator();
    hum.type = 'triangle'; hum.frequency.value = 60;
    const hg = ac.createGain(); hg.gain.value = 0.15;
    hum.connect(hg); hg.connect(masterGain); hum.start();

    audioReady = true;
  } catch(e) { console.warn('audio:', e); }
}

function beep(val) {
  if (!ac || ac.state !== 'running') return;
  const freq = 160 + (val / NUM_BARS) * 1400;
  const now  = ac.currentTime;
  const osc  = ac.createOscillator();
  const env  = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.1, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  osc.connect(env); env.connect(ac.destination);
  osc.start(now); osc.stop(now + 0.055);
}

// Auto-start audio
startAudio();
['click','keydown','touchstart','pointerdown','mousemove'].forEach(ev =>
  document.addEventListener(ev, () => startAudio(), { once: true, passive: true })
);

// ── Boot ──────────────────────────────────────────────────────
startSort('bubble');
requestAnimationFrame(animate);
