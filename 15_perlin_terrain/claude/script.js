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

// ── Perlin noise ──────────────────────────────────────────────
const perm = new Uint8Array(512);
function shufflePerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
shufflePerm();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X]+Y, AA = perm[A]+Z, AB = perm[A+1]+Z;
  const B = perm[X+1]+Y, BA = perm[B]+Z, BB = perm[B+1]+Z;
  return lerp(
    lerp(lerp(grad(perm[AA],x,y,z),   grad(perm[BA],x-1,y,z),   u),
         lerp(grad(perm[AB],x,y-1,z), grad(perm[BB],x-1,y-1,z), u), v),
    lerp(lerp(grad(perm[AA+1],x,y,z-1),   grad(perm[BA+1],x-1,y,z-1),   u),
         lerp(grad(perm[AB+1],x,y-1,z-1), grad(perm[BB+1],x-1,y-1,z-1), u), v), w);
}
function octaveNoise(x, y, z, octs, persist, lacun) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octs; i++) {
    val += noise(x*freq, y*freq, z*freq) * amp;
    max  += amp; amp *= persist; freq *= lacun;
  }
  return val / max;
}

// ── Terrain config ─────────────────────────────────────────────
const GRID_W = 40;
const GRID_H = 32;
const CELL   = 24;
const HEIGHT_SCALE = 180;

function project(wx, wy, wz) {
  const angle = Math.PI / 6;
  const sx = (wx - wz) * Math.cos(angle);
  const sy = (wx + wz) * Math.sin(angle) - wy;
  return { sx, sy };
}

// ── State ──────────────────────────────────────────────────────
let zOffset      = 0;
let terrainAlpha = 1;
let terrainPhase = 'scroll'; // 'scroll' | 'fadeout' | 'fadein'
let phaseTimer   = 0;
const SCROLL_SPEED   = 0.006;
const REGEN_INTERVAL = 400;  // frames between terrain regenerations
const FADE_FRAMES    = 40;
let frameCount = 0;

function getHeight(gx, gz) {
  const nx = gx / GRID_W * 2.5;
  const nz = gz / GRID_H * 2.5;
  return octaveNoise(nx, nz, zOffset, 5, 0.5, 2.0) * HEIGHT_SCALE;
}

function heightColor(h, maxH) {
  const t = (h + maxH) / (2 * maxH);
  if (t < 0.3) {
    const tt = t / 0.3;
    return [Math.round(tt*20), Math.round(30 + tt*80), Math.round(120 + tt*100)];
  } else if (t < 0.55) {
    const tt = (t - 0.3) / 0.25;
    return [Math.round(20 + tt*20), Math.round(110 + tt*90), Math.round(220 - tt*140)];
  } else if (t < 0.78) {
    const tt = (t - 0.55) / 0.23;
    return [Math.round(40 + tt*140), Math.round(200 - tt*60), Math.round(80 - tt*60)];
  } else {
    const tt = Math.min(1, (t - 0.78) / 0.22);
    return [Math.round(180 + tt*75), Math.round(140 + tt*115), Math.round(20 + tt*235)];
  }
}

// ── Audio ──────────────────────────────────────────────────────
function startAudio() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();

    const master = ac.createGain();
    master.gain.value = 0.10;
    master.connect(ac.destination);

    // Deep earth drone — low rumbling tones
    [40, 60, 80].forEach((f, i) => {
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = f + Math.random();
      // Slow LFO breathing
      const lfo  = ac.createOscillator();
      const lfoG = ac.createGain();
      lfo.frequency.value = 0.05 + i * 0.04;
      lfoG.gain.value = 0.5;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      lfo.start();
      g.gain.value = 0.20 / (i + 1);
      osc.connect(g); g.connect(master); osc.start();
    });

    // Subtle wind — filtered noise
    const bufSize = ac.sampleRate * 2;
    const noiseBuf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
    const noiseNode = ac.createBufferSource();
    noiseNode.buffer = noiseBuf;
    noiseNode.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    const windGain = ac.createGain();
    windGain.gain.value = 0.04;
    noiseNode.connect(filter); filter.connect(windGain); windGain.connect(master);
    noiseNode.start();

    document.addEventListener('click', () => { if (ac.state === 'suspended') ac.resume(); });
  } catch(e) {}
}

startAudio();

// ── Render ─────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, CW, CH);

  ctx.globalAlpha = terrainAlpha;

  const heights = [];
  for (let gz = 0; gz <= GRID_H; gz++) {
    const row = [];
    for (let gx = 0; gx <= GRID_W; gx++) row.push(getHeight(gx, gz));
    heights.push(row);
  }

  // Moved up: originY changed from 0.72 → 0.55
  const originX = CW / 2;
  const originY = CH * 0.55;

  const wx0 = -(GRID_W / 2) * CELL;
  const wz0 = -(GRID_H / 4) * CELL;

  for (let gz = 0; gz < GRID_H; gz++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const corners = [[gx,gz],[gx+1,gz],[gx+1,gz+1],[gx,gz+1]];
      const pts = corners.map(([cx, cz]) => {
        const wx = wx0 + cx * CELL;
        const wy = heights[cz][cx];
        const wz = wz0 + cz * CELL;
        const { sx, sy } = project(wx, wy, wz);
        return { x: originX + sx, y: originY + sy, h: wy };
      });

      const avgH = pts.reduce((s, p) => s + p.h, 0) / 4;
      const [r, g, b] = heightColor(avgH, HEIGHT_SCALE);

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+80)},0.35)`;
      ctx.lineWidth   = 0.6;
      ctx.stroke();
    }
  }

  // Snow peak glows
  for (let gz = 0; gz <= GRID_H; gz++) {
    for (let gx = 0; gx <= GRID_W; gx++) {
      const h = heights[gz][gx];
      if (h < HEIGHT_SCALE * 0.5) continue;
      const t = (h - HEIGHT_SCALE * 0.5) / (HEIGHT_SCALE * 0.5);
      const wx = wx0 + gx * CELL;
      const wz = wz0 + gz * CELL;
      const { sx, sy } = project(wx, h, wz);
      const px = originX + sx, py = originY + sy;
      ctx.save();
      ctx.shadowColor = 'rgba(200,240,255,0.8)';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = `rgba(255,255,255,${t * 0.6})`;
      ctx.beginPath();
      ctx.arc(px, py, 2 + t * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.globalAlpha = 1;
}

// ── Animation ──────────────────────────────────────────────────
function animate() {
  frameCount++;

  if (terrainPhase === 'scroll') {
    zOffset += SCROLL_SPEED;
    if (frameCount % REGEN_INTERVAL === 0) {
      terrainPhase = 'fadeout';
      phaseTimer   = 0;
    }
  } else if (terrainPhase === 'fadeout') {
    zOffset += SCROLL_SPEED;
    phaseTimer++;
    terrainAlpha = 1 - phaseTimer / FADE_FRAMES;
    if (phaseTimer >= FADE_FRAMES) {
      shufflePerm();     // new terrain topology
      zOffset = 0;
      terrainPhase = 'fadein';
      phaseTimer   = 0;
    }
  } else if (terrainPhase === 'fadein') {
    phaseTimer++;
    terrainAlpha = phaseTimer / FADE_FRAMES;
    if (phaseTimer >= FADE_FRAMES) {
      terrainAlpha = 1;
      terrainPhase = 'scroll';
    }
  }

  render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);



