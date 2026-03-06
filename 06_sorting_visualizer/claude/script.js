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
const STEP_MS  = 8;   // ms between animation frames (faster)
const STEPS_PER_FRAME = 3; // steps processed per tick (extra speed)

// ── Palettes per algorithm ────────────────────────────────────
const PALETTES = {
  bubble: ['#ff2d78','#ff8c00','#ffe600','#00f0ff'],
  quick:  ['#7b2fff','#00cfff','#00ffb8','#ffffff'],
  merge:  ['#ff6b35','#f7c59f','#efefd0','#004e89'],
  heap:   ['#e63946','#457b9d','#a8dadc','#f1faee'],
};

const ALGO_LABELS = {
  bubble: 'Bubble Sort',
  quick:  'Quick Sort',
  merge:  'Merge Sort',
  heap:   'Heap Sort',
};

const ALGO_ORDER = ['bubble', 'quick', 'merge', 'heap'];

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

// ── Merge sort generator ──────────────────────────────────────
function* mergeGen(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  yield* mergeGen(a, lo, mid);
  yield* mergeGen(a, mid + 1, hi);
  const left  = a.slice(lo, mid + 1);
  const right = a.slice(mid + 1, hi + 1);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    yield { t: 'cmp', i: lo + i, j: mid + 1 + j };
    const val = left[i] <= right[j] ? left[i++] : right[j++];
    a[k] = val;
    yield { t: 'put', i: k, v: val }; // overwrite at position k
    k++;
  }
  while (i < left.length) { const val = left[i++]; a[k] = val; yield { t: 'put', i: k, v: val }; k++; }
  while (j < right.length) { const val = right[j++]; a[k] = val; yield { t: 'put', i: k, v: val }; k++; }
  for (let x = lo; x <= hi; x++) yield { t: 'done', i: x };
}

// ── Heap sort generator ───────────────────────────────────────
function* heapGen(a) {
  const n = a.length;

  function* heapify(arr, n, root) {
    let largest = root;
    const l = 2 * root + 1;
    const r = 2 * root + 2;
    if (l < n) { yield { t: 'cmp', i: l, j: largest }; if (arr[l] > arr[largest]) largest = l; }
    if (r < n) { yield { t: 'cmp', i: r, j: largest }; if (arr[r] > arr[largest]) largest = r; }
    if (largest !== root) {
      [arr[root], arr[largest]] = [arr[largest], arr[root]];
      yield { t: 'swp', i: root, j: largest };
      yield* heapify(arr, n, largest);
    }
  }

  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) yield* heapify(a, n, i);

  // Extract elements
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]];
    yield { t: 'swp', i: 0, j: i };
    yield { t: 'done', i };
    yield* heapify(a, i, 0);
  }
  yield { t: 'done', i: 0 };
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

  const a = [...arr];
  let gen;
  if (algo === 'bubble')     gen = bubbleGen(a);
  else if (algo === 'quick') gen = quickGen(a);
  else if (algo === 'merge') gen = mergeGen(a);
  else                       gen = heapGen(a);

  steps = [];
  for (const s of gen) steps.push(s);
}

// ── Apply one step ────────────────────────────────────────────
function applyStep(step) {
  if ((step.t === 'cmp' || step.t === 'swp' || step.t === 'put') && ac && audioReady) {
    beep(arr[step.i]);
  }
  if (step.t === 'swp') {
    [arr[step.i], arr[step.j]] = [arr[step.j], arr[step.i]];
  }
  if (step.t === 'put') {
    arr[step.i] = step.v; // merge sort direct overwrite
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

    // Process multiple steps per frame for extra speed
    for (let f = 0; f < STEPS_PER_FRAME; f++) {
      // Retain 'done' highlights, clear others
      const keep = {};
      for (const k in highlighted) { if (highlighted[k] === 'done') keep[k] = 'done'; }
      highlighted = keep;

      if (stepIdx < steps.length) {
        const step = steps[stepIdx++];
        applyStep(step);
        if (step.t === 'cmp')    { highlighted[step.i] = 'cmp';   highlighted[step.j] = 'cmp'; }
        if (step.t === 'swp')    { highlighted[step.i] = 'swp';   highlighted[step.j] = 'swp'; }
        if (step.t === 'put')    { highlighted[step.i] = 'swp'; }
        if (step.t === 'pivot')  { highlighted[step.i] = 'pivot'; }
        if (step.t === 'done')   { highlighted[step.i] = 'done'; }
      } else {
        phase = 'done';
        highlighted = {};
        for (let i = 0; i < NUM_BARS; i++) highlighted[i] = 'done';
        const nextIdx = (ALGO_ORDER.indexOf(algoName) + 1) % ALGO_ORDER.length;
        setTimeout(() => startSort(ALGO_ORDER[nextIdx]), 1400);
        break;
      }
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

// ── Audio unlock overlay ──────────────────────────────────────
(function(){
  const ov = document.createElement('div');
  ov.id = 'audioOverlay';
  ov.style.cssText = [
    'position:fixed','top:0','left:0','width:100%','height:100%',
    'display:flex','align-items:center','justify-content:center',
    'background:rgba(0,0,0,0.55)','z-index:9999','cursor:pointer',
    'flex-direction:column','gap:16px'
  ].join(';');
  const icon = document.createElement('div');
  icon.textContent = String.fromCodePoint(0x1F50A);
  icon.style.cssText = 'font-size:64px;';
  const txt = document.createElement('div');
  txt.textContent = 'Tap to enable sound';
  txt.style.cssText = [
    'font-family:"Cormorant Garamond",serif',
    'font-weight:300','letter-spacing:0.2em',
    'color:rgba(255,255,255,0.8)','font-size:22px'
  ].join(';');
  ov.appendChild(icon); ov.appendChild(txt);
  document.body.appendChild(ov);
  function unlock() {
    try { initAudio(); } catch(e) { console.error(e); }
    ov.style.opacity = '0';
    ov.style.transition = 'opacity 0.5s';
    setTimeout(function(){ ov.remove(); }, 600);
  }
  ov.addEventListener('click', unlock);
  ov.addEventListener('touchstart', unlock);
})();

