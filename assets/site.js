(function () {
  'use strict';
  var d = document, root = d.documentElement, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || d).querySelectorAll(s)); }

  // theme
  var th = $('#theme');
  th && th.addEventListener('click', function () {
    var n = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = n;
    try { localStorage.setItem('ta-theme', n); } catch (e) {}
  });

  // mobile nav
  var tg = $('#nav-tg'), nav = $('#nav');
  tg && tg.addEventListener('click', function () { tg.setAttribute('aria-expanded', nav.classList.toggle('open')); });

  // reader chapter list
  var rt = $('#rd-tg'), rn = $('#rd-nav');
  rt && rt.addEventListener('click', function () { rn.classList.toggle('open'); });
  if (rn) { var cur = $('[aria-current]', rn); if (cur) rn.scrollTop = cur.offsetTop - rn.clientHeight / 2; }

  // reveal
  var rv = $$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // counters
  if (!reduce && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, to = +el.dataset.to, t0 = performance.now();
        (function f(t) {
          var p = Math.min(1, (t - t0) / 1600);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))).toLocaleString('en-IN');
          if (p < 1) requestAnimationFrame(f);
        })(t0);
        co.unobserve(el);
      });
    }, { threshold: .4 });
    $$('.count[data-to]').forEach(function (el) { el.textContent = '0'; co.observe(el); });
  }

  // project grid filters
  var grid = $('#grid');
  if (grid) {
    var cards = $$('.pcard', grid), flts = $$('.flt'), q = $('#grid-q'), empty = $('#grid-empty'), cat = 'all';
    var apply = function () {
      var s = q.value.trim().toLowerCase(), n = 0;
      cards.forEach(function (c) {
        var ok = (cat === 'all' || (' ' + c.dataset.cats + ' ').indexOf(' ' + cat + ' ') > -1) && (!s || c.dataset.search.indexOf(s) > -1);
        c.hidden = !ok; n += ok ? 1 : 0;
      });
      empty.hidden = n > 0;
    };
    var set = function (k) { cat = k; flts.forEach(function (f) { f.classList.toggle('active', f.dataset.filter === k); }); apply(); };
    flts.forEach(function (f) {
      f.addEventListener('click', function () {
        set(f.dataset.filter);
        history.replaceState(null, '', f.dataset.filter === 'all' ? location.pathname : '#' + f.dataset.filter);
      });
    });
    q.addEventListener('input', apply);
    var h = location.hash.slice(1);
    if (h && $('.flt[data-filter="' + h + '"]')) set(h);
  }

  // toc active
  var toc = $('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var map = {};
    $$('a', toc).forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var to = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('a.active', toc).forEach(function (a) { a.classList.remove('active'); });
        map[e.target.id] && map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-90px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var h = d.getElementById(id); h && to.observe(h); });
  }

  // copy buttons
  $$('pre.code').forEach(function (pre) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = 'Copy';
    b.addEventListener('click', function () {
      var t = $('code', pre).innerText.replace(/^\n+/, '');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = 'Copied'; b.classList.add('done');
        setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('done'); }, 1500);
      }, function () { b.textContent = 'Select text'; });
    });
    pre.appendChild(b);
  });

  // lightbox
  var lb = $('#lightbox');
  if (lb) {
    var li = $('img', lb);
    d.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.prose figure.img img');
      if (!img) return;
      var best = img.currentSrc || img.src, max = 0;
      (img.getAttribute('srcset') || '').split(',').forEach(function (s) {
        var p = s.trim().split(/\s+/), w = parseInt(p[1], 10) || 0;
        if (w > max && w <= 2400) { max = w; best = p[0]; }
      });
      li.src = best; lb.hidden = false;
    });
    lb.addEventListener('click', function () { lb.hidden = true; li.src = ''; });
  }

  // widget iframes auto height: measure same-origin content directly, postMessage as fallback
  // auto colour match: paint the frame (and its section card) with the visualizer's own background
  function parseRGB(s) { var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null; }
  function vizBg(doc) {
    var w = doc.defaultView, W = doc.documentElement.clientWidth || 1, best = null, bestArea = 0;
    var q = [].slice.call(doc.body ? doc.body.children : []), depth = 0;
    while (q.length && depth < 8) {
      var next = [];
      q.forEach(function (el) {
        if (/^(SCRIPT|STYLE|LINK|META|TITLE|NOSCRIPT)$/.test(el.tagName)) return;
        var cs = w.getComputedStyle(el), r = el.getBoundingClientRect();
        var c = parseRGB(cs.backgroundColor);
        if ((!c || c.a <= .9) && cs.backgroundImage && cs.backgroundImage.indexOf('gradient') > -1) c = parseRGB(cs.backgroundImage);   // first colour of a gradient
        if (c && c.a > .9 && r.width >= W * .5) { var area = r.width * r.height; if (area > bestArea) { bestArea = area; best = c; } }
        next = next.concat([].slice.call(el.children));
      });
      if (best) break;
      q = next; depth++;
    }
    if (best) return best;
    // transparent visualizers show the frame's own background, so match that (only a solid colour counts)
    var fb = parseRGB(w.getComputedStyle(doc.body).backgroundColor);
    return fb && fb.a > .9 ? fb : null;
  }
  function paint(f) {
    try {
      var doc = f.contentDocument; if (!doc || !doc.body) return;
      if (!doc.location || doc.location.href === 'about:blank') return;   // not loaded yet
      var c = vizBg(doc); if (!c) return;
      var col = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
      if (f.dataset.bg !== col) {
        f.dataset.bg = col;
        doc.documentElement.style.background = col; doc.body.style.background = col;
        f.style.background = col; f.style.borderColor = 'transparent';
      }
      var lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      var card = f.closest('.prose > .col, .prose .cols > .col'), wrap = f.closest('.widget') || f;
      var whole = card && lum < .35 && ownsCard(card, wrap);
      if (card) {
        // the whole section takes the visualizer's colour only when the visualizer IS the section
        // (a title, a line or two of text, then the visualizer). Otherwise only the visualizer is coloured.
        card.style.background = whole ? col : ''; card.style.borderColor = whole ? 'rgba(255,255,255,.08)' : '';
        card.classList.toggle('viz-card', !!whole);
      }
      wrap.style.background = col; wrap.classList.toggle('viz-own', !whole);
    } catch (e) {}
  }
  function ownsCard(card, wrap) {
    var rest = 0, heavy = false;
    [].forEach.call(card.children, function (el) {
      if (el === wrap || el.contains(wrap)) return;
      rest += el.offsetHeight;
      if (el.matches('pre, .codeblock, table, .table-wrap, figure, .img, .pdf, .widget, .embed, ul, ol') ||
          el.querySelector('pre, .codeblock, table, img, .widget, .embed')) heavy = true;
    });
    return !heavy && rest < Math.max(220, wrap.offsetHeight * .35);
  }
  $$('.widget iframe').forEach(function (f) {
    function fit() {
      try {
        var de = f.contentDocument && f.contentDocument.documentElement;
        if (de && de.scrollHeight) f.style.height = Math.max(200, Math.ceil(de.scrollHeight) + 2) + 'px';
      } catch (e) {}
    }
    f.addEventListener('load', function () {
      fit(); paint(f); setTimeout(function () { paint(f); }, 800);
      setInterval(function () { paint(f); }, 2000);      // follows the visualizer's own theme toggle
      try { if ('ResizeObserver' in window) new ResizeObserver(fit).observe(f.contentDocument.documentElement); } catch (e) {}
    });
    if (f.contentDocument && f.contentDocument.readyState === 'complete') { fit(); paint(f); }
  });
  addEventListener('message', function (e) {
    if (!e.data || !e.data.taWidget) return;
    $$('.widget iframe').forEach(function (f) { if (f.contentWindow === e.source) f.style.height = Math.max(200, Math.ceil(e.data.h) + 2) + 'px'; });
  });

  // command palette
  var pal = $('#palette'), pq = $('#pal-q'), pl = $('#pal-list'), data = null, sel = 0, results = [];
  function openPal() {
    pal.hidden = false; pq.value = ''; pq.focus();
    if (!data) fetch('/search.json').then(function (r) { return r.json(); }).then(function (j) { data = j; draw(); });
    else draw();
  }
  function closePal() { pal.hidden = true; }
  function score(it, terms) {
    var t = it.t.toLowerCase(), all = (it.t + ' ' + it.k + ' ' + it.d).toLowerCase(), s = 0;
    for (var i = 0; i < terms.length; i++) {
      var w = terms[i];
      if (all.indexOf(w) < 0) return -1;
      s += t.indexOf(w) === 0 ? 6 : t.indexOf(w) > -1 ? 3 : 1;
    }
    return s;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function draw() {
    if (!data) { pl.innerHTML = '<li class="none">Loading…</li>'; return; }
    var terms = pq.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    results = terms.length ? data.map(function (it) { return [score(it, terms), it]; }).filter(function (x) { return x[0] >= 0; })
      .sort(function (a, b) { return b[0] - a[0]; }).slice(0, 30).map(function (x) { return x[1]; }) : data.slice(0, 12);
    sel = 0;
    pl.innerHTML = results.length ? results.map(function (it, i) {
      return '<li' + (i === 0 ? ' class="sel"' : '') + ' role="option"><a href="' + esc(it.u) + '"' + (/^https?:/.test(it.u) ? ' target="_blank" rel="noopener"' : '') +
        '><strong>' + esc(it.t) + '</strong><em>' + esc(it.k) + '</em>' + (it.d ? '<small>' + esc(it.d) + '</small>' : '') + '</a></li>';
    }).join('') : '<li class="none">No results</li>';
  }
  function move(k) {
    var items = $$('li', pl); if (!items.length || !results.length) return;
    items[sel] && items[sel].classList.remove('sel');
    sel = (sel + k + items.length) % items.length;
    items[sel].classList.add('sel'); items[sel].scrollIntoView({ block: 'nearest' });
  }
  if (pal) {
    $$('[data-palette]').forEach(function (b) { b.addEventListener('click', openPal); });
    pq.addEventListener('input', draw);
    pal.addEventListener('click', function (e) { if (e.target === pal) closePal(); });
    d.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? openPal() : closePal(); return; }
      if (e.key === '/' && pal.hidden && !/input|textarea/i.test(d.activeElement.tagName)) { e.preventDefault(); openPal(); return; }
      if (pal.hidden) { if (e.key === 'Escape' && lb && !lb.hidden) lb.hidden = true; return; }
      if (e.key === 'Escape') closePal();
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { var a = $('li.sel a', pl); if (a) { e.preventDefault(); a.click(); } }
    });
  }

  // ================= hero particle field (reacts to the cursor) =================
  var fc = $('#field');
  if (fc && fc.getContext) {
    var g = fc.getContext('2d'), FW, FH, fdpr, parts = [], mx = -1e4, my = -1e4, tx2 = -1e4, ty2 = -1e4, inside = false, fraf, fvis = true, t0f = performance.now();
    var COLS = ['90,180,255', '102,227,176', '255,138,61', '201,167,255', '238,243,250'];
    function fbuild() {
      fdpr = Math.min(2, devicePixelRatio || 1);
      FW = fc.clientWidth; FH = fc.clientHeight;
      fc.width = FW * fdpr; fc.height = FH * fdpr; g.setTransform(fdpr, 0, 0, fdpr, 0, 0);
      parts = [];
      var step = FW < 700 ? 34 : 26, seed = 11;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var y = step / 2; y < FH; y += step) {
        for (var x = step / 2; x < FW; x += step) {
          var c = rnd();
          parts.push({ hx: x + (rnd() - .5) * step * .8, hy: y + (rnd() - .5) * step * .8, x: x, y: y, a: rnd() * 6.28,
            col: c < .55 ? 0 : c < .75 ? 1 : c < .87 ? 2 : c < .95 ? 3 : 4, len: 2.5 + rnd() * 3.5, ph: rnd() * 6.28, sp: .4 + rnd() * .8 });
        }
      }
    }
    fc.parentNode.addEventListener('pointermove', function (e) { var r = fc.getBoundingClientRect(); tx2 = e.clientX - r.left; ty2 = e.clientY - r.top; inside = true; });
    fc.parentNode.addEventListener('pointerleave', function () { inside = false; });
    function fframe(now) {
      var t = (now - t0f) / 1000;
      if (!inside) { tx2 = FW * (.62 + .22 * Math.cos(t * .23)); ty2 = FH * (.42 + .25 * Math.sin(t * .31)); }
      if (mx < -1e3) { mx = tx2; my = ty2; }
      mx += (tx2 - mx) * .08; my += (ty2 - my) * .08;
      g.clearRect(0, 0, FW, FH);
      var R = Math.min(260, FW * .22), ring = R * .62;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var dx = p.hx - mx, dy = p.hy - my, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var ox = Math.sin(t * p.sp + p.ph) * 2.2, oy = Math.cos(t * p.sp * .8 + p.ph) * 2.2;
        var targetX = p.hx + ox, targetY = p.hy + oy, ang = p.a + t * .15, alpha = .16, size = 1, inf = 0;
        if (d < R) {
          inf = 1 - d / R;                          // 1 at the cursor, 0 at the edge
          var push = (ring - d) * inf * .55;        // pull towards a ring around the cursor
          targetX += dx / d * push; targetY += dy / d * push;
          var sw = inf * inf * 18;                  // swirl along the ring
          targetX += -dy / d * sw; targetY += dx / d * sw;
          ang = Math.atan2(dy, dx) + Math.PI / 2;   // dash points along the ring
          alpha = .16 + inf * .75; size = 1 + inf * 1.4;
        }
        p.x += (targetX - p.x) * .12; p.y += (targetY - p.y) * .12;
        var L = p.len * size, ca = Math.cos(ang) * L, sa = Math.sin(ang) * L;
        g.strokeStyle = 'rgba(' + COLS[p.col] + ',' + alpha.toFixed(3) + ')';
        g.lineWidth = 1 + inf * .8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x - ca * .5, p.y - sa * .5); g.lineTo(p.x + ca * .5, p.y + sa * .5); g.stroke();
      }
      if (fvis && !reduce) fraf = requestAnimationFrame(fframe);
    }
    fbuild();
    if (reduce) fframe(performance.now()); else fraf = requestAnimationFrame(fframe);
    var frt; addEventListener('resize', function () { clearTimeout(frt); frt = setTimeout(function () { fbuild(); if (reduce) fframe(performance.now()); }, 200); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      fvis = es[0].isIntersecting; cancelAnimationFrame(fraf); if (fvis && !reduce) fraf = requestAnimationFrame(fframe);
    }).observe(fc);
  }

  // ================= cinematic homepage =================
  // headline: split into words that rise in
  var sh = $('[data-split]');
  if (sh) {
    var words = sh.textContent.trim().split(/\s+/), n = words.length;
    sh.innerHTML = words.map(function (w, i) {
      return '<span class="w' + (i >= n - 4 ? ' dim2' : '') + '"><span style="transition-delay:' + (120 + i * 55) + 'ms">' + w + '</span></span>';
    }).join(' ');
    if (reduce) root.classList.add('no-split'); else requestAnimationFrame(function () { requestAnimationFrame(function () { sh.classList.add('go'); }); });
  }
  // hero slideshow with captions
  var slides = $$('.cine-slide'), dots = $$('.cine-dots button'), cur2 = 0, timer;
  function show(i) {
    if (!slides.length) return;
    cur2 = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('on', k === cur2); });
    dots.forEach(function (d, k) {
      d.classList.remove('on'); if (k === cur2) { void d.offsetWidth; d.classList.add('on'); }
    });
    var d = dots[cur2];
    if (d) {
      var t = $('#cine-text'); t.style.opacity = 0;
      setTimeout(function () { t.textContent = d.dataset.cap; t.style.opacity = 1; }, 250);
      $('#cine-idx').textContent = (cur2 < 9 ? '0' : '') + (cur2 + 1) + ' / ' + (slides.length < 10 ? '0' : '') + slides.length;
      $('#cine-cap').href = d.dataset.link;
    }
    clearTimeout(timer); if (!reduce) timer = setTimeout(function () { show(cur2 + 1); }, 6000);
  }
  if (slides.length > 1) { dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); }); }); show(0); }

  // header turns solid after the hero; hero parallax
  var hdr = $('.hdr'), cine = $('#cine'), media = $('.cine-media');
  // pinned horizontal scroller
  var hs = $('#hs'), track = $('#hs-track'), bar = $('#hs-bar');
  // timeline fill
  var tl = $('#tline'), fill = $('#tline-fill'), tlItems = tl ? $$('.tl-i', tl) : [];
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = scrollY, vh = innerHeight;
    if (hdr && cine) hdr.classList.toggle('solid', y > cine.offsetHeight - 90);
    if (media && !reduce && y < vh * 1.2) media.style.transform = 'translate3d(0,' + (y * 0.25) + 'px,0) scale(' + (1 + y / vh * 0.06) + ')';
    if (hs && track && innerWidth > 900) {
      var r = hs.getBoundingClientRect(), total = hs.offsetHeight - vh;
      var p = Math.min(1, Math.max(0, -r.top / total));
      var max = track.scrollWidth - innerWidth;
      track.style.transform = 'translate3d(' + (-p * max) + 'px,0,0)';
      if (bar) bar.style.width = (p * 100) + '%';
    }
    if (tl && fill) {
      var tr = tl.getBoundingClientRect(), line = vh * 0.62;
      var h = Math.min(tr.height - 12, Math.max(0, line - tr.top));
      fill.style.height = h + 'px';
      tlItems.forEach(function (li) { li.classList.toggle('lit', li.getBoundingClientRect().top < line); });
    }
  }
  if (hdr && cine || hs || tl) {
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
  }

  // disciplines: floating photo follows the cursor
  var disc = $('#disc'), flo = $('#disc-float');
  if (disc && flo && matchMedia('(hover:hover) and (min-width:901px)').matches) {
    var fimg = $('img', flo), fx = 0, fy = 0, tx = 0, ty = 0, raf2;
    function loop() { fx += (tx - fx) * 0.18; fy += (ty - fy) * 0.18; flo.style.left = fx + 'px'; flo.style.top = fy + 'px'; raf2 = requestAnimationFrame(loop); }
    $$('a', disc).forEach(function (a) {
      a.addEventListener('mouseenter', function (e) {
        if (!a.dataset.img) return;
        if (fimg.getAttribute('src') !== a.dataset.img) fimg.src = a.dataset.img;
        tx = fx = e.clientX + 190; ty = fy = e.clientY;
        flo.classList.add('on'); cancelAnimationFrame(raf2); loop();
      });
      a.addEventListener('mousemove', function (e) { tx = e.clientX + 190; ty = e.clientY; });
      a.addEventListener('mouseleave', function () { flo.classList.remove('on'); setTimeout(function () { if (!flo.classList.contains('on')) cancelAnimationFrame(raf2); }, 400); });
    });
  }

  // hero: animated PCB traces with travelling signals
  var cv = $('#traces');
  if (cv && cv.getContext) {
    var cx = cv.getContext('2d'), W, H, dpr, traces = [], pulses = [], G = 28, raf, visible = true;
    function css(v) { return getComputedStyle(root).getPropertyValue(v).trim(); }
    function build() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traces = []; pulses = [];
      var cols = Math.ceil(W / G), rows = Math.ceil(H / G), n = Math.round(cols * rows / 26);
      var rnd = mulberry(7);
      for (var i = 0; i < n; i++) {
        var x = Math.floor(rnd() * cols), y = Math.floor(rnd() * rows), pts = [[x, y]], dir = rnd() < .5 ? 0 : 1, len = 3 + Math.floor(rnd() * 10);
        for (var k = 0; k < len; k++) {
          var step = 1 + Math.floor(rnd() * 3);
          if (rnd() < .35) dir = (dir + (rnd() < .5 ? 1 : 3)) % 4;
          var dx = [1, 0, -1, 0][dir], dy = [0, 1, 0, -1][dir];
          if (rnd() < .3) { dx = dx || (rnd() < .5 ? 1 : -1); dy = dy || (rnd() < .5 ? 1 : -1); }
          x += dx * step; y += dy * step; pts.push([x, y]);
        }
        var path = pts.map(function (p) { return [p[0] * G + .5, p[1] * G + .5]; });
        var L = 0; for (var j = 1; j < path.length; j++) L += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
        traces.push({ p: path, L: L });
      }
      for (var m = 0; m < Math.min(26, traces.length); m++) spawn(rnd);
    }
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function spawn(r) { var t = traces[Math.floor((r || Math.random)() * traces.length)]; pulses.push({ t: t, s: 0, v: 40 + Math.random() * 90 }); }
    function at(t, s) {
      var p = t.p, acc = 0;
      for (var j = 1; j < p.length; j++) {
        var seg = Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]);
        if (acc + seg >= s) { var k = (s - acc) / seg; return [p[j - 1][0] + (p[j][0] - p[j - 1][0]) * k, p[j - 1][1] + (p[j][1] - p[j - 1][1]) * k]; }
        acc += seg;
      }
      return p[p.length - 1];
    }
    var last = 0;
    function frame(ts) {
      var dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
      var line = css('--line-2'), acc = css('--accent');
      cx.clearRect(0, 0, W, H);
      cx.lineWidth = 1; cx.strokeStyle = line; cx.fillStyle = line;
      traces.forEach(function (t) {
        cx.beginPath(); t.p.forEach(function (q, i) { i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]); }); cx.stroke();
        var e = t.p[t.p.length - 1], b = t.p[0];
        cx.strokeRect(e[0] - 2.5, e[1] - 2.5, 5, 5);
        cx.beginPath(); cx.arc(b[0], b[1], 2, 0, 6.3); cx.fill();
      });
      pulses.forEach(function (u) {
        u.s += u.v * dt;
        if (u.s > u.t.L) { u.t = traces[Math.floor(Math.random() * traces.length)]; u.s = 0; }
        for (var k = 0; k < 10; k++) {
          var q = at(u.t, Math.max(0, u.s - k * 3));
          cx.globalAlpha = (1 - k / 10) * .9; cx.fillStyle = acc;
          cx.fillRect(q[0] - 1.2, q[1] - 1.2, 2.4, 2.4);
        }
        cx.globalAlpha = 1;
      });
      if (visible && !reduce) raf = requestAnimationFrame(frame);
    }
    build();
    if (reduce) frame(0); else raf = requestAnimationFrame(frame);
    var rt2; addEventListener('resize', function () { clearTimeout(rt2); rt2 = setTimeout(function () { build(); if (reduce) frame(0); }, 200); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting; cancelAnimationFrame(raf); if (visible && !reduce) raf = requestAnimationFrame(frame);
    }).observe(cv);
    $('#theme') && $('#theme').addEventListener('click', function () { if (reduce) frame(0); });
  }
})();
