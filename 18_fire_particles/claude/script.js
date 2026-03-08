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

// Fire is centered horizontally — base at vertical center-bottom of canvas
const FIRE_CX = CW / 2;
const FIRE_BASE_Y = CH - 80;          // base of flames
const FIRE_SPREAD = CW * 0.38;        // horizontal spread

// ── Particles ─────────────────────────────────────────────────
const MAX_PARTICLES = 2000;
const particles = [];

function spawnParticle() {
  const bx = FIRE_CX + (Math.random() - 0.5) * FIRE_SPREAD;
  const speed = 2 + Math.random() * 4.5;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  return {
    x: bx + (Math.random() - 0.5) * 14,
    y: FIRE_BASE_Y,
    vx: Math.cos(angle) * speed * 0.35,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 50 + Math.random() * 90,
    size: 7 + Math.random() * 16,
    wobble: (Math.random() - 0.5) * 0.1,
  };
}

const MAX_EMBERS = 320;
const embers = [];
function spawnEmber() {
  const bx = FIRE_CX + (Math.random() - 0.5) * FIRE_SPREAD * 0.7;
  return {
    x: bx,
    y: FIRE_BASE_Y - 20 - Math.random() * 60,
    vx: (Math.random() - 0.5) * 2.8,
    vy: -(2 + Math.random() * 4.5),
    life: 0,
    maxLife: 70 + Math.random() * 110,
    size: 1.5 + Math.random() * 2.5,
  };
}

// Pre-fill staggered
for (let i = 0; i < MAX_PARTICLES; i++) { const p = spawnParticle(); p.life = Math.random() * p.maxLife; particles.push(p); }
for (let i = 0; i < MAX_EMBERS;   i++) { const e = spawnEmber();    e.life = Math.random() * e.maxLife;   embers.push(e); }

// ── Color ramp ────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function fireColor(t, alpha) {
  if (t < 0.2) {
    return `rgba(255,${Math.floor(lerp(255,200,t/0.2))},${Math.floor(lerp(220,60,t/0.2))},${alpha})`;
  } else if (t < 0.5) {
    return `rgba(255,${Math.floor(lerp(200,70,(t-.2)/.3))},0,${alpha})`;
  } else if (t < 0.8) {
    return `rgba(${Math.floor(lerp(255,130,(t-.5)/.3))},0,0,${alpha})`;
  } else {
    const tt = (t-.8)/.2;
    return `rgba(${Math.floor(lerp(130,20,tt))},0,0,${alpha*(1-tt)})`;
  }
}

// ── Audio ─────────────────────────────────────────────────────
let audioCtx  = null;
let noiseNode = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.92, audioCtx.currentTime + 2.5);
    const _comp=audioCtx.createDynamicsCompressor();_comp.threshold.value=-12;_comp.knee.value=8;_comp.ratio.value=6;_comp.attack.value=0.003;_comp.release.value=0.12;
master.connect(_comp);
  _comp.connect(audioCtx.destination);

  // Fire crackle = filtered noise
  const bufLen = audioCtx.sampleRate * 2;
  const noiseBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) nd[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;

  // Low-pass for the roar, band-pass for crackling
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 1.5;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5;

  const lpGain = audioCtx.createGain(); lpGain.gain.value = 0.920;
  const bpGain = audioCtx.createGain(); bpGain.gain.value = 0.700;

  noise.connect(lp); lp.connect(lpGain); lpGain.connect(master);
  noise.connect(bp); bp.connect(bpGain); bpGain.connect(master);
  noise.start();
  noiseNode = noise;

  // LFO flicker on the low-pass frequency (fire flutter)
  const lfo = audioCtx.createOscillator();
  const lfog = audioCtx.createGain();
  lfo.frequency.value = 5 + Math.random() * 4;
  lfog.gain.value = 150;
  lfo.connect(lfog); lfog.connect(lp.frequency);
  lfo.start();

  // Occasional crackle pops
  function crackle() {
    const now = audioCtx.currentTime;
    const b   = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
    const d   = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length, 3)*0.8;
    const s = audioCtx.createBufferSource();
    s.buffer = b;
    const g = audioCtx.createGain(); g.gain.value = 0.850;
    s.connect(g); g.connect(master);
    s.start(now);
    setTimeout(crackle, 80 + Math.random() * 320);
  }
  setTimeout(crackle, 200);
}
document.addEventListener('click', initAudio, { once: true });
setTimeout(() => { try { initAudio(); } catch(e) {} }, 500);

// ── Update ────────────────────────────────────────────────────
function update() {
  for (const p of particles) {
    p.life++;
    p.x += p.vx + Math.sin(p.life * 0.14 + p.wobble * 18) * 1.3;
    p.y += p.vy;
    p.vy *= 0.986;
    p.vx *= 0.98;
    if (p.life >= p.maxLife) Object.assign(p, spawnParticle());
  }
  for (const e of embers) {
    e.life++;
    e.x += e.vx + (Math.random() - 0.5) * 0.9;
    e.y += e.vy;
    e.vy *= 0.993;
    e.vx *= 0.996;
    if (e.life >= e.maxLife) Object.assign(e, spawnEmber());
  }
}

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = 'rgba(5,5,5,0.32)';
  ctx.fillRect(0, 0, CW, CH);

  ctx.globalCompositeOperation = 'lighter';

  for (const p of particles) {
    const t = p.life / p.maxLife;
    const alpha = t < 0.85 ? 0.5 : 0.5 * (1-(t-0.85)/0.15);
    const r = p.size * (1 - t * 0.45);
    if (r < 0.5) continue;
    const col = fireColor(t, alpha);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
  }

  for (const e of embers) {
    const t = e.life / e.maxLife;
    const alpha = t < 0.7 ? 0.95 : 0.95 * (1-(t-0.7)/0.3);
    ctx.fillStyle = `rgba(255,${Math.floor(lerp(220,60,t))},0,${alpha})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.size*(1-t*0.4), 0, Math.PI*2); ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';

  // Ground heat glow — centered
  const glow = ctx.createRadialGradient(FIRE_CX, FIRE_BASE_Y, 0, FIRE_CX, FIRE_BASE_Y, FIRE_SPREAD * 0.8);
  glow.addColorStop(0, 'rgba(255,60,0,0.22)');
  glow.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, FIRE_BASE_Y - 80, CW, 160);
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  update();
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);



