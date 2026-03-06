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

const cx = CW / 2;
const cy = CH * 0.30;

// ── Physics ───────────────────────────────────────────────────
const G  = 9.81;
const DT = 0.025;
const STEPS_PER_FRAME = 3;
const MAX_TRAIL = 2500;

const NUM = 6;
const pendulums = [];
for (let i = 0; i < NUM; i++) {
  const s = (i - (NUM - 1) / 2) * 0.015;
  pendulums.push({
    l1: 240, l2: 200,
    m1: 14,  m2: 11,
    a1: Math.PI * 0.62 + s,
    a2: Math.PI * 0.62 + s * 1.5,
    v1: 0,   v2: 0,
    trail: [],
    hue: 180 + i * 35,
  });
}

// ── RK4 ───────────────────────────────────────────────────────
function deriv(l1, l2, m1, m2, a1, a2, v1, v2) {
  const da = a1 - a2;
  const denom1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * da));
  const dv1 = (
    -G * (2 * m1 + m2) * Math.sin(a1)
    - m2 * G * Math.sin(a1 - 2 * a2)
    - 2 * Math.sin(da) * m2 * (v2 * v2 * l2 + v1 * v1 * l1 * Math.cos(da))
  ) / denom1;
  const denom2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * da));
  const dv2 = (
    2 * Math.sin(da) * (
      v1 * v1 * l1 * (m1 + m2)
      + G * (m1 + m2) * Math.cos(a1)
      + v2 * v2 * l2 * m2 * Math.cos(da)
    )
  ) / denom2;
  return { da1: v1, da2: v2, dv1, dv2 };
}

function stepRK4(p, dt) {
  const { l1, l2, m1, m2 } = p;
  const { a1, a2, v1, v2 } = p;
  const k1 = deriv(l1, l2, m1, m2, a1, a2, v1, v2);
  const k2 = deriv(l1, l2, m1, m2, a1+.5*dt*k1.da1, a2+.5*dt*k1.da2, v1+.5*dt*k1.dv1, v2+.5*dt*k1.dv2);
  const k3 = deriv(l1, l2, m1, m2, a1+.5*dt*k2.da1, a2+.5*dt*k2.da2, v1+.5*dt*k2.dv1, v2+.5*dt*k2.dv2);
  const k4 = deriv(l1, l2, m1, m2, a1+dt*k3.da1,    a2+dt*k3.da2,    v1+dt*k3.dv1,    v2+dt*k3.dv2);
  p.a1 += dt*(k1.da1+2*k2.da1+2*k3.da1+k4.da1)/6;
  p.a2 += dt*(k1.da2+2*k2.da2+2*k3.da2+k4.da2)/6;
  p.v1 += dt*(k1.dv1+2*k2.dv1+2*k3.dv1+k4.dv1)/6;
  p.v2 += dt*(k1.dv2+2*k2.dv2+2*k3.dv2+k4.dv2)/6;
  const x1 = cx + p.l1 * Math.sin(p.a1);
  const y1 = cy + p.l1 * Math.cos(p.a1);
  const x2 = x1 + p.l2 * Math.sin(p.a2);
  const y2 = y1 + p.l2 * Math.cos(p.a2);
  p.trail.push({ x: x2, y: y2 });
  if (p.trail.length > MAX_TRAIL) p.trail.shift();
}

// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null;
let oscNode  = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 2);
  master.connect(audioCtx.destination);

  // Reverb
  const revBuf = audioCtx.createBuffer(2, audioCtx.sampleRate * 3, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = revBuf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length, 2);
  }
  const rev = audioCtx.createConvolver();
  rev.buffer = revBuf;
  rev.connect(master);

  // Resonant drone that pitch-shifts with pendulum energy
  oscNode = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  oscNode.type = 'triangle';
  oscNode.frequency.value = 110;
  oscGain.gain.value = 0.15;
  oscNode.connect(oscGain); oscGain.connect(rev);
  oscNode.start();

  // Second harmonic
  const osc2 = audioCtx.createOscillator();
  const osc2g = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 220;
  osc2g.gain.value = 0.08;
  osc2.connect(osc2g); osc2g.connect(rev);
  osc2.start();

  // Periodic resonant chime on swing peak
  function swingChime() {
    const now = audioCtx.currentTime;
    // Use highest velocity pendulum for timing feel
    const maxV = Math.max(...pendulums.map(p => Math.abs(p.v1)));
    const freq  = 330 + maxV * 15;
    const vol   = Math.min(0.1, 0.04 + maxV * 0.01);
    const osc   = audioCtx.createOscillator();
    const g     = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc.connect(g); g.connect(rev);
    osc.start(now); osc.stop(now + 1.8);
    setTimeout(swingChime, 600 + Math.random() * 1200);
  }
  setTimeout(swingChime, 800);
}
document.addEventListener('click', initAudio, { once: true });
setTimeout(() => { try { initAudio(); } catch(e) {} }, 500);

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = 'rgba(8,8,8,0.14)';
  ctx.fillRect(0, 0, CW, CH);

  // Modulate drone pitch with chaos level
  if (audioCtx && oscNode) {
    const avgV2 = pendulums.reduce((s,p) => s + Math.abs(p.v2), 0) / NUM;
    oscNode.frequency.value = 80 + avgV2 * 8;
  }

  for (const p of pendulums) {
    const x1 = cx + p.l1 * Math.sin(p.a1);
    const y1 = cy + p.l1 * Math.cos(p.a1);
    const x2 = x1 + p.l2 * Math.sin(p.a2);
    const y2 = y1 + p.l2 * Math.cos(p.a2);

    // Trail with gradient fade
    ctx.lineCap = 'round';
    if (p.trail.length > 1) {
      for (let i = 1; i < p.trail.length; i++) {
        const t = i / p.trail.length;
        ctx.strokeStyle = `hsla(${p.hue},90%,60%,${t * 0.6})`;
        ctx.lineWidth   = 0.5 + t * 2.5;
        ctx.beginPath();
        ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
        ctx.lineTo(p.trail[i].x,   p.trail[i].y);
        ctx.stroke();
      }
    }

    // Rods
    ctx.strokeStyle = `hsla(${p.hue},60%,40%,0.6)`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    // Bobs
    ctx.save();
    ctx.shadowColor = `hsl(${p.hue},100%,65%)`;
    ctx.shadowBlur  = 25;
    ctx.fillStyle   = `hsl(${p.hue},100%,75%)`;
    ctx.beginPath(); ctx.arc(x1, y1, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y2, 10, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Pivot
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  ctx.shadowBlur  = 20;
  ctx.fillStyle   = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ── Animate ───────────────────────────────────────────────────
function animate() {
  for (let s = 0; s < STEPS_PER_FRAME; s++) pendulums.forEach(p => stepRK4(p, DT));
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
