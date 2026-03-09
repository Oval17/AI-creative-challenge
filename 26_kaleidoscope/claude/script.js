// Kaleidoscope Simulation – Claude Sonnet 4.6
// Cinematic 1080×1920 vertical format

(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  // Centre of the kaleidoscope (centre of canvas)
  const cx = W / 2;
  const cy = H / 2;

  // Number of mirror slices (must be even for symmetry)
  const SLICES = 12;
  const SLICE_ANGLE = (Math.PI * 2) / SLICES;

  // Off-screen buffer for one slice wedge
  const buf = document.createElement('canvas');
  const R = Math.min(W, H) * 0.48; // radius of the whole kaleidoscope
  buf.width = R;
  buf.height = R;
  const bctx = buf.getContext('2d');

  // ── Particle system drawn into the wedge buffer ──────────────────────────
  const NUM_PARTICLES = 80;
  const particles = [];

  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(createParticle());
  }

  function createParticle() {
    // Position in polar coords within the wedge [0, SLICE_ANGLE/2]
    const angle = Math.random() * SLICE_ANGLE * 0.5;
    const radius = Math.random() * R * 0.9 + 5;
    return {
      angle,
      radius,
      speed: (Math.random() * 0.002 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
      radSpeed: (Math.random() * 0.3 + 0.1) * (Math.random() < 0.5 ? 1 : -1),
      size: Math.random() * 6 + 2,
      hue: Math.random() * 360,
      hueSpeed: Math.random() * 0.8 + 0.2,
      alpha: Math.random() * 0.5 + 0.4,
      trail: [],
    };
  }

  function updateParticle(p) {
    p.angle += p.speed;
    p.radius += p.radSpeed * 0.15;

    // Bounce off wedge boundaries
    if (p.angle < 0 || p.angle > SLICE_ANGLE * 0.5) p.speed *= -1;
    if (p.radius < 5 || p.radius > R * 0.92) p.radSpeed *= -1;

    p.hue = (p.hue + p.hueSpeed) % 360;

    // Store trail
    const x = Math.cos(p.angle) * p.radius;
    const y = Math.sin(p.angle) * p.radius;
    p.trail.push({ x, y });
    if (p.trail.length > 18) p.trail.shift();
  }

  // ── Slow-evolving background pattern in the wedge ────────────────────────
  let t = 0;

  function drawWedge() {
    bctx.clearRect(0, 0, R, R);

    // Fade trails
    bctx.fillStyle = 'rgba(5,5,5,0.18)';
    bctx.fillRect(0, 0, R, R);

    // Draw flowing background lines
    for (let layer = 0; layer < 3; layer++) {
      bctx.beginPath();
      for (let r = 0; r < R; r += 4) {
        const a = Math.sin(r * 0.018 + t * 0.4 + layer * 1.2) * SLICE_ANGLE * 0.35;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (r === 0) bctx.moveTo(x, y);
        else bctx.lineTo(x, y);
      }
      const hue = (t * 30 + layer * 100) % 360;
      bctx.strokeStyle = `hsla(${hue},100%,60%,0.12)`;
      bctx.lineWidth = 1.5;
      bctx.stroke();
    }

    // Draw particles
    particles.forEach(p => {
      updateParticle(p);
      // Trail
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = (i / p.trail.length) * p.alpha * 0.6;
          bctx.beginPath();
          bctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          bctx.lineTo(p.trail[i].x, p.trail[i].y);
          bctx.strokeStyle = `hsla(${p.hue},100%,70%,${alpha})`;
          bctx.lineWidth = p.size * 0.4;
          bctx.stroke();
        }
      }
      // Glow dot
      const px = Math.cos(p.angle) * p.radius;
      const py = Math.sin(p.angle) * p.radius;
      const g = bctx.createRadialGradient(px, py, 0, px, py, p.size * 2.5);
      g.addColorStop(0, `hsla(${p.hue},100%,85%,${p.alpha})`);
      g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
      bctx.beginPath();
      bctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
      bctx.fillStyle = g;
      bctx.fill();
    });
  }

  // ── Render full kaleidoscope onto main canvas ─────────────────────────────
  function render() {
    // Dark background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    drawWedge();

    // Stamp the wedge buffer SLICES times with rotation + optional flip
    for (let s = 0; s < SLICES; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s * SLICE_ANGLE);

      if (s % 2 === 1) {
        // Mirror every other slice
        ctx.scale(-1, 1);
        ctx.rotate(-SLICE_ANGLE);
      }

      // Clip to the wedge shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, 0, SLICE_ANGLE);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(buf, 0, 0);
      ctx.restore();
    }

    // Vignette overlay
    const vg = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.05);
    vg.addColorStop(0, 'rgba(5,5,5,0)');
    vg.addColorStop(1, 'rgba(5,5,5,0.75)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Subtle centre glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.12);
    cg.addColorStop(0, `hsla(${(t * 40) % 360},80%,80%,0.35)`);
    cg.addColorStop(1, 'rgba(5,5,5,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    t += 0.008;
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  loop();
})();
