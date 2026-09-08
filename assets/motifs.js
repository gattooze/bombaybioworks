/*!
 * BBMotifs, Bombay Bioworks background motif library
 * v1.0 · documented in the BB Design System, "09, Background Motifs"
 *
 * Three motif types, each a pure canvas drawer plus a DOM-attach helper:
 *   bamboo-grove   , layered silhouette (hills optional). Adaptive: pass
 *                     `avoidElement` and the culms thin out, shorten, and
 *                     drop their leaves under whatever sits in front of them,
 *                     rather than being drawn full-size behind it.
 *   carbon-network , scattered hex nodes + connectors. `placement`:
 *                     'corner' | 'bleed' | 'band'.
 *   horizon-hills  , the grove's hill layer alone, no culms.
 *
 * Usage:
 *   const handle = BBMotifs.attach(canvasEl, {
 *     type: 'bamboo-grove', color: '#3E6448', alpha: 0.05,
 *     hills: true, seed: 41, avoidElement: document.querySelector('.hero-inner')
 *   });
 *   handle.update({ color: '#6BA870', alpha: 0.1 });   // e.g. on theme toggle
 *   handle.destroy();                                   // on teardown
 *
 * Every color/alpha/seed is a caller-supplied parameter, this file holds no
 * brand hex values itself, so it stays reusable outside this one palette.
 */
