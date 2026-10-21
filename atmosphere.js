/* Child-Safer Spaces · Discover atmosphere · version 4.0
 *
 * What it shows: daylight falling across a shop floor. Dust motes become
 * visible only where the light falls, and the floor carries a soft sheen.
 * The idea it supports: looking carefully, from the right height, makes
 * hazards visible (and polished floors that shine can also be slippery).
 * It is an illustration, not data.
 *
 * Plain 2D canvas, no libraries, no images, no network.
 *
 * Quality ladder (chosen from the device, then adjusted by measured frame time):
 *   tier 3  120 motes, 9 out-of-focus motes, 4 light shafts, film grain, up to 2x pixels
 *   tier 2   70 motes, 6 out-of-focus motes, 3 shafts, grain, up to 1.5x pixels
 *   tier 1   35 motes, 3 out-of-focus motes, 3 shafts, no grain, 1x pixels
 *   still    one frame, no animation loop
 *   off      no canvas; the page's CSS gradient remains
 *
 * The loop stops when: the page is hidden; the scene scrolls out of view;
 * the battery is low and not charging; the person presses Pause; reduced
 * motion is requested (system or settings); or after 90 seconds of
 * continuous animation (press Play to continue). A failure anywhere hides
 * the canvas and leaves the static background.
 *
 * To adapt: change the palette in style.css (--atmo-* tokens) or the tier
 * table below. Keep every animation meaningful and stoppable.
 */
