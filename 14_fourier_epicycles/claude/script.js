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

// ── Shape definitions ─────────────────────────────────────────
function sampleShape(shapeFn, N) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const [x, y] = shapeFn(t);
    pts.push({ re: x, im: y });
  }
  return pts;
}

const SHAPES = [
  // Heart
  t => {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
    return [x * 22, y * 22];
  },
  // 8-pointed star
  t => {
    const r = 1 + 0.5 * Math.cos(8 * t);
    return [r * 340 * Math.cos(t), r * 340 * Math.sin(t)];
  },
  // Lissajous 3:2
  t => [380 * Math.sin(3*t + Math.PI/4), 380 * Math.sin(2*t)],
  // Epitrochoid (spirograph)
  t => {
    const R = 5, r = 3, d = 5;
    return [
      ((R+r)*Math.cos(t) - d*Math.cos((R+r)/r*t)) * 38,
      ((R+r)*Math.sin(t) - d*Math.sin((R+r)/r*t)) * 38
    ];
  },
  // Rose curve (5 petals)
  t => {
    const r = Math.cos(5 * t);
    return [r * 440 * Math.cos(t), r * 440 * Math.sin(t)];
  },
];

// ── DFT ──────────────────────────────────────────────────────
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
    result.push({ freq: k, amp, phase });
  }
  result.sort((a, b) => b.amp - a.amp);
  return result;
}

// ── Audio system ──────────────────────────────────────────────
let ac = null;
let acMaster = null;
// Pentatonic scale base freqs (A minor pentatonic: A C D E G)
const PENTATONIC = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];

function initAudio() {
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    acMaster = ac.createGain();
    acMaster.gain.value = 0.13;
    acMaster.connect(ac.destination);

    // Reverb convolver for lush sound
    const convLen = ac.sampleRate * 2.5;
    const convBuf = ac.createBuffer(2, convLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = convBuf.getChannelData(ch);
      for (let i = 0; i < convLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/convLen, 2.5);
    }
    const convolver = ac.createConvolver();
    convolver.buffer = convBuf;
    const convGain = ac.createGain();
    convGain.gain.value = 0.45;
    convolver.connect(convGain);
    convGain.connect(acMaster);

    // Store convolver for later use
    ac._conv = convolver;
    ac._dry  = acMaster;

    document.addEventListener('click', () => { if (ac && ac.state === 'suspended') ac.resume(); });
  } catch(e) {}
}

// Play a musical note from the pentatonic scale
function playNote(freqIdx, duration, volume) {
  if (!ac || !acMaster) return;
  if (ac.state === 'suspended') ac.resume();
  try {
    const freq = PENTATONIC[freqIdx % PENTATONIC.length];
    const osc  = ac.createOscillator();
    const env  = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const now = ac.currentTime;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.04);
    env.gain.exponentialRampToValueAtTime(volume * 0.4, now + duration * 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(acMaster);
    if (ac._conv) env.connect(ac._conv);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  } catch(e) {}
}

// Continuous ambient pad — runs forever
function startAmbientPad(shapeIndex) {
  if (!ac || !acMaster) return;
  if (ac.state === 'suspended') ac.resume();
  // Base chord depends on shape
  const bases = [220, 246.9, 261.6, 293.7, 329.6];
  const base  = bases[shapeIndex % bases.length];
  // Soft chord: root + fifth + octave
  [base, base*1.5, base*2].forEach((f, i) => {
    try {
      const osc  = ac.createOscillator();
      const env  = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = f + Math.random() * 0.4;
      env.gain.value = 0.04 / (i + 1);
      osc.connect(env);
      env.connect(acMaster);
      if (ac._conv) env.connect(ac._conv);
      osc.start();
      // Fade out after shape duration (~N_SAMPLES frames + hold + fade)
      const dur = (N_SAMPLES + HOLD_F + FADE_F) / 60 + 1;
      env.gain.setTargetAtTime(0, ac.currentTime + dur, 0.5);
      osc.stop(ac.currentTime + dur + 2);
    } catch(e) {}
  });
}

