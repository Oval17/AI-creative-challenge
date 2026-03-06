/* ============================================================
   HEXAGON PATTERN GROWTH — Claude Sonnet 4.6
   Full-canvas 1080x1920 (9:16)  all UI drawn on canvas
   ============================================================ */
'use strict';

// ── Canvas setup ─────────────────────────────────────────────
const canvas = document.getElementById('hexCanvas');
const ctx    = canvas.getContext('2d');
const W = 1080, H = 1920;
canvas.width  = W;
canvas.height = H;

// ── Layout zones ─────────────────────────────────────────────
const CX = W / 2;
const CY = H / 2;

// ── Sim config ───────────────────────────────────────────────
const HEX_R        = 48;
const GAP          = 5;
const MAX_RINGS    = 9;
const RING_SEC     = 1.5;
const HOLD_SEC     = 1.2;
const FADE_SEC     = 1.0;
const SPARKLES     = 12;
const STEP_X = (HEX_R * 2 + GAP) * Math.cos(Math.PI / 6);
const STEP_Y = HEX_R * 1.5 + GAP * 0.866;

// ── State ─────────────────────────────────────────────────────
let hexagons    = [];
let particles   = [];
let phase       = 'grow';   // grow | hold | fade
let phaseTimer  = 0;
let ringTimer   = 0;
let curRing     = 1;
let gAlpha      = 1;
let hueOff      = 0;
let gAngle      = 0;
let lastTs      = null;

// ── Axial hex -> pixel ────────────────────────────────────────
function h2p(q, r) {
  return { x: CX + STEP_X * (q + r * 0.5), y: CY + STEP_Y * r };
}

// ── Ring coords ───────────────────────────────────────────────
function ringCoords(ring) {
  if (ring === 0) return [{ q: 0, r: 0 }];
  const dirs = [
    [0,1],[-1,1],[-1,0],[0,-1],[1,-1],[1,0]
  ];
  const out = [];
  let q = ring, r = -ring;
  for (let s = 0; s < 6; s++) {
    for (let i = 0; i < ring; i++) {
      out.push({ q, r });
      q += dirs[s][0]; r += dirs[s][1];
    }
  }
  return out;
}

// ── Hexagon class ─────────────────────────────────────────────
class Hexagon {
  constructor(q, r, ring) {
    this.ring  = ring;
    const p    = h2p(q, r);
    this.x     = p.x; this.y = p.y;
    this.born  = false;
    this.scale = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.tilt  = (Math.random() - 0.5) * 0.25;
  }
  update(dt) {
    if (!this.born) return;
    this.scale += (1 - this.scale) * Math.min(1, dt * 9);
  }
  draw(t) {
    if (this.scale < 0.001) return;
    const breathe = 1 + 0.045 * Math.sin(t * 1.9 + this.phase);
    const s = this.scale * breathe;
    const hue = (hueOff + this.ring * 28) % 360;
    const lit = 55 + 10 * Math.sin(t * 0.8 + this.ring * 0.5);
    const col = `hsl(${hue},95%,${lit}%)`;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt + gAngle * 0.12);
    ctx.scale(s, s);
    // outer glow
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 28;
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.globalAlpha = 0.3 * gAlpha;
    hexPath(HEX_R * 1.1); ctx.stroke();
    ctx.restore();
    // mid glow
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55 * gAlpha;
    hexPath(HEX_R); ctx.stroke();
    ctx.restore();
    // fill
    ctx.save();
    const g = ctx.createRadialGradient(0,0,0,0,0,HEX_R*0.9);
    g.addColorStop(0, `hsla(${hue},95%,${lit}%,${0.2*gAlpha})`);
    g.addColorStop(1, `hsla(${hue},95%,${lit}%,${0.04*gAlpha})`);
    ctx.fillStyle = g; ctx.globalAlpha = gAlpha;
    hexPath(HEX_R * 0.95); ctx.fill();
    ctx.restore();
    // bright edge
    ctx.save();
    ctx.strokeStyle = `hsl(${hue},100%,85%)`;
    ctx.lineWidth = 1.5; ctx.globalAlpha = 0.88 * gAlpha;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    hexPath(HEX_R * 0.95); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}

