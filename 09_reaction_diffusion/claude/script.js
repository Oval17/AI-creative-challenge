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

// ── Audio ──────────────────────────────────────────────────────
let ac = null;
const overlay = document.getElementById('startOverlay');
overlay.addEventListener('click', () => {
  overlay.classList.add('hidden');
  startAudio();
});

function startAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain();
  master.gain.value = 0.12;
  master.connect(ac.destination);

  // Slow evolving organic pad
  const freqs = [55, 82.41, 110, 130.81, 164.81];
  freqs.forEach((f, i) => {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    const lfo  = ac.createOscillator();
    const lfoG = ac.createGain();
    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.value = f;
    gain.gain.value = 0.18 / (i + 1);
    lfo.frequency.value = 0.04 + i * 0.02;
    lfoG.gain.value = f * 0.015;
    lfo.connect(lfoG); lfoG.connect(osc.frequency); lfo.start();
    osc.connect(gain); gain.connect(master); osc.start();
  });

  // Slow filter sweep for evolving texture
  const noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
  const noise  = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const nGain  = ac.createGain();
  noise.buffer = noiseBuffer;
  noise.loop   = true;
  filter.type  = 'bandpass';
  filter.frequency.value = 200;
  filter.frequency.linearRampToValueAtTime(800, ac.currentTime + 20);
  filter.Q.value = 8;
  nGain.gain.value = 0.03;
  noise.connect(filter); filter.connect(nGain); nGain.connect(master);
  noise.start();
}

// ── Gray-Scott simulation ──────────────────────────────────────
// Grid at 2x pixel density for detail
const SCALE = 2;
const GW = Math.floor(CW / SCALE);
const GH = Math.floor(CH / SCALE);
const N  = GW * GH;

let A  = new Float32Array(N);
let B  = new Float32Array(N);
let nA = new Float32Array(N);
let nB = new Float32Array(N);

// "coral" preset — well known to produce beautiful organic blobs
const DA = 1.0, DB = 0.5;
const F  = 0.055, K = 0.062;

function init() {
  for (let i = 0; i < N; i++) { A[i] = 1; B[i] = 0; }

  // Drop MANY seeds — whole canvas covered quickly
  const seeds = 60;
  for (let s = 0; s < seeds; s++) {
    const cx = 5 + Math.floor(Math.random() * (GW - 10));
    const cy = 5 + Math.floor(Math.random() * (GH - 10));
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const r = cy + dy, c = cx + dx;
        if (r >= 0 && r < GH && c >= 0 && c < GW) {
          const i = r * GW + c;
          A[i] = 0.5 + (Math.random() - 0.5) * 0.1;
          B[i] = 0.25 + (Math.random() - 0.5) * 0.1;
        }
      }
    }
  }
}

// Fast Laplacian with pre-multiplied weights
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
      // 9-point weighted Laplacian (smoother, more organic)
      const lA =
        0.05*(A[yn+xw]+A[yn+xe]+A[ys+xw]+A[ys+xe]) +
        0.20*(A[yn+x]+A[ys+x]+A[yc+xw]+A[yc+xe]) -
        a;
      const lB =
        0.05*(B[yn+xw]+B[yn+xe]+B[ys+xw]+B[ys+xe]) +
        0.20*(B[yn+x]+B[ys+x]+B[yc+xw]+B[yc+xe]) -
        b;
      const ab2 = a * b * b;
      nA[i] = Math.min(1, Math.max(0, a + DA * lA - ab2 + F * (1 - a)));
      nB[i] = Math.min(1, Math.max(0, b + DB * lB + ab2 - (K + F) * b));
    }
  }
  let t; t = A; A = nA; nA = t;
      t = B; B = nB; nB = t;
}

// ── Render — vivid cycling neon ────────────────────────────────
const imgData = ctx.createImageData(CW, CH);
const buf     = imgData.data;
let   tick    = 0;

function render() {
  tick++;
  const hueOffset = tick * 0.4; // slow hue cycling

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const i  = gy * GW + gx;
      const a  = A[i], b = B[i];

      // Signal: difference between A and B, normalized
      // In react-diff patterns, background has A≈1,B≈0 and structure has A<1,B>0
      const signal = Math.max(0, Math.min(1, b * 4)); // boost B for visibility

      // Hue: 160 (teal) → 290 (purple) cycling slowly
      const hue = (hueOffset + 160 + signal * 130) % 360;
      const sat = 100;
      const lit = signal < 0.05 ? signal * 200 : 10 + signal * 65;

      // HSL → RGB inline
      const h = hue / 360, s = sat / 100, l = lit / 100;
      let r, g, bv;
      if (s === 0) { r = g = bv = l; } else {
        const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
        const hr = (p,q,t) => {
          if(t<0)t+=1; if(t>1)t-=1;
          if(t<1/6) return p+(q-p)*6*t;
          if(t<1/2) return q;
          if(t<2/3) return p+(q-p)*(2/3-t)*6;
          return p;
        };
        r = hr(p,q,h+1/3); g = hr(p,q,h); bv = hr(p,q,h-1/3);
      }

      const pr = Math.round(r*255), pg = Math.round(g*255), pb = Math.round(bv*255);

      // Fill SCALE×SCALE block
      for (let dy = 0; dy < SCALE; dy++) {
        const py = gy * SCALE + dy; if (py >= CH) continue;
        for (let dx = 0; dx < SCALE; dx++) {
          const px = gx * SCALE + dx; if (px >= CW) continue;
          const idx = (py * CW + px) * 4;
          buf[idx]   = pr; buf[idx+1] = pg; buf[idx+2] = pb; buf[idx+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ── Animation ──────────────────────────────────────────────────
// Run many steps upfront so patterns are already formed when visible
const SPF = 6; // steps per frame

function animate() {
  for (let i = 0; i < SPF; i++) step();
  render();
  requestAnimationFrame(animate);
}

init();
// Pre-warm: run 200 steps before first render so we don't show empty canvas
for (let i = 0; i < 200; i++) step();
requestAnimationFrame(animate);