(function (root) {
'use strict';
const TIERS = {
  3: { motes: 120, bokeh: 9, beams: 4, grain: true, dpr: 2 },
  2: { motes: 70, bokeh: 6, beams: 3, grain: true, dpr: 1.5 },
  1: { motes: 35, bokeh: 3, beams: 3, grain: false, dpr: 1 }
};
const MAX_RUN_MS = 90000, SLOW_FRAME_MS = 24, SAMPLE = 45;

function cssVar(el, name, fallback) { const v = getComputedStyle(el).getPropertyValue(name).trim(); return v || fallback; }
// Deterministic pseudo-random numbers so the still frame looks the same each time.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function startTier() {
  const n = root.navigator || {}, c = n.connection || {};
  let t = 3;
  if ((n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4) t = 2;
  if (Math.min(root.innerWidth || 1200, root.screen ? root.screen.width : 1200) < 600) t = Math.min(t, 2);
  if (c.saveData) t = 1;
  return t;
}

/* mount(hero, canvas, opts) → controller
 *   opts.mode: 'auto' | 'still' | 'off'; opts.reduced: boolean
 *   opts.onState(state): told 'playing' | 'paused' | 'still' | 'off' and why */
function mount(hero, canvas, opts = {}) {
  const ctl = { state: 'off', reason: '', tier: 0, destroy, setMode, toggle };
  let ctx, w = 0, h = 0, dpr = 1, bg = null, sprite = null, grain = null, pal = null;
  let motes = [], bokeh = [], beams = [], hereXY = null, raf = 0, running = false, visible = true, inView = true, lowBattery = false;
  let mode = opts.mode || 'auto', reduced = !!opts.reduced, userPaused = false, runStart = 0, lastT = 0, frameTimes = [];
  const tell = (state, reason) => { ctl.state = state; ctl.reason = reason || ''; if (opts.onState) opts.onState(state, reason || ''); };
  const cleanups = [];
  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); };

  try {
    ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw Error('no 2d context');
  } catch (e) { canvas.hidden = true; tell('off', 'Canvas is not available here.'); return ctl; }

  function readPalette() {
    pal = {
      wallTop: cssVar(hero, '--atmo-wall-top', '#e8eee9'), wallLow: cssVar(hero, '--atmo-wall-low', '#d9e3dd'),
      floorNear: cssVar(hero, '--atmo-floor-near', '#b7c9bd'), floorFar: cssVar(hero, '--atmo-floor-far', '#cbd8cf'),
      light: cssVar(hero, '--atmo-light', '255, 236, 196'), mote: cssVar(hero, '--atmo-mote', '255, 244, 220'),
      shade: cssVar(hero, '--atmo-shade', '24, 59, 55'), here: cssVar(hero, '--atmo-here', '242, 179, 61')
    };
  }
  function horizon() { return h * 0.64; }

  /* Background (wall, floor, light pool, sheen, vignette) is drawn once per size. */
  function buildBackground() {
    bg = document.createElement('canvas'); bg.width = Math.round(w * dpr); bg.height = Math.round(h * dpr);
    const b = bg.getContext('2d'); b.scale(dpr, dpr);
    const hz = horizon();
    let g = b.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, pal.wallTop); g.addColorStop(1, pal.wallLow);
    b.fillStyle = g; b.fillRect(0, 0, w, hz);
    g = b.createLinearGradient(0, hz, 0, h); g.addColorStop(0, pal.floorFar); g.addColorStop(1, pal.floorNear);
    b.fillStyle = g; b.fillRect(0, hz, w, h - hz);
    // Skirting line where wall meets floor: a soft contact shadow.
    g = b.createLinearGradient(0, hz - 2, 0, hz + 18); g.addColorStop(0, 'rgba(' + pal.shade + ',0.16)'); g.addColorStop(1, 'rgba(' + pal.shade + ',0)');
    b.fillStyle = g; b.fillRect(0, hz - 2, w, 20);
    // Pool of window light on the floor (a skewed, feathered rectangle built from gradients).
    b.save(); b.translate(w * 0.62, hz + (h - hz) * 0.55); b.transform(1, 0, -0.9, 0.42, 0, 0);
    g = b.createRadialGradient(0, 0, 10, 0, 0, Math.max(w, h) * 0.42);
    g.addColorStop(0, 'rgba(' + pal.light + ',0.55)'); g.addColorStop(0.55, 'rgba(' + pal.light + ',0.18)'); g.addColorStop(1, 'rgba(' + pal.light + ',0)');
    b.fillStyle = g; b.fillRect(-w, -h, w * 2, h * 2); b.restore();
    // Specular sheen on the floor near the horizon.
    g = b.createLinearGradient(0, hz, 0, hz + (h - hz) * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = g; b.fillRect(0, hz, w, (h - hz) * 0.5);
    // Vignette for depth.
    g = b.createRadialGradient(w * 0.55, h * 0.45, Math.min(w, h) * 0.3, w * 0.55, h * 0.5, Math.max(w, h) * 0.85);
    g.addColorStop(0, 'rgba(' + pal.shade + ',0)'); g.addColorStop(1, 'rgba(' + pal.shade + ',0.22)');
    b.fillStyle = g; b.fillRect(0, 0, w, h);
  }
  function buildSprite() {
    sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
    const s = sprite.getContext('2d'), g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + pal.mote + ',1)'); g.addColorStop(0.25, 'rgba(' + pal.mote + ',0.55)'); g.addColorStop(1, 'rgba(' + pal.mote + ',0)');
    s.fillStyle = g; s.fillRect(0, 0, 64, 64);
  }
  function buildGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), img = g.createImageData(128, 128), r = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + r() * 145; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); grain = ctx.createPattern(c, 'repeat');
  }
  /* Light shafts come from a high window at the upper right and land on the floor. */
  function buildScene(tier) {
    const T = TIERS[tier] || TIERS[2], r = rng(42), hz = horizon();
    beams = [];
    for (let i = 0; i < T.beams; i++) {
      const top = w * (0.62 + i * 0.09), width = w * (0.05 + r() * 0.05);
      beams.push({ x1: top, x2: top + width, fx1: top - w * 0.5 - i * w * 0.04, fx2: top - w * 0.5 - i * w * 0.04 + width * 2.4, fy: hz + (h - hz) * (0.5 + r() * 0.3), phase: r() * 6.28, speed: 0.0004 + r() * 0.0003, base: 0.12 + r() * 0.08 });
    }
    motes = []; const m = T.motes;
    for (let i = 0; i < m; i++) motes.push({ x: r() * w, y: r() * h * 0.95, z: 0.25 + r() * 0.75, ph: r() * 6.28, sp: 0.6 + r() * 0.8 });
    bokeh = [];
    for (let i = 0; i < T.bokeh; i++) bokeh.push({ x: r() * w, y: r() * h, rad: 18 + r() * 46, a: 0.035 + r() * 0.05, ph: r() * 6.28 });
  }
  /* How much light reaches a point: 0 outside every shaft, up to 1 at a shaft's centre. */
  function lightAt(x, y, t) {
    let best = 0;
    for (const b of beams) {
      if (y > b.fy) continue;
      const f = y / b.fy, cx1 = b.x1 + (b.fx1 - b.x1) * f, cx2 = b.x2 + (b.fx2 - b.x2) * f;
      if (x < cx1 || x > cx2) continue;
      const mid = (cx1 + cx2) / 2, half = (cx2 - cx1) / 2, v = 1 - Math.abs(x - mid) / half;
      best = Math.max(best, v * (0.75 + 0.25 * Math.sin(b.phase + t * b.speed)));
    }
    return best;
  }
  function draw(t) {
    const T = TIERS[ctl.tier] || TIERS[2];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0, w, h);
    // Light shafts, breathing slowly.
    ctx.globalCompositeOperation = 'lighter';
    for (const b of beams) {
      const a = b.base * (0.75 + 0.25 * Math.sin(b.phase + t * b.speed));
      const g = ctx.createLinearGradient(b.x1, 0, b.fx1, b.fy);
      g.addColorStop(0, 'rgba(' + pal.light + ',' + (a * 0.2).toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(' + pal.light + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + pal.light + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.x1, 0); ctx.lineTo(b.x2, 0); ctx.lineTo(b.fx2, b.fy); ctx.lineTo(b.fx1, b.fy); ctx.closePath(); ctx.fill();
    }
    // Out-of-focus motes close to the viewer (depth of field).
    for (const k of bokeh) {
      const x = k.x + Math.sin(k.ph + t * 0.00011) * 14, y = k.y + Math.cos(k.ph + t * 0.00009) * 10;
      ctx.globalAlpha = k.a; ctx.drawImage(sprite, x - k.rad, y - k.rad, k.rad * 2, k.rad * 2);
    }
    // Dust motes: drifting slowly, bright only inside a light shaft.
    for (const p of motes) {
      const x = (p.x + Math.sin(p.ph + t * 0.00023 * p.sp) * 22 * p.z + w) % w;
      const y = (p.y + ((t * 0.006 * p.sp * p.z) % h) + h) % h;
      const lit = lightAt(x, y, t);
      if (lit < 0.04) continue;
      const size = (1.2 + 2.8 * p.z), twinkle = 0.7 + 0.3 * Math.sin(p.ph * 3 + t * 0.002 * p.sp);
      ctx.globalAlpha = Math.min(1, lit * p.z * twinkle);
      ctx.drawImage(sprite, x - size * 2, y - size * 2, size * 4, size * 4);
    }
    // A warm glow under "you are here" on the journey line (orientation).
    if (hereXY) {
      const [x, y] = hereXY, g = ctx.createRadialGradient(x, y, 2, x, y, 46);
      g.addColorStop(0, 'rgba(' + pal.here + ',0.42)'); g.addColorStop(1, 'rgba(' + pal.here + ',0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - 50, y - 50, 100, 100);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (T.grain && grain) { ctx.globalAlpha = 0.045; ctx.fillStyle = grain; ctx.fillRect(0, 0, w, h); }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const r = hero.getBoundingClientRect();
    const T = TIERS[ctl.tier] || TIERS[2];
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    dpr = Math.min(root.devicePixelRatio || 1, T.dpr);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const here = hero.querySelector('[data-here]'); // measured once per size, not every frame
    if (here) { const hr = here.getBoundingClientRect(); hereXY = [hr.left - r.left + hr.width / 2, hr.top - r.top + hr.height / 2]; } else hereXY = null;
    readPalette(); buildBackground(); buildSprite(); if (!grain) buildGrain(); buildScene(ctl.tier || 2);
    draw(lastT || 0);
  }
  function frame(t) {
    raf = 0;
    if (!running) return;
    if (!runStart) runStart = t;
    if (lastT) {
      frameTimes.push(t - lastT); if (frameTimes.length > SAMPLE) frameTimes.shift();
      if (frameTimes.length === SAMPLE) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / SAMPLE;
        if (avg > SLOW_FRAME_MS) { frameTimes = []; if (ctl.tier > 1) { ctl.tier--; resize(); } else { stop('still', 'This device is drawing slowly, so the scene stays still.'); return; } }
      }
    }
    lastT = t; draw(t);
    if (t - runStart > MAX_RUN_MS) { stop('paused', 'Paused after 90 seconds to save energy. Press Play to continue.'); return; }
    raf = root.requestAnimationFrame(frame);
  }
  function canRun() { return mode === 'auto' && !reduced && !userPaused && visible && inView && !lowBattery; }
  function why() {
    if (mode === 'off') return ['off', 'The background scene is switched off in settings.'];
    if (mode === 'still') return ['still', 'Set to a still image in settings.'];
    if (reduced) return ['still', 'Shown still because reduced motion is requested.'];
    if (lowBattery) return ['still', 'Shown still because the battery is low.'];
    if (userPaused) return ['paused', 'Paused.'];
    return ['paused', 'Paused while not visible.'];
  }
  function start() {
    if (running || !canRun()) return;
    running = true; runStart = 0; lastT = 0; frameTimes = [];
    tell('playing', 'Playing. Press Pause to stop the motion.');
    raf = root.requestAnimationFrame(frame);
  }
  function stop(state, reason) {
    running = false; if (raf) root.cancelAnimationFrame(raf); raf = 0;
    if (state === 'still') ctl.tier = Math.max(1, ctl.tier);
    draw(lastT || 0);
    const [s, r] = state ? [state, reason] : why();
    tell(s, r);
  }
  function update() { if (mode === 'off') { canvas.hidden = true; stop('off', 'The background scene is switched off in settings.'); return; } canvas.hidden = false; if (canRun()) start(); else stop(); }
  function setMode(m, isReduced) { mode = m; if (typeof isReduced === 'boolean') reduced = isReduced; if (mode !== 'off') { readPalette(); resize(); } update(); }
  function toggle() { if (ctl.state === 'playing') { userPaused = true; stop(); } else { userPaused = false; if (canRun()) start(); else stop(); } return ctl.state; }
  function destroy() { running = false; if (raf) root.cancelAnimationFrame(raf); raf = 0; cleanups.forEach(f => f()); }

  try {
    ctl.tier = startTier();
    resize();
    on(document, 'visibilitychange', () => { visible = document.visibilityState === 'visible'; update(); });
    if ('IntersectionObserver' in root) { const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; update(); }); io.observe(hero); cleanups.push(() => io.disconnect()); }
    if ('ResizeObserver' in root) { let t = 0; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (mode !== 'off') resize(); }, 120); }); ro.observe(hero); cleanups.push(() => { ro.disconnect(); clearTimeout(t); }); }
    if (root.navigator && typeof root.navigator.getBattery === 'function') {
      root.navigator.getBattery().then(bat => {
        const check = () => { lowBattery = !bat.charging && bat.level <= 0.2; update(); };
        bat.addEventListener('levelchange', check); bat.addEventListener('chargingchange', check);
        cleanups.push(() => { bat.removeEventListener('levelchange', check); bat.removeEventListener('chargingchange', check); });
        check();
      }).catch(() => { /* battery information is optional */ });
    }
    update();
  } catch (e) { destroy(); canvas.hidden = true; tell('off', 'The background scene could not be drawn; the still background is shown.'); }
  return ctl;
}

root.CSSAtmosphere = { mount, TIERS, MAX_RUN_MS };
})(typeof window !== 'undefined' ? window : globalThis);