// Musical notes triggered while tracing
let noteTimer = 0;
let noteStep  = 0;
function maybeTriggerNote() {
  noteTimer++;
  if (noteTimer < 12) return;  // every ~12 frames = ~5 notes/sec
  noteTimer = 0;
  playNote(noteStep, 0.35, 0.10);
  noteStep = (noteStep + 1) % PENTATONIC.length;
}

initAudio();

// ── State ─────────────────────────────────────────────────────
const N_SAMPLES = 256;
const N_CIRCLES = 128;   // increased from 64 → 128

let freqs     = [];
let path      = [];
let time      = 0;
let shapeIdx  = 0;
let phase2    = 'trace';
let holdTimer = 0;
let gAlpha    = 1;
noteStep = 0; noteTimer = 0;

const SPEED  = (2 * Math.PI) / N_SAMPLES;
const HOLD_F = 90;
const FADE_F = 50;

function loadShape(idx) {
  const pts = sampleShape(SHAPES[idx % SHAPES.length], N_SAMPLES);
  freqs     = dft(pts).slice(0, N_CIRCLES);
  path      = [];
  time      = 0;
  phase2    = 'trace';
  holdTimer = 0;
  gAlpha    = 1;
  noteStep  = 0;
  noteTimer = 0;
  startAmbientPad(idx);
}

loadShape(0);

// ── Epicycle computation ──────────────────────────────────────
function computeEpicycles(t) {
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

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = gAlpha;

  const { circles, tipX, tipY } = computeEpicycles(time);

  // Draw circles in two passes: small ones first (behind), big ones on top
  for (let i = circles.length - 1; i >= 0; i--) {
    const c = circles[i];
    if (c.r < 1.0) continue;
    const t = i / circles.length;
    const hue = 185 + t * 140;  // cyan → purple → magenta
    const alpha = 0.06 + (1 - t) * 0.15;

    ctx.save();
    // Circle ring
    ctx.strokeStyle = `hsla(${hue},85%,65%,${alpha})`;
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();

    // Arm
    ctx.strokeStyle = `hsla(${hue},100%,75%,${Math.min(1, alpha * 3)})`;
    ctx.lineWidth   = 0.9;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.tipX, c.tipY);
    ctx.stroke();
    ctx.restore();
  }

  // Traced path with gradient
  if (path.length > 1) {
    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < path.length; i++) {
      const t   = i / path.length;
      const hue = 170 + t * 90;   // teal → violet
      ctx.strokeStyle = `hsla(${hue},100%,68%,${0.25 + t * 0.75})`;
      ctx.lineWidth   = 1.2 + t * 2.2;
      ctx.beginPath();
      ctx.moveTo(path[i-1].x, path[i-1].y);
      ctx.lineTo(path[i].x,   path[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Glowing tip
  ctx.save();
  ctx.shadowColor = '#00ffee';
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
}

// ── Animation ─────────────────────────────────────────────────
function animate() {
  if (phase2 === 'trace') {
    const { tipX, tipY } = computeEpicycles(time);
    path.push({ x: tipX, y: tipY });
    time += SPEED;
    maybeTriggerNote();
    if (path.length >= N_SAMPLES) { phase2 = 'hold'; holdTimer = 0; }
  } else if (phase2 === 'hold') {
    time += SPEED;
    holdTimer++;
    if (holdTimer >= HOLD_F) { phase2 = 'fade'; holdTimer = 0; }
  } else if (phase2 === 'fade') {
    time += SPEED;
    holdTimer++;
    gAlpha = 1 - holdTimer / FADE_F;
    if (holdTimer >= FADE_F) { shapeIdx++; loadShape(shapeIdx); }
  }

  render();
  requestAnimationFrame(animate);
}

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

