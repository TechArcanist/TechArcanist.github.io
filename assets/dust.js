/* Dust "currents" behind the homepage, after the hero.
   Dots sit on a jittered 9px grid but are kept only inside three meandering vertical streams that run
   down the whole page, thinning towards each stream's edge, with a little stray dust between them.
   They drift slowly down their stream, fade near text blocks, and part around the cursor. */
(function () {
  'use strict';
  var cv = document.getElementById('dots'), hero = document.querySelector('.sig');
  if (!cv) return;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, span = 1, raf = 0, last = 0, clockT = 0;
  var PAD = 0, CHT = 0, BASE = 0, ORG = -1, SPANH = 0;   // canvas is part of the page: viewport plus spare room above and below
  var P = null, n = 0, regions = [], mx = -1e4, my = -1e4, heroH = 0, ACC = '90,180,255';
  var LOW = matchMedia('(pointer:coarse), (max-width:700px)').matches, flip = false;
  var CELL = 9, SPEEDS = [12, 14.7, 17.3, 20], NB = 16, buckets = [];
  for (var b0 = 0; b0 <= NB; b0++) buckets.push([]);
  function clamp(v, a, c) { return Math.max(a, Math.min(c, v)); }
  function readAccent() {
    var h = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    if (h.length === 6) ACC = parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }
  readAccent();
  new MutationObserver(function () { setTimeout(readAccent, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function hash(a, c) { var h = Math.imul(a, 374761393) + Math.imul(c, 668265263) + 0x9e3779b9 | 0; h = Math.imul(h ^ h >>> 13, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function centre(k, y) {
    var w = Math.max(W, 360);
    if (k === 0) return w * .18 + Math.sin(y * .0036 + .9) * w * .15 + Math.sin(y * .0012 + .3) * w * .06;
    if (k === 1) return w * .55 + Math.sin(y * .0029 + 3.6) * w * .17 + Math.sin(y * .0010 + 2.0) * w * .07;
    return w * .87 + Math.sin(y * .0041 + 5.2) * w * .13 + Math.sin(y * .0013 + 1.1) * w * .05;
  }
  function half(k, y) { return (W < 700 ? 70 : 140) + Math.sin(y * .0006 + k * 2.1) * 22; }
  function readRegions() {
    var sy = scrollY;
    regions = [].slice.call(document.querySelectorAll('.sh, .case, .caps, .series-rows, .chron, .grid3, .stack, .clist, .fly-hud, .now')).map(function (el) {
      var r = el.getBoundingClientRect(); return { x: r.left, y: r.top + sy, w: r.width, h: r.height };
    }).filter(function (r) { return r.w > 0 && r.h > 0; });
    heroH = hero ? hero.getBoundingClientRect().bottom + sy : 0;
  }
  function attenuation(x, y) {
    var a = 1, F = 150;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i], dx = Math.max(r.x - x, 0, x - r.x - r.w), dy = Math.max(r.y - y, 0, y - r.y - r.h);
      if (dx > F || dy > F) continue;
      var s = clamp(Math.hypot(dx, dy) / F, 0, 1); s = s * s * (3 - 2 * s);
      var v = .4 + .6 * s; if (v < a) a = v;
    }
    return a;
  }
  function build() {
    W = innerWidth; H = innerHeight; dpr = Math.min(LOW ? 2 : 1.5, devicePixelRatio || 1);
    PAD = Math.round(H * (LOW ? .6 : .3)); CHT = H + 2 * PAD;
    cv.style.transform = 'none'; cv.style.height = CHT + 'px'; ORG = -1;
    cv.width = W * dpr; cv.height = CHT * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    span = Math.max(H, document.documentElement.scrollHeight);
    BASE = cv.getBoundingClientRect().top + scrollY; SPANH = span;
    readRegions();
    var cols = Math.ceil(W / CELL) + 2, rows = Math.ceil(span / CELL) + 2, cap = W < 700 ? 22000 : 46000, list = [];
    for (var cy = 0; cy < rows; cy++) for (var cx = -1; cx < cols; cx++) {
      var x = cx * CELL + hash(cx, cy * 3 + 11) * CELL, y = cy * CELL + hash(cx * 5 + 3, cy) * CELL;
      var best = 0, bd = 1e9;
      for (var k = 0; k < 3; k++) { var d = Math.abs(x - centre(k, y)); if (d < bd) { bd = d; best = k; } }
      var q = bd / half(best, y), keep = q < 1 ? .92 * Math.exp(-q * q * 2.2) : .035 * Math.exp(-(q - 1) * 1.5);
      if (hash(cx * 197 + 5, cy * 211 + 7) > keep) continue;
      var sc = Math.min(3, Math.floor(hash(cx * 13 + 7, cy * 17 + 3) * 4)), tw = hash(cx * 71 + 5, cy * 73 + 9);
      list.push(y, best, x - centre(best, y), SPEEDS[sc], tw < .08 ? tw * 80 : -1,
                .55 + .45 * hash(cx * 31 + 1, cy * 37 + 2), hash(cx * 257 + 17, cy * 263 + 23) < .2 ? 1.4 : 2);
    }
    var stride = 7, total = list.length / stride, ratio = total > cap ? cap / total : 1;
    P = new Float32Array(Math.ceil(total * ratio + 8) * 9); n = 0;
    for (var i = 0; i < total; i++) {
      if (ratio < 1 && hash(i, 991) > ratio) continue;
      var o = i * stride, j = n * 9;
      for (var f = 0; f < 7; f++) P[j + f] = list[o + f];
      P[j + 7] = 0; P[j + 8] = 0;   // cursor push offset
      n++;
    }
  }
  function frame(now) {
    if (LOW && (flip = !flip)) { raf = requestAnimationFrame(frame); return; }
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (!RM) clockT += dt;
    // The canvas scrolls with the page (the phone moves it smoothly on its own); here we only redraw it and
    // shift it so it always covers the screen with room to spare, never past the end of the page.
    var sy = scrollY, org = Math.round(Math.max(0, Math.min(sy - PAD, SPANH - CHT)));
    if (org !== ORG) { ORG = org; cv.style.transform = 'translate3d(0,' + (org - BASE) + 'px,0)'; }
    ctx.clearRect(0, 0, W, CHT);
    if (P && heroH < org + CHT + 40) {
      for (var b = 0; b <= NB; b++) buckets[b].length = 0;
      var top = org - 6, bot = org + CHT + 6, R = 120, R2 = R * R;
      for (var i = 0; i < n; i++) {
        var j = i * 9, y = ((P[j] + clockT * P[j + 3]) % span + span) % span;
        if (y < top || y > bot || y < heroH - 40) continue;
        var x = centre(P[j + 1], y) + P[j + 2], vy = y - org;
        var dx = x + P[j + 7] - mx, dy = y - sy + P[j + 8] - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) { var d = Math.sqrt(d2) || 1, fo = (1 - d / R) * 20; P[j + 7] += (dx / d * fo - P[j + 7]) * .12; P[j + 8] += (dy / d * fo - P[j + 8]) * .12; }
        else if (P[j + 7] || P[j + 8]) { P[j + 7] *= .92; P[j + 8] *= .92; if (Math.abs(P[j + 7]) + Math.abs(P[j + 8]) < .05) P[j + 7] = P[j + 8] = 0; }
        var a = P[j + 5] * attenuation(x, y);
        if (P[j + 4] >= 0) a *= .45 + .55 * (.5 + .5 * Math.sin(clockT * 2.2 + P[j + 4]));
        if (y - heroH < 260) a *= clamp((y - heroH + 40) / 300, 0, 1);   // fade in below the hero
        var bk = Math.round(a * NB); if (bk <= 0) continue;
        buckets[bk].push(x + P[j + 7], vy + P[j + 8], P[j + 6]);
      }
      for (var k = 1; k <= NB; k++) {
        var arr = buckets[k]; if (!arr.length) continue;
        ctx.fillStyle = 'rgba(' + ACC + ',' + (k / NB).toFixed(3) + ')';
        for (var m = 0; m < arr.length; m += 3) ctx.fillRect(arr[m], arr[m + 1], arr[m + 2], arr[m + 2]);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', function () { mx = my = -1e4; });
  var tmo; function rebuild() { clearTimeout(tmo); tmo = setTimeout(build, 200); }
  addEventListener('resize', rebuild); addEventListener('load', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  build(); raf = requestAnimationFrame(frame);
})();
