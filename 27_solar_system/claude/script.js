// Solar System Simulation – Claude Sonnet 4.6
// Cinematic 1080×1920 vertical format

(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const W = 1080;
  const H = 1920;
  canvas.width = W;
  canvas.height = H;

  // Center of solar system – pushed slightly down to use center canvas area
  const cx = W / 2;
  const cy = H / 2;

  // ── Star field ────────────────────────────────────────────────────────────
  const STAR_COUNT = 320;
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.4 + 0.2,
    alpha: Math.random() * 0.7 + 0.2,
    twinkleSpeed: Math.random() * 0.02 + 0.005,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));

  // ── Asteroid belt ─────────────────────────────────────────────────────────
  const ASTEROID_COUNT = 180;
  const asteroids = Array.from({ length: ASTEROID_COUNT }, () => {
    const r = 285 + Math.random() * 55; // belt radius range
    const angle = Math.random() * Math.PI * 2;
    return {
      angle,
      radius: r,
      speed: 0.00028 + Math.random() * 0.00012,
      size: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    };
  });

  // ── Planet data ───────────────────────────────────────────────────────────
  // orbitR: orbit radius in px, speed: rad/frame, size: planet radius px
  const planets = [
    {
      name: 'Mercury', orbitR: 72,  speed: 0.0220, size: 5,
      color: '#b5b5b5', glowColor: 'rgba(181,181,181,0.35)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
    {
      name: 'Venus',   orbitR: 112, speed: 0.0145, size: 9,
      color: '#e8c97a', glowColor: 'rgba(232,201,122,0.35)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
    {
      name: 'Earth',   orbitR: 155, speed: 0.0110, size: 10,
      color: '#4a9eff', glowColor: 'rgba(74,158,255,0.40)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
    {
      name: 'Mars',    orbitR: 200, speed: 0.0086, size: 7,
      color: '#e05c3a', glowColor: 'rgba(224,92,58,0.35)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
    // Asteroid belt at ~270–340 px
    {
      name: 'Jupiter', orbitR: 375, speed: 0.0042, size: 22,
      color: '#c8a96e', glowColor: 'rgba(200,169,110,0.35)',
      angle: Math.random() * Math.PI * 2, trail: [],
      bands: true,
    },
    {
      name: 'Saturn',  orbitR: 470, speed: 0.0030, size: 18,
      color: '#e8d8a0', glowColor: 'rgba(232,216,160,0.30)',
      angle: Math.random() * Math.PI * 2, trail: [],
      rings: true,
    },
    {
      name: 'Uranus',  orbitR: 550, speed: 0.0021, size: 13,
      color: '#7de8e8', glowColor: 'rgba(125,232,232,0.30)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
    {
      name: 'Neptune', orbitR: 618, speed: 0.0016, size: 12,
      color: '#4040ff', glowColor: 'rgba(64,64,255,0.30)',
      angle: Math.random() * Math.PI * 2, trail: [],
    },
  ];

  const MAX_TRAIL = 60;
  let t = 0;

  // ── Draw glowing orbit ring ───────────────────────────────────────────────
  function drawOrbit(r, alpha) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // ── Draw Sun ──────────────────────────────────────────────────────────────
  function drawSun() {
    // Outer corona pulses
    const pulse = 1 + Math.sin(t * 1.8) * 0.06;
    const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, 75 * pulse);
    corona.addColorStop(0,   'rgba(255,240,180,0.0)');
    corona.addColorStop(0.3, 'rgba(255,200,60,0.08)');
    corona.addColorStop(1,   'rgba(255,120,0,0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, 75 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Sun glow
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 42);
    sg.addColorStop(0,   '#fff8e0');
    sg.addColorStop(0.3, '#ffe060');
    sg.addColorStop(0.7, '#ff8800');
    sg.addColorStop(1,   'rgba(255,80,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();

    // Sun core
    ctx.fillStyle = '#fff5c0';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Draw asteroid belt ────────────────────────────────────────────────────
  function drawAsteroids() {
    asteroids.forEach(a => {
      a.angle += a.speed;
      const x = cx + Math.cos(a.angle) * a.radius;
      const y = cy + Math.sin(a.angle) * a.radius;
      ctx.beginPath();
      ctx.arc(x, y, a.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,140,120,${a.alpha})`;
      ctx.fill();
    });
  }

  // ── Draw Jupiter bands ────────────────────────────────────────────────────
  function drawJupiterBands(px, py, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.clip();
    const bandColors = ['#c8a96e','#b8915a','#d4b880','#a07840'];
    for (let i = 0; i < 4; i++) {
      const yOff = -size + (i / 4) * size * 2;
      ctx.fillStyle = bandColors[i];
      ctx.fillRect(px - size, py + yOff, size * 2, size * 0.5);
    }
    ctx.restore();
  }

  // ── Draw Saturn rings ─────────────────────────────────────────────────────
  function drawSaturnRings(px, py, size, angle) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI * 0.15);

    // Outer ring
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 2.6, size * 0.55, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(220,200,140,0.55)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Middle ring
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 2.0, size * 0.42, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,180,120,0.40)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.55, size * 0.32, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,160,100,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function render() {
    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Draw stars
    stars.forEach(s => {
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed * 60 + s.twinkleOffset));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    // Draw orbit paths
    planets.forEach(p => drawOrbit(p.orbitR, 0.12));

    // Draw asteroid belt (faint ring hint)
    drawOrbit(285, 0.04);
    drawOrbit(340, 0.04);

    // Draw asteroids
    drawAsteroids();

    // Draw Sun
    drawSun();

    // Update & draw planets
    planets.forEach(p => {
      p.angle += p.speed;

      const px = cx + Math.cos(p.angle) * p.orbitR;
      const py = cy + Math.sin(p.angle) * p.orbitR;

      // Trail
      p.trail.push({ x: px, y: py });
      if (p.trail.length > MAX_TRAIL) p.trail.shift();

      if (p.trail.length > 2) {
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = (i / p.trail.length) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.strokeStyle = p.glowColor.replace(')', `,${alpha})`).replace('rgba(', 'rgba(');
          // Simpler: use the planet color at low alpha
          ctx.strokeStyle = `rgba(${hexToRgb(p.color)},${alpha})`;
          ctx.lineWidth = p.size * 0.25;
          ctx.stroke();
        }
      }

      // Saturn rings (drawn behind planet)
      if (p.rings) {
        drawSaturnRings(px, py, p.size, p.angle);
      }

      // Planet glow
      const pg = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
      pg.addColorStop(0, p.glowColor);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Planet body
      if (p.bands) {
        // Base color first
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        drawJupiterBands(px, py, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet shine
      const shine = ctx.createRadialGradient(
        px - p.size * 0.3, py - p.size * 0.3, 0,
        px, py, p.size
      );
      shine.addColorStop(0, 'rgba(255,255,255,0.45)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Vignette
    const vg = ctx.createRadialGradient(cx, cy, H * 0.28, cx, cy, H * 0.54);
    vg.addColorStop(0, 'rgba(5,5,5,0)');
    vg.addColorStop(1, 'rgba(5,5,5,0.70)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    t += 0.016;
  }

  // ── Utility: hex color → "r,g,b" string ──────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  loop();
})();
