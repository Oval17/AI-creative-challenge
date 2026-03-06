'use strict';

// ── Scale wrapper to viewport ────────────────────────────────
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

// ── Canvas setup — render at half res, scale up 2x for speed ─
const canvas = document.getElementById('fractalCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 1080;
canvas.height = 1350;
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// Offscreen low-res buffer (540×675 = 1/4 pixels)
const RES = 2; // divisor
const BW = Math.floor(1080 / RES);
const BH = Math.floor(1350 / RES);
const offscreen = new OffscreenCanvas(BW, BH);
const octx = offscreen.getContext('2d');
const imgData = octx.createImageData(BW, BH);
const pixels  = imgData.data;

// ── Zoom target — Seahorse Valley ────────────────────────────
const TARGET_RE = -0.7436447860;
const TARGET_IM =  0.1318252536;

// ── State ────────────────────────────────────────────────────
let zoom      = 1.0;
const ZOOM_SPEED = 1.018;   // faster: ~1.8% per frame
const MAX_ZOOM   = 5e9;
const MAX_ITER   = 180;     // reduced for speed

// ── Mandelbrot with smooth escape ────────────────────────────
function mandelbrot(cx, cy) {
  let zx = 0, zy = 0;
  for (let i = 0; i < MAX_ITER; i++) {
    const zx2 = zx * zx, zy2 = zy * zy;
    if (zx2 + zy2 > 4) {
      const log2 = Math.log2(zx2 + zy2);
      return i + 1 - Math.log2(log2 * 0.5);
    }
    zy = 2 * zx * zy + cy;
    zx = zx2 - zy2 + cx;
  }
  return -1;
}

// ── Cosmic palette lookup table (1024 entries, pre-computed) ──
const LUT_SIZE = 1024;
const LUT = new Uint8Array(LUT_SIZE * 3);
(function buildLUT() {
  const stops = [
    [  2,   2,  25],
    [ 20,   0, 100],
    [  0,  80, 200],
    [  0, 220, 200],
    [255, 180,  30],
    [255, 240, 120],
    [255, 255, 255],
  ];
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    const scaled = t * (stops.length - 1);
    const i0 = Math.floor(scaled);
    const i1 = Math.min(i0 + 1, stops.length - 1);
    const f  = scaled - i0;
    const a = stops[i0], b = stops[i1];
    LUT[i * 3]     = a[0] + (b[0] - a[0]) * f;
    LUT[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    LUT[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  }
})();

function lutColor(smooth) {
  const t = (smooth % 48) / 48;
  const idx = Math.floor((Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * (LUT_SIZE - 1));
  return idx * 3;
}

// ── Render one frame ─────────────────────────────────────────
function render() {
  const scale   = 3.5 / zoom;
  const aspect  = BW / BH;
  const reRange = scale * aspect;
  const imRange = scale;
  const reMin   = TARGET_RE - reRange * 0.5;
  const imMin   = TARGET_IM - imRange * 0.5;
  const reStep  = reRange / BW;
  const imStep  = imRange / BH;

  let idx = 0;
  for (let py = 0; py < BH; py++) {
    const im = imMin + py * imStep;
    for (let px = 0; px < BW; px++) {
      const smooth = mandelbrot(reMin + px * reStep, im);
      if (smooth < 0) {
        pixels[idx] = pixels[idx+1] = pixels[idx+2] = 0;
      } else {
        const li = lutColor(smooth);
        const bright = Math.min(1, smooth / 12);
        pixels[idx]     = LUT[li]     * bright;
        pixels[idx + 1] = LUT[li + 1] * bright;
        pixels[idx + 2] = LUT[li + 2] * bright;
      }
      pixels[idx + 3] = 255;
      idx += 4;
    }
  }
  octx.putImageData(imgData, 0, 0);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

// ── Web Audio — cosmic ambient drone + shimmer ────────────────
let audioCtx = null, audioStarted = false;

function initAudio() {
  if (audioStarted) return;
  audioStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const t = audioCtx.currentTime;

  // Master gain (fade in)
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(0.5, t + 3);
  master.connect(audioCtx.destination);

  // Sub drone – 55Hz sine
  const sub = audioCtx.createOscillator();
  sub.type = 'sine'; sub.frequency.value = 55;
  const subGain = audioCtx.createGain(); subGain.gain.value = 0.3;
  sub.connect(subGain); subGain.connect(master); sub.start();

  // Mid drone – 110Hz triangle, slightly detuned
  const mid = audioCtx.createOscillator();
  mid.type = 'triangle'; mid.frequency.value = 110.15;
  const midGain = audioCtx.createGain(); midGain.gain.value = 0.2;
  mid.connect(midGain); midGain.connect(master); mid.start();

  // High shimmer – 440Hz sine, tremolo LFO
  const high = audioCtx.createOscillator();
  high.type = 'sine'; high.frequency.value = 440;
  const tremolo = audioCtx.createGain(); tremolo.gain.value = 0.05;
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.25;
  const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain); lfoGain.connect(tremolo.gain);
  high.connect(tremolo); tremolo.connect(master); high.start(); lfo.start();

  // Space wind – bandpass filtered noise
  const bufLen = audioCtx.sampleRate * 3;
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.3;
  const windGain = audioCtx.createGain(); windGain.gain.value = 0.06;
  src.connect(bp); bp.connect(windGain); windGain.connect(master); src.start();

  // Slow LFO on wind filter frequency (0.05Hz sweep 200-600Hz)
  const wLFO = audioCtx.createOscillator();
  const wLFOGain = audioCtx.createGain(); wLFOGain.gain.value = 200;
  wLFO.frequency.value = 0.05;
  wLFO.connect(wLFOGain); wLFOGain.connect(bp.frequency); wLFO.start();
}

// Auto-start audio — try immediately, then on first interaction
function startAudio() {
  initAudio();
  if (audioCtx) audioCtx.resume().catch(() => {});
}
// Try immediately (works when opened via file:// in most browsers)
startAudio();
// Fallback: also trigger on first any interaction (click, key, touch)
['click','keydown','touchstart','pointerdown'].forEach(ev =>
  document.addEventListener(ev, startAudio, { once: true, passive: true })
);

// ── Animation loop ───────────────────────────────────────────
function animate() {
  render();
  zoom *= ZOOM_SPEED;
  if (zoom > MAX_ZOOM) zoom = 1.0;
  requestAnimationFrame(animate);
}

render();
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

