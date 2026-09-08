/*!
 * Bombay Bioworks shared site behaviour v1.0
 * Theme, navigation, scroll reveal, and the data modules that need JS.
 * Every enhancement here degrades to a fully visible, usable page if it
 * never runs. Nothing is hidden by JS that JS alone can bring back.
 */
(function () {
  'use strict';

  var body = document.body;
  var root = document.documentElement;
  var motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Theme ──────────────────────────────────────────────── */
  var FOREST = '#3E6448', LEAF = '#6BA870', STEEL = '#5C9AB8';
  var motifs = [];

  if (root.getAttribute('data-boot-theme') === 'dark') body.classList.add('dark');
  root.removeAttribute('data-boot-theme');

  function isDark() { return body.classList.contains('dark'); }

  function paintMotifs() {
    var dark = isDark();
    motifs.forEach(function (m) {
      m.handle.update({
        color: dark ? (m.hue === 'steel' ? STEEL : LEAF)
                    : (m.hue === 'steel' ? STEEL : FOREST),
        alpha: dark ? m.alphaDark : m.alphaLight
      });
    });
  }

  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    var syncLabel = function () {
      toggle.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    };
    syncLabel();
    toggle.addEventListener('click', function () {
      var dark = body.classList.toggle('dark');
      try { localStorage.setItem('bb-theme', dark ? 'dark' : 'light'); } catch (e) {}
      syncLabel();
      paintMotifs();
    });
  }

  /* ── Mobile navigation ──────────────────────────────────── */
  var navBtn = document.getElementById('navToggle');
  var navPanel = document.getElementById('navPanel');
  if (navBtn && navPanel) {
    var setNav = function (open) {
      body.classList.toggle('nav-open', open);
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      navPanel.hidden = !open;
    };
    setNav(false);
    navBtn.addEventListener('click', function () {
      setNav(navBtn.getAttribute('aria-expanded') !== 'true');
    });
    navPanel.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navBtn.getAttribute('aria-expanded') === 'true') {
        setNav(false); navBtn.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setNav(false);
    });
  }

  /* Mark the current page in the nav */
  var here = location.pathname.replace(/\/$/, '').split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    if (a.getAttribute('data-nav') === here.replace('.html', '')) {
      a.classList.add('is-here');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ── Background motifs ──────────────────────────────────── */
  document.querySelectorAll('[data-motif]').forEach(function (canvas) {
    if (!window.BBMotifs) return;
    var type = canvas.getAttribute('data-motif');
    var hue = canvas.getAttribute('data-hue') || 'forest';
    var aL = parseFloat(canvas.getAttribute('data-alpha-light') || '0.055');
    var aD = parseFloat(canvas.getAttribute('data-alpha-dark') || '0.11');
    var avoidSel = canvas.getAttribute('data-avoid');
    var opts = {
      type: type,
      seed: parseInt(canvas.getAttribute('data-seed') || '41', 10),
      color: isDark() ? (hue === 'steel' ? STEEL : LEAF) : (hue === 'steel' ? STEEL : FOREST),
      alpha: isDark() ? aD : aL
    };
    if (canvas.hasAttribute('data-hills')) opts.hills = canvas.getAttribute('data-hills') !== 'false';
    if (canvas.hasAttribute('data-placement')) opts.placement = canvas.getAttribute('data-placement');
    if (canvas.hasAttribute('data-corner')) opts.corner = canvas.getAttribute('data-corner');
    if (avoidSel) {
      var el = document.querySelector(avoidSel);
      if (el) opts.avoidElement = el;
    }
    motifs.push({ handle: window.BBMotifs.attach(canvas, opts), hue: hue, alphaLight: aL, alphaDark: aD });
  });

  /* ── Scale visual: build the dot grid from data ─────────── */
  document.querySelectorAll('[data-scale]').forEach(function (el) {
    var total = parseInt(el.getAttribute('data-scale'), 10) || 0;
    var on = parseInt(el.getAttribute('data-scale-on') || total, 10);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < total; i++) {
      var d = document.createElement('span');
      d.className = 'bb-scale-dot' + (i < on ? ' on' : '');
      frag.appendChild(d);
    }
    el.appendChild(frag);
  });

  /* ── Reveal on scroll ───────────────────────────────────── */
  var revealables = document.querySelectorAll('.bb-reveal, .bb-cmp-row');
  if (!motionOK || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        /* Stagger sibling comparison rows so the bars cascade */
        var delay = 0;
        if (el.classList.contains('bb-cmp-row')) {
          var sibs = Array.prototype.slice.call(el.parentNode.children);
          delay = sibs.indexOf(el) * 110;
        }
        setTimeout(function () { el.classList.add('in'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── Footer year ────────────────────────────────────────── */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