(function (global) {
  'use strict';

  // ── Seeded RNG so a given `seed` always draws the same pattern ────────
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ── Avoidance ───────────────────────────────────────────────────────
  // Only the horizontal band matters for a vertical culm, how far into
  // the protected x-range does this x-coordinate fall, feathered at the
  // edges so the effect eases in rather than cutting off sharply.
  function xOverlap(x, avoidX, feather) {
    if (!avoidX) return 0;
    if (x >= avoidX.x0 && x <= avoidX.x1) return 1;
    const d = x < avoidX.x0 ? avoidX.x0 - x : x - avoidX.x1;
    return Math.max(0, 1 - d / feather);
  }

  // Measures `el` against `canvas`'s own box and returns a padded
  // horizontal exclusion band in the canvas's local (unscaled) pixel space.
  function avoidXFromElement(canvas, el, pad) {
    if (!el) return null;
    const cRect = canvas.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const p = pad != null ? pad : 24;
    return { x0: (eRect.left - cRect.left) - p, x1: (eRect.right - cRect.left) + p };
  }

  // ── Shared low-level drawers ────────────────────────────────────────
  function smoothRidge(ctx, w, baseY, points) {
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    ctx.lineTo(w, points[points.length - 1].y);
    ctx.lineTo(w, baseY);
    ctx.closePath();
    ctx.fill();
  }

  function drawHillLayers(ctx, w, h, color, alpha, seed, layerCount) {
    const rng = mulberry32(seed);
    const n = layerCount || 3;
    for (let layer = 0; layer < n; layer++) {
      const depth = n === 1 ? 1 : layer / (n - 1);
      const baseY = h * (0.52 + depth * 0.30);
      const amp = h * (0.05 + depth * 0.09);
      const pts = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        pts.push({ x: (w / steps) * i, y: baseY - amp * (0.3 + rng() * 0.9) });
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * (0.32 + depth * 0.42);
      smoothRidge(ctx, w, h + 4, pts);
    }
    ctx.globalAlpha = 1;
  }

  function leafBlade(ctx, x, y, ang, len) {
    const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
    const cx1 = x + Math.sin(ang) * len * 0.35 + Math.cos(ang) * 4;
    const cy1 = y - len * 0.2;
    const cx2 = x + Math.sin(ang) * len * 0.65 - Math.cos(ang) * 2;
    const cy2 = y - len * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx1, cy1, ex, ey);
    ctx.quadraticCurveTo(cx2, cy2, x, y);
    ctx.fill();
  }

  // One cluster of culms. `avoidX` (optional) is the {x0,x1} band from
  // avoidXFromElement(), culms under it shrink, dim, drop their leaves,
  // and (past ~90% overlap) skip entirely, so the grove parts around
  // whatever content sits in front of it instead of drawing through it.
  function drawBambooCluster(ctx, w, h, opts) {
    const rng = mulberry32(opts.seed);
    const feather = Math.max(40, w * 0.09);
    const count = opts.count;
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1 || 1) - 0.5) * opts.spread + opts.clusterX;
      const x = w * Math.max(0.02, Math.min(0.98, t + (rng() - 0.5) * 0.06));
      const suppress = xOverlap(x, opts.avoidX, feather);
      if (suppress > 0.92) continue;
      const growth = 1 - suppress * 0.82;
      const fade = 1 - suppress * 0.55;
      const lean = (rng() - 0.5) * 22;
      const baseline = opts.baseline;
      const topY = baseline - (opts.minH + rng() * opts.varH) * growth;
      const baseW = (3 + rng() * 2.4) * (0.6 + growth * 0.4);
      const tipW = 0.8;
      ctx.fillStyle = opts.color;
      ctx.globalAlpha = opts.alpha * (0.82 + rng() * 0.18) * fade;
      ctx.beginPath();
      ctx.moveTo(x - baseW, baseline);
      ctx.quadraticCurveTo(x - baseW * 0.4 + lean * 0.5, (baseline + topY) / 2, x - tipW + lean, topY);
      ctx.lineTo(x + tipW + lean, topY);
      ctx.quadraticCurveTo(x + baseW * 0.4 + lean * 0.5, (baseline + topY) / 2, x + baseW, baseline);
      ctx.closePath();
      ctx.fill();

      if (suppress < 0.7) {
        for (let tier = 0; tier < opts.tiers; tier++) {
          const tf = tier / opts.tiers;
          const ty = topY + (baseline - topY) * (0.06 + tf * 0.30);
          const tx = x + lean * (1 - tf);
          const blades = tier === 0 ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
          for (let b = 0; b < blades; b++) {
            const ang = -0.9 + (b / (blades - 1 || 1)) * 1.8 + (rng() - 0.5) * 0.25;
            leafBlade(ctx, tx, ty, ang, (13 + rng() * 11 - tf * 4) * growth);
          }
        }
      }
    }
    // Grass fringe under the cluster, same suppression, so it thins in step.
    const gStart = w * Math.max(0, opts.clusterX - opts.spread * 0.6 - 0.08);
    const gEnd = w * Math.min(1, opts.clusterX + opts.spread * 0.6 + 0.08);
    for (let x = gStart; x < gEnd; x += 6) {
      const suppress = xOverlap(x, opts.avoidX, feather);
      if (suppress > 0.85) continue;
      const bh = (6 + rng() * 10) * (1 - suppress * 0.7);
      ctx.globalAlpha = opts.alpha * 0.7 * (1 - suppress * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, opts.baseline);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, opts.baseline - bh * 0.6, x + (rng() - 0.5) * 4, opts.baseline - bh);
      ctx.lineTo(x + 1.6, opts.baseline - bh);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * 4, opts.baseline - bh * 0.6, x + 1.6, opts.baseline);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Motif: bamboo-grove ─────────────────────────────────────────────
  // opts: color, alpha, seed, hills (default true), avoidX ({x0,x1} or null),
  //       clusterSide ('left'|'right', default 'right'), clusters (optional
  //       override array, see DEFAULT_CLUSTERS below for the shape).
  const DEFAULT_CLUSTERS_RIGHT = [
    { clusterX: 0.68, spread: 0.30, count: 6, tiers: 1, minHf: 0.28, varHf: 0.14, alphaMul: 1.6, seedOff: 11 },
    { clusterX: 0.80, spread: 0.34, count: 8, tiers: 2, minHf: 0.42, varHf: 0.24, alphaMul: 2.6, seedOff: 23 }
  ];
  function mirrorClusters(clusters) {
    return clusters.map(function (c) { return Object.assign({}, c, { clusterX: 1 - c.clusterX }); });
  }

  function drawBambooGrove(ctx, w, h, opts) {
    if (opts.hills !== false) {
      drawHillLayers(ctx, w, h, opts.color, opts.alpha * 0.9, opts.seed, 3);
    }
    const base = opts.clusters || (opts.clusterSide === 'left'
      ? mirrorClusters(DEFAULT_CLUSTERS_RIGHT)
      : DEFAULT_CLUSTERS_RIGHT);
    base.forEach(function (c) {
      drawBambooCluster(ctx, w, h, {
        color: opts.color, alpha: opts.alpha * c.alphaMul, seed: opts.seed + c.seedOff,
        baseline: h + 4, clusterX: c.clusterX, spread: c.spread, count: c.count,
        tiers: c.tiers, minH: h * c.minHf, varH: h * c.varHf, avoidX: opts.avoidX
      });
    });
  }

  // ── Motif: horizon-hills (the grove's background layer, alone) ─────
  function drawHorizonHills(ctx, w, h, opts) {
    drawHillLayers(ctx, w, h, opts.color, opts.alpha, opts.seed, opts.layers || 3);
  }

  // ── Motif: carbon-network ───────────────────────────────────────────
  function strokeHexRot(ctx, cx, cy, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30) + rot;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawHexNodes(ctx, w, h, color, alpha, seed, focals) {
    const rng = mulberry32(seed);
    const nodes = [];
    focals.forEach(function (f) {
      for (let i = 0; i < f.n; i++) {
        let x, y, tries = 0;
        do {
          x = f.x + gauss(rng) * f.sx;
          y = f.y + gauss(rng) * f.sy;
          tries++;
        } while ((x < -20 || x > w + 20 || y < -20 || y > h + 20) && tries < 6);
        x = Math.max(-10, Math.min(w + 10, x));
        y = Math.max(-10, Math.min(h + 10, y));
        const dist = Math.hypot((x - f.x) / f.sx, (y - f.y) / f.sy);
        nodes.push({ x: x, y: y, r: 9 + rng() * 32, rot: rng() < 0.5 ? 0 : Math.PI / 6, a: Math.max(0.1, 1 - dist * 0.5) });
      }
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const connCount = nodes.map(function () { return 0; });
    nodes.forEach(function (n, i) {
      if (connCount[i] >= 2) return;
      let best = -1, bestD = Infinity;
      nodes.forEach(function (m, j) {
        if (i === j || connCount[j] >= 2) return;
        const d = Math.hypot(n.x - m.x, n.y - m.y);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best >= 0 && bestD < Math.max(w, h) * 0.32) {
        ctx.globalAlpha = alpha * Math.min(n.a, nodes[best].a) * 0.55;
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(nodes[best].x, nodes[best].y); ctx.stroke();
        connCount[i]++; connCount[best]++;
      }
    });

    ctx.lineWidth = 1.1;
    nodes.forEach(function (n) {
      ctx.globalAlpha = alpha * n.a;
      strokeHexRot(ctx, n.x, n.y, n.r, n.rot);
      if (rng() < 0.25) { ctx.fillStyle = color; ctx.globalAlpha = alpha * n.a * 0.16; ctx.fill(); }
    });

    ctx.fillStyle = color;
    nodes.forEach(function (n) {
      ctx.globalAlpha = alpha * Math.min(1, n.a * 1.4);
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2); ctx.fill();
    });
    const extraDots = Math.floor(nodes.length * 0.5);
    for (let i = 0; i < extraDots; i++) {
      const f = focals[Math.floor(rng() * focals.length)];
      const x = Math.max(0, Math.min(w, f.x + gauss(rng) * f.sx * 1.3));
      const y = Math.max(0, Math.min(h, f.y + gauss(rng) * f.sy * 1.3));
      const dist = Math.hypot((x - f.x) / f.sx, (y - f.y) / f.sy);
      ctx.globalAlpha = alpha * Math.max(0.06, 0.5 - dist * 0.25);
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const CORNER_OFFSETS = {
    tr: function (w, h) { return { x: w * 0.86, y: h * 0.16 }; },
    tl: function (w, h) { return { x: w * 0.14, y: h * 0.16 }; },
    br: function (w, h) { return { x: w * 0.86, y: h * 0.84 }; },
    bl: function (w, h) { return { x: w * 0.14, y: h * 0.84 }; }
  };

  function drawCarbonNetwork(ctx, w, h, opts) {
    const placement = opts.placement || 'bleed';
    if (placement === 'corner') {
      const c = (CORNER_OFFSETS[opts.corner || 'tr'])(w, h);
      drawHexNodes(ctx, w, h, opts.color, opts.alpha, opts.seed, [
        { x: c.x, y: c.y, sx: w * 0.22, sy: h * 0.24, n: 22 }
      ]);
    } else if (placement === 'band') {
      drawHexNodes(ctx, w, h, opts.color, opts.alpha, opts.seed, [
        { x: w * 0.5, y: h * 1.02, sx: w * 0.48, sy: h * 0.16, n: 30 }
      ]);
    } else { // 'bleed'
      drawHexNodes(ctx, w, h, opts.color, opts.alpha, opts.seed, [
        { x: w * 0.28, y: h * 0.32, sx: w * 0.30, sy: h * 0.32, n: 15 },
        { x: w * 0.74, y: h * 0.68, sx: w * 0.32, sy: h * 0.30, n: 15 }
      ]);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────
  const RENDERERS = {
    'bamboo-grove': drawBambooGrove,
    'carbon-network': drawCarbonNetwork,
    'horizon-hills': drawHorizonHills
  };

  function render(ctx, w, h, opts) {
    const fn = RENDERERS[opts.type];
    if (!fn) { throw new Error('BBMotifs: unknown type "' + opts.type + '"'); }
    ctx.clearRect(0, 0, w, h);
    fn(ctx, w, h, opts);
  }

  // Sizes the canvas to its parent at device pixel ratio, resolves
  // avoidElement into avoidX on every draw (so it stays correct across
  // reflow/resize), and redraws. Returns a live-updatable handle.
  function attach(canvas, initialOpts) {
    const opts = Object.assign({ color: '#3E6448', alpha: 0.06, seed: 1 }, initialOpts);

    function draw() {
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const dpr = global.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const runOpts = Object.assign({}, opts);
      if (opts.avoidElement) {
        runOpts.avoidX = avoidXFromElement(canvas, opts.avoidElement, opts.avoidPad);
      }
      render(ctx, rect.width, rect.height, runOpts);
    }

    draw();

    let resizeTimer;
    const onResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 120);
    };
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(canvas.parentElement);
    global.addEventListener('resize', onResize);

    return {
      redraw: draw,
      update: function (patch) { Object.assign(opts, patch); draw(); },
      destroy: function () {
        if (ro) ro.disconnect();
        global.removeEventListener('resize', onResize);
      }
    };
  }

  global.BBMotifs = { render: render, attach: attach, avoidXFromElement: avoidXFromElement };
})(window);
