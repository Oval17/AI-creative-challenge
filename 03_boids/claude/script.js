'use strict';
// ── Scale wrapper to viewport ────────────────────────────────
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
const canvas = document.getElementById('boidsCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = W;
canvas.height = 1350; // center sim area (H minus header ~310px, footer ~260px)

// ── Config ───────────────────────────────────────────────────
const NUM_BOIDS      = 250;
const MAX_SPEED      = 4.2;
const MIN_SPEED      = 1.8;
const PERCEPTION_R   = 90;   // neighbourhood radius
const SEP_RADIUS     = 30;   // separation trigger
const ALIGN_WEIGHT   = 1.0;
const COHESION_WEIGHT= 0.9;
const SEP_WEIGHT     = 1.5;
const EDGE_MARGIN    = 60;
const EDGE_FORCE     = 0.6;
const TRAIL_LEN      = 18;   // trail history points
const TRAIL_ALPHA    = 0.18; // per-step fade

// ── Boid class ───────────────────────────────────────────────
class Boid {
  constructor() {
    this.x  = Math.random() * canvas.width;
    this.y  = Math.random() * canvas.height;
    const a = Math.random() * Math.PI * 2;
    const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.hue   = 160 + Math.random() * 80; // cyan→blue range
    this.trail = [];
  }

  update(boids) {
    // save trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();

    let alignX = 0, alignY = 0;
    let cohX   = 0, cohY   = 0;
    let sepX   = 0, sepY   = 0;
    let total  = 0, sepTotal = 0;

    for (const other of boids) {
      if (other === this) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < PERCEPTION_R) {
        alignX += other.vx; alignY += other.vy;
        cohX   += other.x;  cohY   += other.y;
        total++;
        if (d < SEP_RADIUS && d > 0) {
          sepX -= dx / d; sepY -= dy / d;
          sepTotal++;
        }
      }
    }

    if (total > 0) {
      // alignment
      alignX /= total; alignY /= total;
      this.vx += (alignX - this.vx) * 0.05 * ALIGN_WEIGHT;
      this.vy += (alignY - this.vy) * 0.05 * ALIGN_WEIGHT;
      // cohesion
      cohX = cohX / total - this.x;
      cohY = cohY / total - this.y;
      this.vx += cohX * 0.003 * COHESION_WEIGHT;
      this.vy += cohY * 0.003 * COHESION_WEIGHT;
    }
    if (sepTotal > 0) {
      this.vx += (sepX / sepTotal) * 0.08 * SEP_WEIGHT;
      this.vy += (sepY / sepTotal) * 0.08 * SEP_WEIGHT;
    }

    // edge avoidance
    if (this.x < EDGE_MARGIN)              this.vx += EDGE_FORCE;
    if (this.x > canvas.width - EDGE_MARGIN) this.vx -= EDGE_FORCE;
    if (this.y < EDGE_MARGIN)              this.vy += EDGE_FORCE;
    if (this.y > canvas.height - EDGE_MARGIN) this.vy -= EDGE_FORCE;

    // clamp speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > MAX_SPEED) { this.vx = (this.vx/spd)*MAX_SPEED; this.vy = (this.vy/spd)*MAX_SPEED; }
    if (spd < MIN_SPEED && spd > 0) { this.vx = (this.vx/spd)*MIN_SPEED; this.vy = (this.vy/spd)*MIN_SPEED; }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw() {
    // trail
    for (let i = 1; i < this.trail.length; i++) {
      const t   = i / this.trail.length;
      const a   = t * t * 0.55;
      const w   = t * 2.5;
      const hue = (this.hue + (1 - t) * 40) % 360;
      ctx.beginPath();
      ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
      ctx.strokeStyle = `hsla(${hue},100%,70%,${a})`;
      ctx.lineWidth   = w;
      ctx.shadowColor = `hsla(${hue},100%,70%,0.8)`;
      ctx.shadowBlur  = 8;
      ctx.stroke();
    }

    // boid body — arrow shape
    const angle = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    ctx.shadowColor = `hsla(${this.hue},100%,85%,1)`;
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7,  0);
    ctx.lineTo(-5,  3.5);
    ctx.lineTo(-3,  0);
    ctx.lineTo(-5, -3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Init boids ───────────────────────────────────────────────
const boids = Array.from({ length: NUM_BOIDS }, () => new Boid());

// ── Fill canvas black before first frame ─────────────────────
ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// ── Animation loop ───────────────────────────────────────────
function animate() {
  // clear to solid dark background each frame — trails are stored in boid.trail array
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const b of boids) b.update(boids);
  for (const b of boids) b.draw();

  requestAnimationFrame(animate);
}

animate();
