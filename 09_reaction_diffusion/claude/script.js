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

// ── Auto Audio ─────────────────────────────────────────────────
let ac = null;
function startAudio() {
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    buildAudio();
  } catch(e) {}
}
function buildAudio() {
  const master = ac.createGain();
  master.gain.value = 0.10;
  master.connect(ac.destination);

  // Deep organic pad — evolving slow harmonics
  [55, 82.4, 110, 164.8].forEach((f, i) => {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    const lfo  = ac.createOscillator();
    const lfoG = ac.createGain();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = f;
    gain.gain.value = 0.20 / (i + 1);
    lfo.frequency.value = 0.03 + i * 0.02;
    lfoG.gain.value = f * 0.018;
    lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
    osc.connect(gain); gain.connect(master); osc.start();
  });

  // Filtered noise texture — slow organic sweep
  const buf  = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise  = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const nGain  = ac.createGain();
  noise.buffer = buf; noise.loop = true;
  filter.type = 'bandpass'; filter.frequency.value = 150; filter.Q.value = 6;
  nGain.gain.value = 0.025;
  noise.connect(filter); filter.connect(nGain); nGain.connect(master);
  noise.start();
}
startAudio();
document.addEventListener('click', () => {
  if (!ac) startAudio();
  else if (ac.state === 'suspended') ac.resume();
}, { once: false });

// ── Gray-Scott simulation ──────────────────────────────────────
const SCALE = 2;
const GW = Math.floor(CW / SCALE);
const GH = Math.floor(CH / SCALE);
const N  = GW * GH;

let A  = new Float32Array(N);
let B  = new Float32Array(N);
let nA = new Float32Array(N);
let nB = new Float32Array(N);

// "coral" / "worms" blended preset
const DA = 1.0, DB = 0.5;
const F  = 0.055, K = 0.062;

function init() {
  for (let i = 0; i < N; i++) { A[i] = 1; B[i] = 0; }
  // Many seeds spread across canvas
  for (let s = 0; s < 80; s++) {
    const cx = 4 + Math.floor(Math.random() * (GW - 8));
    const cy = 4 + Math.floor(Math.random() * (GH - 8));
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const r = cy + dy, c = cx + dx;
        if (r >= 0 && r < GH && c >= 0 && c < GW) {
          const i = r * GW + c;
          A[i] = 0.5; B[i] = 0.25 + Math.random() * 0.1;
        }
      }
    }
  }
}

function step() {
  for (let y = 0; y < GH; y++) {
    const yn = ((y - 1 + GH) % GH) * GW;
    const ys = ((y + 1) % GH) * GW;
    const yc = y * GW;
    for (let x = 0; x < GW; x++) {
      const xw = (x - 1 + GW) % GW;
      const xe = (x + 1) % GW;
      const i  = yc + x;
      const a  = A[i], b = B[i];
      const lA =
        0.05*(A[yn+xw]+A[yn+xe]+A[ys+xw]+A[ys+xe]) +
        0.20*(A[yn+x]+A[ys+x]+A[yc+xw]+A[yc+xe]) - a;
      const lB =
        0.05*(B[yn+xw]+B[yn+xe]+B[ys+xw]+B[ys+xe]) +
        0.20*(B[yn+x]+B[ys+x]+B[yc+xw]+B[yc+xe]) - b;
      const ab2 = a * b * b;
      nA[i] = Math.min(1, Math.max(0, a + DA*lA - ab2 + F*(1-a)));
      nB[i] = Math.min(1, Math.max(0, b + DB*lB + ab2 - (K+F)*b));
    }
  }
  let t; t = A; A = nA; nA = t; t = B; B = nB; nB = t;
}

// ── Palette — 3 distinct phases of the cycle ───────────────────
// Phase 0 (0-7s):   Cyan/Teal on black — pattern growing
// Phase 1 (7-14s):  Purple/Magenta — mature patterns
// Phase 2 (14-20s): Orange/Gold — fading before reset
// We cycle through by modulating hue over time

const imgData = ctx.createImageData(CW, CH);
const buf2    = imgData.data;
let   tick    = 0;
// Canvas-level fade for smooth reset transitions
let   canvasAlpha = 1.0;
let   fading  = false;

// Each 20s cycle = 20*60 = 1200 frames at 60fps
const CYCLE_FRAMES = 1200;

function getHueBase() {
  const t = (tick % CYCLE_FRAMES) / CYCLE_FRAMES; // 0→1 per cycle
  // Hue arc: 180 (cyan) → 270 (purple) → 30 (orange) → 180 (cyan)
  if (t < 0.4)  return 180 + (t / 0.4) * 90;       // cyan→purple
  if (t < 0.75) return 270 + ((t-0.4)/0.35) * 90;  // purple→orange (wrap)
  return (360 + ((t-0.75)/0.25) * 180) % 360;       // orange→cyan
}

function render() {
  tick++;
  const cyclePos = tick % CYCLE_FRAMES;
  const hueBase  = getHueBase();

  // Canvas alpha for smooth fade in/out at cycle boundaries
  const FADE_FRAMES = 60; // 1 second fade
  if (cyclePos < FADE_FRAMES) {
    canvasAlpha = cyclePos / FADE_FRAMES;
  } else if (cyclePos > CYCLE_FRAMES - FADE_FRAMES) {
    canvasAlpha = (CYCLE_FRAMES - cyclePos) / FADE_FRAMES;
  } else {
    canvasAlpha = 1.0;
  }

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx;
      const signal = Math.max(0, Math.min(1, B[i] * 4));

      // Map signal → hue offset → vivid color
      const hue = (hueBase + signal * 60) % 360;
      const sat = 100;
      const lit = signal < 0.04 ? signal * 250 : 8 + signal * 68;

      const h = hue/360, s = sat/100, l = lit/100;
      let r, g, bv;
      if (s === 0) { r = g = bv = l; } else {
        const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
        const hf = (p,q,t) => {
          if(t<0)t+=1; if(t>1)t-=1;
          if(t<1/6) return p+(q-p)*6*t;
          if(t<0.5) return q;
          if(t<2/3) return p+(q-p)*(2/3-t)*6;
          return p;
        };
        r=hf(p,q,h+1/3); g=hf(p,q,h); bv=hf(p,q,h-1/3);
      }
      const pr = Math.round(r*255*canvasAlpha);
      const pg = Math.round(g*255*canvasAlpha);
      const pb = Math.round(bv*255*canvasAlpha);

      for (let dy = 0; dy < SCALE; dy++) {
        const py = gy*SCALE+dy; if(py>=CH) continue;
        for (let dx = 0; dx < SCALE; dx++) {
          const px = gx*SCALE+dx; if(px>=CW) continue;
          const idx = (py*CW+px)*4;
          buf2[idx]=pr; buf2[idx+1]=pg; buf2[idx+2]=pb; buf2[idx+3]=255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Animation ──────────────────────────────────────────────────
const SPF = 6;

function animate() {
  // At cycle boundary: re-init with new random seeds
  if (tick % CYCLE_FRAMES === 0) {
    init();
    // Pre-warm new seeds so they're visible immediately
    for (let i = 0; i < 150; i++) step();
  }

  for (let i = 0; i < SPF; i++) step();
  render();
  requestAnimationFrame(animate);
}

// Initial setup
init();
for (let i = 0; i < 200; i++) step();
requestAnimationFrame(animate);