function hexPath(r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = r * Math.cos(a), py = r * Math.sin(a);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ── Particle class ────────────────────────────────────────────
class Particle {
  constructor(x, y, hue) {
    this.x = x; this.y = y; this.hue = hue;
    const spd = 70 + Math.random() * 130;
    const ang = Math.random() * Math.PI * 2;
    this.vx = Math.cos(ang) * spd;
    this.vy = Math.sin(ang) * spd;
    this.life = 0;
    this.maxLife = 0.5 + Math.random() * 0.5;
    this.sz = 2 + Math.random() * 3.5;
  }
  update(dt) {
    this.life += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= Math.pow(0.91, dt * 60);
    this.vy *= Math.pow(0.91, dt * 60);
  }
  draw() {
    const p = this.life / this.maxLife;
    if (p >= 1) return;
    ctx.save();
    ctx.globalAlpha = (1 - p) * gAlpha;
    ctx.shadowColor = `hsl(${this.hue},100%,70%)`;
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = `hsl(${this.hue},100%,82%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.sz * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  dead() { return this.life >= this.maxLife; }
}

// ── Grid helpers ──────────────────────────────────────────────
function buildGrid() {
  hexagons = [];
  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    for (const {q, r} of ringCoords(ring)) {
      hexagons.push(new Hexagon(q, r, ring));
    }
  }
}

function revealRing(ring) {
  const hue = (hueOff + ring * 28) % 360;
  let revealed = false;
  for (const h of hexagons) {
    if (h.ring === ring && !h.born) {
      h.born = true; h.scale = 0;
      revealed = true;
      for (let i = 0; i < SPARKLES; i++) {
        particles.push(new Particle(h.x, h.y, hue));
      }
    }
  }
  if (revealed) playRingChime(ring);
}

function reset() {
  buildGrid(); particles = [];
  phase = 'grow'; phaseTimer = 0; ringTimer = 0;
  curRing = 1; gAlpha = 1;
  revealRing(0);
}

// ── Draw background ───────────────────────────────────────────
function drawBg(t) {
  const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, H * 0.6);
  bg.addColorStop(0, `hsla(${(hueOff*0.25)%360},30%,6%,1)`);
  bg.addColorStop(1, '#050505');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

// ── Web Audio ─────────────────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
// Play a soft chime when a ring is revealed
const RING_NOTES = [261.63,293.66,329.63,349.23,392,440,493.88,523.25,587.33,659.25];
function playRingChime(ring) {
  ensureAudio();
  const freq = RING_NOTES[ring % RING_NOTES.length];
  const now  = audioCtx.currentTime;
  // sine oscillator
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = freq * 2; filt.Q.value = 1.5;
  osc.type = 'sine'; osc.frequency.value = freq;
  osc.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  osc.start(now); osc.stop(now + 1.8);
  // add a soft 5th harmony
  const osc2 = audioCtx.createOscillator();
  const g2   = audioCtx.createGain();
  osc2.type = 'sine'; osc2.frequency.value = freq * 1.5;
  osc2.connect(g2); g2.connect(audioCtx.destination);
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.07, now + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  osc2.start(now); osc2.stop(now + 1.4);
}

// ── Draw heading ──────────────────────────────────────────────
function drawHeading(t) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;

  // Line 1: "CLAUDE SONNET 4.6" — light weight, wide letter-spacing
  ctx.font = '300 42px "Cormorant Garamond", Garamond, "Times New Roman", serif';
  ctx.letterSpacing = '14px';
  ctx.globalAlpha = 0.70 * gAlpha;
  ctx.fillStyle   = 'rgba(255,255,255,0.7)';
  ctx.fillText('CLAUDE SONNET 4.6', CX, 100);

  // Line 2: "Hexagon Growth" — semibold, crisp white
  ctx.font = '600 88px "Cormorant Garamond", Garamond, "Times New Roman", serif';
  ctx.letterSpacing = '4px';
  ctx.globalAlpha = 1.0 * gAlpha;
  ctx.fillStyle   = '#ffffff';
  ctx.fillText('Hexagon Growth', CX, 210);

  // Thin divider rule beneath
  const lw = 480;
  const lg = ctx.createLinearGradient(CX - lw/2, 0, CX + lw/2, 0);
  lg.addColorStop(0,   'rgba(255,255,255,0)');
  lg.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  lg.addColorStop(0.7, 'rgba(255,255,255,0.5)');
  lg.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.6 * gAlpha;
  ctx.fillStyle   = lg;
  ctx.fillRect(CX - lw/2, 270, lw, 1);

  ctx.restore();
}

// ── Draw bottom label ─────────────────────────────────────────
function drawBottomLabel() {
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = '300 32px "Cormorant Garamond", Garamond, "Times New Roman", serif';
  ctx.letterSpacing = '10px';
  ctx.globalAlpha  = 0.6 * gAlpha;
  ctx.fillStyle    = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur   = 0;
  ctx.fillText('Generated by CLAUDE SONNET 4.6', CX, H - 90);
  ctx.restore();
}

// ── Animation loop ────────────────────────────────────────────
function animate(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  hueOff += 22 * dt;
  gAngle += 0.10 * dt;

  // state machine
  if (phase === 'grow') {
    ringTimer += dt;
    if (ringTimer >= RING_SEC) {
      ringTimer = 0;
      if (curRing <= MAX_RINGS) { revealRing(curRing); curRing++; }
      else { phase = 'hold'; phaseTimer = 0; }
    }
  } else if (phase === 'hold') {
    phaseTimer += dt;
    if (phaseTimer >= HOLD_SEC) { phase = 'fade'; phaseTimer = 0; }
  } else {
    phaseTimer += dt;
    gAlpha = Math.max(0, 1 - phaseTimer / FADE_SEC);
    if (phaseTimer >= FADE_SEC) reset();
  }

  for (const h of hexagons) h.update(dt);
  particles = particles.filter(p => { p.update(dt); return !p.dead(); });

  const t = ts / 1000;
  drawBg(t);
  for (const h of hexagons) h.draw(t);
  for (const p of particles) p.draw();
  drawHeading(t);
  drawBottomLabel();

  requestAnimationFrame(animate);
}

// ── Boot ──────────────────────────────────────────────────────
reset();
requestAnimationFrame(animate);



