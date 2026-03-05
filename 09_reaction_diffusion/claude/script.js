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

// ── Audio ─────────────────────────────────────────────────────
let ac = null;
async function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  await ac.resume();
  startAmbient();
}
['click','keydown','touchstart','pointerdown'].forEach(e =>
  document.addEventListener(e, initAudio, { once: true, passive: true })
);
setTimeout(() => initAudio(), 300);

function startAmbient() {
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0.10;
  master.connect(ac.destination);

  // Deep evolving pad: 4 detuned sines + slow modulation
  const baseFreqs = [55, 82.5, 110, 165, 220];
  baseFreqs.forEach((f, i) => {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.value = 0.2 / (i + 1);

    // Slow vibrato
    const vib     = ac.createOscillator();
    const vibGain = ac.createGain();
    vib.frequency.value = 0.05 + i * 0.03;
    vibGain.gain.value  = f * 0.008;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    vib.start();

    osc.connect(gain); gain.connect(master);
    osc.start();
  });

  // Slow bubbling texture: random plucks every 1.5-4s
  function bubble() {
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 200 + Math.random() * 600;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.06, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(env); env.connect(master);
    osc.start(now); osc.stop(now + 1.3);
    setTimeout(bubble, 1500 + Math.random() * 2500);
  }
  bubble();
}

// ── Gray-Scott grid ───────────────────────────────────────────
// Use SCALE=3 for sharper, more detailed patterns
const SCALE = 3;
const GW = Math.floor(CW / SCALE);
const GH = Math.floor(CH / SCALE);
const N  = GW * GH;

let A  = new Float32Array(N);
let B  = new Float32Array(N);
let nA = new Float32Array(N);
let nB = new Float32Array(N);

// Parameters — "worms" preset: striking neon tentacle patterns
const dA = 1.0;
const dB = 0.5;
const f  = 0.054;
const k  = 0.063;

function init() {
  for (let i = 0; i < N; i++) { A[i] = 1; B[i] = 0; }
  // Seed a central ring + scattered patches
  const cx = Math.floor(GW / 2), cy = Math.floor(GH / 2);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist >= 5 && dist <= 8) {
        const r = cy+dy, c = cx+dx;
        if (r>=0&&r<GH&&c>=0&&c<GW) { A[r*GW+c]=0.5; B[r*GW+c]=0.25; }
      }
    }
  }
  // More scattered seeds
  for (let s = 0; s < 30; s++) {
    const sc = 4 + Math.floor(Math.random()*(GW-8));
    const sr = 4 + Math.floor(Math.random()*(GH-8));
    for (let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
      const r=sr+dy, c=sc+dx;
      if(r>=0&&r<GH&&c>=0&&c<GW){A[r*GW+c]=0.5+Math.random()*0.1;B[r*GW+c]=0.25+Math.random()*0.1;}
    }
  }
}

// ── Optimised step (inline Laplacian) ─────────────────────────
const DT = 1.0;
function step() {
  for (let y = 0; y < GH; y++) {
    const yn = ((y - 1 + GH) % GH) * GW;
    const ys = ((y + 1) % GH) * GW;
    const yc = y * GW;
    for (let x = 0; x < GW; x++) {
      const xw = (x - 1 + GW) % GW;
      const xe = (x + 1) % GW;
      const i = yc + x;
      const a = A[i], b = B[i];
      const la = A[yn+x] + A[ys+x] + A[yc+xw] + A[yc+xe] - 4*a;
      const lb = B[yn+x] + B[ys+x] + B[yc+xw] + B[yc+xe] - 4*b;
      const ab2 = a * b * b;
      nA[i] = Math.max(0, Math.min(1, a + DT*(dA*la - ab2 + f*(1-a))));
      nB[i] = Math.max(0, Math.min(1, b + DT*(dB*lb + ab2 - (k+f)*b)));
    }
  }
  const tA=A; A=nA; nA=tA;
  const tB=B; B=nB; nB=tB;
}

// ── Render — vivid neon palette ───────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;

// Use (A - B) as the signal: ranges from -1 to 1, centred at ~1 where no B
// Where B is high (pattern), A-B is low → map to vivid neon
// Where B=0 (background), A≈1, A-B≈1 → dark background
function neonColor(a, b) {
  // t=0 means pattern (B high), t=1 means background (B low)
  const t = Math.min(1, Math.max(0, a - b));  // 0=pattern,1=background
  const p = 1 - t; // p=1 = full pattern, p=0 = background

  // Gamma boost for contrast
  const p2 = Math.pow(p, 0.7);

  // Vibrant neon: dark bg → deep purple → hot magenta → cyan → white
  let r, g, bv;
  if (p2 < 0.25) {
    const s = p2 / 0.25;
    r = Math.round(s * 120);   g = 0;               bv = Math.round(s * 80);
  } else if (p2 < 0.5) {
    const s = (p2 - 0.25) / 0.25;
    r = Math.round(120 + s * 135); g = 0;            bv = Math.round(80 + s * 175);
  } else if (p2 < 0.75) {
    const s = (p2 - 0.5) / 0.25;
    r = Math.round(255 - s * 255); g = Math.round(s * 255); bv = 255;
  } else {
    const s = (p2 - 0.75) / 0.25;
    r = 0;  g = 255; bv = Math.round(255 - s * 55);
  }
  return [r, g, bv];
}

function render() {
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx;
      const [r, g, bv] = neonColor(A[i], B[i]);
      const pyBase = gy * SCALE, pxBase = gx * SCALE;
      for (let dy = 0; dy < SCALE; dy++) {
        const py = pyBase + dy; if (py >= CH) continue;
        for (let dx = 0; dx < SCALE; dx++) {
          const px = pxBase + dx; if (px >= CW) continue;
          const idx = (py * CW + px) * 4;
          buf[idx]   = r; buf[idx+1] = g; buf[idx+2] = bv; buf[idx+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Animation ─────────────────────────────────────────────────
const SPF = 10; // steps per frame — faster evolution
function animate() {
  for (let i = 0; i < SPF; i++) step();
  render();
  requestAnimationFrame(animate);
}

init();
requestAnimationFrame(animate);
