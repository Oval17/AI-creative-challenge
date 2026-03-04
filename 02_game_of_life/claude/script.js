/**
 * Conway's Game of Life — Cinematic Edition
 * Model: Claude Sonnet 4.6
 *
 * Features:
 *  • Canvas API rendering at 60 FPS
 *  • Classic Game of Life rules
 *  • Glowing cyan/green cells with fade trails
 *  • Auto-reseeds when population stabilises / dies
 *  • Scales to fill the 1080×1920 wrapper
 */

(function () {
  "use strict";

  /* ── Canvas setup ────────────────────────────────────────── */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // The simulation canvas fills the center area of the wrapper.
  // We'll size it to a square that comfortably fits in 1080 wide.
  const SIM_W = 1080;
  const SIM_H = 1300; // approximate center-area height

  canvas.width = SIM_W;
  canvas.height = SIM_H;

  /* ── Grid parameters ─────────────────────────────────────── */
  const CELL_SIZE = 14; // px per cell
  const COLS = Math.floor(SIM_W / CELL_SIZE);
  const ROWS = Math.floor(SIM_H / CELL_SIZE);

  /* ── State arrays ────────────────────────────────────────── */
  // current[row][col] → 1 (alive) or 0 (dead)
  let current = createGrid(0);
  let next    = createGrid(0);
  // fade[row][col]   → 0–1 luminance for trail effect
  let fade    = createGrid(0);

  /* ── Timing ──────────────────────────────────────────────── */
  const TARGET_FPS   = 60;
  const MS_PER_FRAME = 1000 / TARGET_FPS;
  const GEN_INTERVAL = 80; // ms between Game-of-Life steps

  let lastFrameTime  = 0;
  let lastGenTime    = 0;
  let generation     = 0;

  /* ── Stagnation detection (auto-reseed) ───────────────────── */
  let prevPopulation = 0;
  let stagnantFrames = 0;
  const STAGNANT_LIMIT = 120; // ~10 s at one gen / 80 ms

  /* ── Colour palette ──────────────────────────────────────── */
  // Alive cells: cyan → green gradient based on neighbour density
  // Trail: fading cyan/green ghost
  const CYAN  = { r: 0,   g: 255, b: 220 };
  const GREEN = { r: 50,  g: 255, b: 80  };

  /* ══════════════════════════════════════════════════════════
     Helpers
  ══════════════════════════════════════════════════════════ */

  function createGrid(fill) {
    return Array.from({ length: ROWS }, () => new Float32Array(COLS).fill(fill));
  }

  /** Randomise the grid — ~30–38% live density */
  function seedGrid() {
    const density = 0.30 + Math.random() * 0.08;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        current[r][c] = Math.random() < density ? 1 : 0;
        fade[r][c]    = current[r][c];
      }
    }
    generation     = 0;
    stagnantFrames = 0;
    prevPopulation = 0;
  }

  /** Count living neighbours (toroidal wrap) */
  function neighbours(grid, r, c) {
    let n = 0;
    const rm1 = (r - 1 + ROWS) % ROWS;
    const rp1 = (r + 1) % ROWS;
    const cm1 = (c - 1 + COLS) % COLS;
    const cp1 = (c + 1) % COLS;

    n += grid[rm1][cm1];
    n += grid[rm1][c];
    n += grid[rm1][cp1];
    n += grid[r  ][cm1];
    n += grid[r  ][cp1];
    n += grid[rp1][cm1];
    n += grid[rp1][c];
    n += grid[rp1][cp1];
    return n;
  }

  /** Apply classic GoL rules, update fade map */
  function stepGeneration() {
    let population = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const alive = current[r][c] === 1;
        const n     = neighbours(current, r, c);

        if (alive) {
          next[r][c] = (n === 2 || n === 3) ? 1 : 0;
        } else {
          next[r][c] = (n === 3) ? 1 : 0;
        }

        population += next[r][c];
      }
    }

    // Swap buffers
    [current, next] = [next, current];
    generation++;
    playGenTick();

    // Stagnation check
    if (population === prevPopulation) {
      stagnantFrames++;
    } else {
      stagnantFrames = 0;
    }
    prevPopulation = population;

    if (population === 0 || stagnantFrames >= STAGNANT_LIMIT) {
      // Smooth cross-fade into new seed after a short delay
      setTimeout(seedGrid, 400);
    }
  }

  /** Update fade map (decay dead cells slowly) */
  function updateFade() {
    const DECAY = 0.045; // speed of trail fading (per frame)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (current[r][c] === 1) {
          fade[r][c] = Math.min(1, fade[r][c] + 0.25);
        } else {
          fade[r][c] = Math.max(0, fade[r][c] - DECAY);
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     Rendering
  ══════════════════════════════════════════════════════════ */

  /** Linearly interpolate between two colours */
  function lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    };
  }

  function render() {
    // Clear with near-black (do NOT use clearRect — lets glow accumulate subtly)
    ctx.fillStyle = "rgba(10, 10, 10, 0.55)";
    ctx.fillRect(0, 0, SIM_W, SIM_H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const f = fade[r][c];
        if (f < 0.01) continue;

        const alive = current[r][c] === 1;
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;

        // Colour: alive → brighter cyan/green mix; trail → dimmer
        const n       = alive ? neighbours(current, r, c) : 0;
        const blend   = alive ? n / 8 : 0;
        const base    = lerpColor(CYAN, GREEN, blend);
        const alpha   = alive ? (0.75 + f * 0.25) : (f * 0.55);

        // Main cell fill
        ctx.fillStyle = `rgba(${base.r},${base.g},${base.b},${alpha})`;
        const gap  = 1;
        const size = CELL_SIZE - gap;
        ctx.fillRect(x + gap * 0.5, y + gap * 0.5, size, size);

        // Glow (only for visible cells)
        if (f > 0.2) {
          const glowAlpha = alive ? f * 0.35 : f * 0.12;
          const glowSize  = size + 6;
          ctx.shadowColor  = `rgba(${base.r},${base.g},${base.b},${glowAlpha})`;
          ctx.shadowBlur   = alive ? 14 : 6;
          ctx.fillStyle    = `rgba(${base.r},${base.g},${base.b},${glowAlpha * 0.5})`;
          ctx.fillRect(
            x + gap * 0.5 - 3,
            y + gap * 0.5 - 3,
            glowSize,
            glowSize
          );
          ctx.shadowBlur  = 0;
          ctx.shadowColor = "transparent";
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     Subtle animated vignette overlay
  ══════════════════════════════════════════════════════════ */

  function drawVignette(timestamp) {
    const pulse   = 0.18 + 0.04 * Math.sin(timestamp * 0.0008);
    const radial  = ctx.createRadialGradient(
      SIM_W / 2, SIM_H / 2, SIM_H * 0.25,
      SIM_W / 2, SIM_H / 2, SIM_H * 0.75
    );
    radial.addColorStop(0, "rgba(0,0,0,0)");
    radial.addColorStop(1, `rgba(0,0,0,${pulse})`);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, SIM_W, SIM_H);
  }

  /* ══════════════════════════════════════════════════════════
     Responsive scaling
  ══════════════════════════════════════════════════════════ */

  function scaleWrapper() {
    const wrapper = document.querySelector(".wrapper");
    if (!wrapper) return;
    const scaleX  = window.innerWidth  / 1080;
    const scaleY  = window.innerHeight / 1920;
    const scale   = Math.min(scaleX, scaleY);

    // Offset so the scaled wrapper is centred in the viewport
    const offsetX = (window.innerWidth  - 1080 * scale) / 2;
    const offsetY = (window.innerHeight - 1920 * scale) / 2;

    wrapper.style.transform       = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    wrapper.style.transformOrigin = "top left";
  }

  window.addEventListener("resize", scaleWrapper);
  scaleWrapper();

  /* ══════════════════════════════════════════════════════════
     Animation loop
  ══════════════════════════════════════════════════════════ */

  function loop(timestamp) {
    requestAnimationFrame(loop);

    const elapsed = timestamp - lastFrameTime;
    if (elapsed < MS_PER_FRAME - 1) return; // throttle to ~60 fps
    lastFrameTime = timestamp;

    // Advance the automaton at its own cadence
    if (timestamp - lastGenTime >= GEN_INTERVAL) {
      lastGenTime = timestamp;
      stepGeneration();
    }

    updateFade();
    render();
    drawVignette(timestamp);
  }

  /* ══════════════════════════════════════════════════════════
     Audio Engine — ambient generative soundscape
  ══════════════════════════════════════════════════════════ */

  let audioCtx = null;
  let masterGain = null;
  let reverbNode = null;
  let audioReady = false;

  // Simple impulse reverb
  function buildReverb(ctx, duration = 2.5, decay = 2.0) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  function initAudio() {
    if (audioReady) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.55, audioCtx.currentTime + 2);

    reverbNode = buildReverb(audioCtx);
    reverbNode.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    audioReady = true;
    startAmbientDrone();
    scheduleChimes();
  }

  /* ── Ambient low drone ───────────────────────────────────── */
  function startAmbientDrone() {
    // Sub-bass shimmer: two slightly detuned sine waves
    const freqs = [55, 55.18, 82.4, 110];
    freqs.forEach((f, i) => {
      const osc  = audioCtx.createOscillator();
      const g    = audioCtx.createGain();
      osc.type   = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      const vol  = i < 2 ? 0.12 : 0.05;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      osc.connect(g);
      g.connect(reverbNode);
      osc.start();
      // slow LFO-like modulation
      const lfo  = audioCtx.createOscillator();
      const lfoG = audioCtx.createGain();
      lfo.frequency.value = 0.08 + i * 0.03;
      lfoG.gain.value = f * 0.004;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();
    });
  }

  /* ── Chime notes (pentatonic scale) ─────────────────────── */
  const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00,
                 523.25, 587.33, 659.25, 783.99, 880.00];

  function playChime(freq, vol = 0.08) {
    if (!audioReady) return;
    const now  = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const g    = audioCtx.createGain();
    osc.type   = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    osc.connect(g);
    g.connect(reverbNode);
    osc.start(now);
    osc.stop(now + 2.2);

    // Harmonic fifth overtone
    const osc2 = audioCtx.createOscillator();
    const g2   = audioCtx.createGain();
    osc2.type  = 'sine';
    osc2.frequency.value = freq * 1.5;
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(vol * 0.35, now + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    osc2.connect(g2);
    g2.connect(reverbNode);
    osc2.start(now);
    osc2.stop(now + 1.4);
  }

  /* ── Periodically chime based on population density ─────── */
  let chimeIdx = 0;
  function scheduleChimes() {
    if (!audioReady) return;
    const density = prevPopulation / (COLS * ROWS);
    // Chime rate: active sim → more frequent; dying → sparse
    const interval = 600 + (1 - Math.min(density * 6, 1)) * 1800;
    const noteIdx  = (chimeIdx + Math.floor(Math.random() * 3)) % PENTA.length;
    const vol      = 0.04 + density * 0.18;
    playChime(PENTA[noteIdx], Math.min(vol, 0.14));
    chimeIdx = noteIdx + 1;
    setTimeout(scheduleChimes, interval);
  }

  /* ── Soft click / pop on each generation step ───────────── */
  function playGenTick() {
    if (!audioReady) return;
    const now  = audioCtx.currentTime;
    const buf  = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.05, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4) * 0.12;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g    = audioCtx.createGain();
    g.gain.value = 0.18;
    src.connect(g);
    g.connect(reverbNode);
    src.start(now);
  }

  /* ── Start audio on first user interaction ───────────────── */
  document.addEventListener("click",     initAudio, { once: true });
  document.addEventListener("touchstart", initAudio, { once: true });
  // Also auto-start (works in most browsers that allow it)
  window.addEventListener("load", () => {
    setTimeout(() => {
      try { initAudio(); } catch (e) { /* autoplay blocked, wait for click */ }
    }, 300);
  });

  /* ── Bootstrap ───────────────────────────────────────────── */
  seedGrid();
  requestAnimationFrame(loop);
})();
