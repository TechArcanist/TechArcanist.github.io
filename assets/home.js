/* Signature homepage
   1. hero: particle field that swirls around the cursor AND a diff-drive robot.
      Click empty space: the robot plans the shortest path around the text (A*) and drives there.
      Click on text: the robot launches a drone that flies there, scans and returns.
      Ambient: a rocket flight, then a drone that lifts a CanSat and drops it under a parachute.
   2. an endless flight through every project and lesson (not tied to scrolling) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACC = '90,180,255';
  function readAccent() {
    var h = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    if (h.length === 6) ACC = parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  }
  readAccent();
  new MutationObserver(function () { setTimeout(readAccent, 30); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var angDiff = function (a, b) { var d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  /* ---------------------------------------------------------------- local clock */
  var clock = $('#sig-clock');
  if (clock) {
    var tick = function () { try { clock.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }); } catch (e) {} };
    tick(); setInterval(tick, 20000);
  }

  /* ================================================================ 1. HERO */
  (function () {
    var hero = $('.sig'), fcv = $('#field2'), cv = $('#rig');
    if (!hero || !cv || !fcv) return;
    var g = fcv.getContext('2d'), ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, visible = true, raf = 0, t0 = performance.now(), last = t0;
    var BLUE = '90,180,255', INK = '238,243,250', MINT = '102,227,176', ORANGE = '255,138,61', VIOLET = '201,167,255';
    var PX = 160;                                         // 160 px on screen = 1 m
    var bandTop = 0, bandBot = 0;                         // free strip above the name on narrow screens

    /* ---------- particle field with several attractors ---------- */
    var parts = [], COLS = ['90,180,255', '102,227,176', '255,138,61', '201,167,255', '238,243,250'];
    var mouse = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, inside: false };
    function buildField() {
      parts = [];
      var step = W < 700 ? 34 : 26, seed = 11;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var y = step / 2; y < H; y += step) for (var x = step / 2; x < W; x += step) {
        var c = rnd();
        parts.push({ hx: x + (rnd() - .5) * step * .8, hy: y + (rnd() - .5) * step * .8, x: x, y: y, a: rnd() * 6.28,
          col: c < .55 ? 0 : c < .75 ? 1 : c < .87 ? 2 : c < .95 ? 3 : 4, len: 2.5 + rnd() * 3.5, ph: rnd() * 6.28, sp: .4 + rnd() * .8 });
      }
    }
    function drawField(t, atts) {
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var tx = p.hx + Math.sin(t * p.sp + p.ph) * 2.2, ty = p.hy + Math.cos(t * p.sp * .8 + p.ph) * 2.2;
        var ang = p.a + t * .15, best = 0, alpha = .16, size = 1;
        for (var k = 0; k < atts.length; k++) {
          var A = atts[k], dx = p.hx - A.x, dy = p.hy - A.y, d2 = dx * dx + dy * dy;
          if (d2 > A.r * A.r) continue;
          var d = Math.sqrt(d2) || 1, inf = 1 - d / A.r, ring = A.r * .62;
          var push = (ring - d) * inf * .55, sw = inf * inf * 18;
          tx += dx / d * push - dy / d * sw; ty += dy / d * push + dx / d * sw;
          if (inf > best) { best = inf; ang = Math.atan2(dy, dx) + Math.PI / 2; }
        }
        if (best) { alpha = .16 + best * .75; size = 1 + best * 1.4; }
        p.x += (tx - p.x) * .12; p.y += (ty - p.y) * .12;
        var L = p.len * size, ca = Math.cos(ang) * L * .5, sa = Math.sin(ang) * L * .5;
        g.strokeStyle = 'rgba(' + (p.col === 0 ? ACC : COLS[p.col]) + ',' + alpha.toFixed(3) + ')'; g.lineWidth = 1 + best * .8;
        g.beginPath(); g.moveTo(p.x - ca, p.y - sa); g.lineTo(p.x + ca, p.y + sa); g.stroke();
      }
    }

    /* ---------- drawing helpers ---------- */
    function label(txt, x, y, a, col) { if (W < 860) return; ctx.font = '10px "Geist Mono",ui-monospace,monospace'; ctx.fillStyle = 'rgba(' + (col || INK) + ',' + a + ')'; ctx.fillText(txt, x, y); }
    function arrow(x1, y1, x2, y2, col, a) {
      var an = Math.atan2(y2 - y1, x2 - x1);
      ctx.strokeStyle = ctx.fillStyle = 'rgba(' + col + ',' + a + ')'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 7 * Math.cos(an - .45), y2 - 7 * Math.sin(an - .45)); ctx.lineTo(x2 - 7 * Math.cos(an + .45), y2 - 7 * Math.sin(an + .45)); ctx.closePath(); ctx.fill();
    }

    /* ---------- obstacles (the text) and A* path planning ---------- */
    var C = 14, gw = 0, gh = 0, blocked = null, rects = [];
    function obstacles() {
      var hr = hero.getBoundingClientRect();
      rects = $$('.sig-name span, .sig-line, .sig-sub, .sig-btn, .sig-hint, .sig-meta p', hero).map(function (el) {
        var r = el.getBoundingClientRect(); return { l: r.left - hr.left, t: r.top - hr.top, r: r.right - hr.left, b: r.bottom - hr.top };
      }).filter(function (r) { return r.r > r.l && r.b > r.t; });
      gw = Math.ceil(W / C); gh = Math.ceil(H / C); blocked = new Uint8Array(gw * gh);
      var pad = 30, edge = 26;
      for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
        var px = x * C + C / 2, py = y * C + C / 2, b = px < edge || py < edge + 20 || px > W - edge || py > H - edge;
        for (var i = 0; !b && i < rects.length; i++) { var r = rects[i]; if (px > r.l - pad && px < r.r + pad && py > r.t - pad && py < r.b + pad) b = true; }
        blocked[y * gw + x] = b ? 1 : 0;
      }
    }
    function inText(x, y) { for (var i = 0; i < rects.length; i++) { var r = rects[i]; if (x > r.l - 4 && x < r.r + 4 && y > r.t - 4 && y < r.b + 4) return true; } return false; }
    function cellOf(x, y) { return [clamp(Math.floor(x / C), 0, gw - 1), clamp(Math.floor(y / C), 0, gh - 1)]; }
    function nearestFree(cx, cy) {
      if (!blocked[cy * gw + cx]) return [cx, cy];
      for (var r = 1; r < Math.max(gw, gh); r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < gw && y < gh && !blocked[y * gw + x]) return [x, y];
      }
      return [cx, cy];
    }
    function los(x0, y0, x1, y1) {
      var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (C / 2));
      for (var i = 1; i < n; i++) { var c = cellOf(lerp(x0, x1, i / n), lerp(y0, y1, i / n)); if (blocked[c[1] * gw + c[0]]) return false; }
      return true;
    }
    function astar(sx, sy, gx, gy) {
      var s = nearestFree.apply(null, cellOf(sx, sy)), e = nearestFree.apply(null, cellOf(gx, gy));
      var S = s[1] * gw + s[0], E = e[1] * gw + e[0], N = gw * gh;
      var gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
      function h(i) { var dx = Math.abs(i % gw - e[0]), dy = Math.abs((i / gw | 0) - e[1]); return Math.max(dx, dy) + .414 * Math.min(dx, dy); }
      function push(i, f) { heap.push([f, i]); var k = heap.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var tmp = heap[p]; heap[p] = heap[k]; heap[k] = tmp; k = p; } }
      function pop() { var top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; var tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp; k = m; } } return top; }
      gs[S] = 0; push(S, h(S));
      var DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
      while (heap.length) {
        var cur = pop()[1]; if (closed[cur]) continue; closed[cur] = 1;
        if (cur === E) break;
        var cx = cur % gw, cy = cur / gw | 0;
        for (var k = 0; k < 8; k++) {
          var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1]; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          var ni = ny * gw + nx; if (blocked[ni] || closed[ni]) continue;
          if (k > 3 && (blocked[cy * gw + nx] || blocked[ny * gw + cx])) continue;   // no corner cutting
          var ng = gs[cur] + DIRS[k][2];
          if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; push(ni, ng + h(ni)); }
        }
      }
      if (from[E] < 0 && E !== S) return null;
      var pts = [], i = E;
      while (i >= 0) { pts.push([i % gw * C + C / 2, (i / gw | 0) * C + C / 2]); if (i === S) break; i = from[i]; }
      pts.reverse(); pts[0] = [sx, sy];
      // string pulling: keep only the corners that are needed
      var out = [pts[0]], a = 0;
      while (a < pts.length - 1) { var b = pts.length - 1; while (b > a + 1 && !los(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--; out.push(pts[b]); a = b; }
      return out;
    }

    /* ---------- the robot ---------- */
    var bot = { x: 0, y: 0, th: 0, v: 0, w: 0, mode: 'patrol', pt: 0, route: null, wp: 1, goal: null, wait: 0, trail: [] };
    function patrolPose(t) {
      var mob = W < 860, cx = mob ? W * .5 : W * .7, cy = mob ? (bandTop + bandBot) / 2 : H * .42;
      var ax = mob ? W * .3 : Math.min(W * .18, 300), ay = mob ? Math.max(14, (bandBot - bandTop) / 2 - 34) : Math.min(H * .2, 170), w = .32;
      var x = cx + ax * Math.sin(t * w), y = cy + ay * Math.sin(2 * t * w), dx = ax * w * Math.cos(t * w), dy = 2 * ay * w * Math.cos(2 * t * w);
      var ddx = -ax * w * w * Math.sin(t * w), ddy = -4 * ay * w * w * Math.sin(2 * t * w), v = Math.hypot(dx, dy);
      return { x: x, y: y, th: Math.atan2(dy, dx), v: v, w: (dx * ddy - dy * ddx) / (v * v || 1) };
    }
    function goTo(x, y) {
      obstacles();
      var r = astar(bot.x, bot.y, x, y); if (!r || r.length < 2) return false;
      bot.route = r; bot.wp = 1; bot.goal = r[r.length - 1]; bot.mode = 'goto'; bot.routeAge = 0; return true;
    }
    function stepBot(dt, t) {
      if (bot.mode === 'patrol') {
        bot.pt += dt; var p = patrolPose(bot.pt);
        bot.x = p.x; bot.y = p.y; bot.th = p.th; bot.v = p.v; bot.w = p.w;
      } else if (bot.mode === 'goto' || bot.mode === 'return') {
        var wp = bot.route[bot.wp], dx = wp[0] - bot.x, dy = wp[1] - bot.y, d = Math.hypot(dx, dy);
        var want = Math.atan2(dy, dx), err = angDiff(bot.th, want);
        var w = clamp(err * 5, -3.2, 3.2), v = 230 * Math.max(.15, Math.cos(clamp(err, -1.5, 1.5)));
        if (bot.wp === bot.route.length - 1) v *= clamp(d / 70, .25, 1);
        bot.th += w * dt; bot.x += Math.cos(bot.th) * v * dt; bot.y += Math.sin(bot.th) * v * dt; bot.v = v; bot.w = w;
        if (d < 10) {
          if (bot.wp < bot.route.length - 1) bot.wp++;
          else if (bot.mode === 'goto') { bot.mode = 'hold'; bot.wait = 2.4; bot.v = bot.w = 0; }
          else {   // back on the patrol loop: turn smoothly onto it
            bot.mode = 'patrol';
          }
        }
      } else if (bot.mode === 'hold') {
        bot.v = bot.w = 0; bot.wait -= dt;
        if (bot.wait <= 0 && !drone) {   // rejoin the patrol loop where it was left
          obstacles(); var p2 = patrolPose(bot.pt), r = astar(bot.x, bot.y, p2.x, p2.y);
          if (r && r.length > 1) { bot.route = r; bot.wp = 1; bot.goal = null; bot.mode = 'return'; } else bot.mode = 'patrol';
        }
      } else if (bot.mode === 'drone') { bot.v = bot.w = 0; }
      bot.trail.push([bot.x, bot.y]); if (bot.trail.length > 240) bot.trail.shift();
    }
    function drawRoute() {
      if (!bot.route || bot.mode === 'patrol') return;
      ctx.setLineDash([5, 6]); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(' + MINT + ',.6)';
      ctx.beginPath(); ctx.moveTo(bot.x, bot.y);
      for (var i = bot.wp; i < bot.route.length; i++) ctx.lineTo(bot.route[i][0], bot.route[i][1]);
      ctx.stroke(); ctx.setLineDash([]);
      for (var j = bot.wp; j < bot.route.length - 1; j++) { ctx.fillStyle = 'rgba(' + MINT + ',.7)'; ctx.beginPath(); ctx.arc(bot.route[j][0], bot.route[j][1], 2.5, 0, 6.283); ctx.fill(); }
      if (bot.goal && bot.mode !== 'return') {
        var gx = bot.goal[0], gy = bot.goal[1];
        ctx.strokeStyle = 'rgba(' + MINT + ',.9)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(gx, gy, 9, 0, 6.283); ctx.moveTo(gx - 15, gy); ctx.lineTo(gx - 5, gy); ctx.moveTo(gx + 5, gy); ctx.lineTo(gx + 15, gy); ctx.moveTo(gx, gy - 15); ctx.lineTo(gx, gy - 5); ctx.moveTo(gx, gy + 5); ctx.lineTo(gx, gy + 15); ctx.stroke();
        var len = 0; for (var k = 1; k < bot.route.length; k++) len += Math.hypot(bot.route[k][0] - bot.route[k - 1][0], bot.route[k][1] - bot.route[k - 1][1]);
        label('GOAL  A* ' + (len / PX).toFixed(2) + ' m  ' + (bot.route.length - 2) + ' turns', gx + 18, gy - 10, .8, MINT);
      }
    }
    function drawBot(t) {
      var tr = bot.trail; ctx.lineWidth = 1.2;
      for (var i = 2; i < tr.length; i += 2) { ctx.strokeStyle = 'rgba(' + BLUE + ',' + (i / tr.length * .4).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(tr[i - 2][0], tr[i - 2][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke(); }
      var R = bot.v / (bot.w || 1e-6);
      if (bot.mode === 'patrol' && Math.abs(R) < 420 && W >= 700) {
        var ix = bot.x - R * Math.sin(bot.th), iy = bot.y + R * Math.cos(bot.th);
        ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(' + VIOLET + ',.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(ix, iy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(' + VIOLET + ',.7)'; ctx.beginPath(); ctx.arc(ix, iy, 2.5, 0, 6.283); ctx.fill();
        label('ICR', ix + 6, iy + 3, .5, VIOLET);
      }
      if (bot.v > 5) arrow(bot.x, bot.y, bot.x + Math.cos(bot.th) * (30 + bot.v * .12), bot.y + Math.sin(bot.th) * (30 + bot.v * .12), BLUE, .85);
      ctx.save(); ctx.translate(bot.x, bot.y); ctx.rotate(bot.th); ctx.scale(1.45, 1.45);
      ctx.fillStyle = 'rgba(4,7,12,.92)'; ctx.strokeStyle = 'rgba(' + INK + ',.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-17, -14, 34, 28, 6); else ctx.rect(-17, -14, 34, 28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(' + INK + ',.9)'; ctx.fillRect(-8, -19, 16, 4); ctx.fillRect(-8, 15, 16, 4);
      ctx.strokeStyle = 'rgba(' + BLUE + ',.8)'; ctx.beginPath(); ctx.arc(-3, 0, 6, 0, 6.283); ctx.stroke();
      ctx.save(); ctx.translate(-3, 0); ctx.rotate(t * 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.restore();
      if (!drone) { ctx.strokeStyle = 'rgba(' + INK + ',.45)'; ctx.strokeRect(4, -5, 9, 10); }   // drone pad
      ctx.fillStyle = 'rgba(' + MINT + ',.95)'; ctx.beginPath(); ctx.arc(14, -8, 1.6, 0, 6.283); ctx.arc(14, 8, 1.6, 0, 6.283); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,107,107,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(bot.x + Math.cos(bot.th) * 34, bot.y + Math.sin(bot.th) * 34); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + MINT + ',.75)'; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(bot.x + Math.sin(bot.th) * 26, bot.y - Math.cos(bot.th) * 26); ctx.stroke();
      var v = bot.v / PX, w = -bot.w, lx = bot.x + 40, ly = bot.y + 44;
      var state = bot.mode === 'patrol' ? 'PATROL' : bot.mode === 'goto' ? 'NAVIGATING' : bot.mode === 'return' ? 'RETURNING' : bot.mode === 'drone' ? 'DRONE OUT' : 'ARRIVED';
      label('base_link  ' + state, lx, ly, .75);
      label('v ' + v.toFixed(2) + ' m/s   ω ' + w.toFixed(2) + ' rad/s', lx, ly + 14, .5);
      label('wheels L ' + (v - w * .2).toFixed(2) + '  R ' + (v + w * .2).toFixed(2), lx, ly + 28, .4);
    }

    /* ---------- the drone (top view, launched from the robot) ---------- */
    var drone = null;
    function launchDrone(x, y) {
      drone = { x: bot.x, y: bot.y, tx: x, ty: y, alt: 0, phase: 'up', t: 0, scan: 0 };
      bot.mode = 'drone'; bot.route = null;
    }
    function stepDrone(dt) {
      var d = drone; d.t += dt;
      if (d.phase === 'up') { d.alt = Math.min(1, d.alt + dt * 1.6); if (d.alt >= 1) d.phase = 'go'; }
      else if (d.phase === 'go' || d.phase === 'back') {
        var tx = d.phase === 'go' ? d.tx : bot.x, ty = d.phase === 'go' ? d.ty : bot.y, dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy), sp = 420 * dt;
        if (dist <= sp) { d.x = tx; d.y = ty; if (d.phase === 'go') { d.phase = 'hover'; d.t = 0; } else d.phase = 'down'; }
        else { d.x += dx / dist * sp; d.y += dy / dist * sp; }
      } else if (d.phase === 'hover') { d.scan += dt; if (d.t > 1.6) d.phase = 'back'; }
      else if (d.phase === 'down') { d.alt = Math.max(0, d.alt - dt * 1.6); if (d.alt <= 0) { drone = null; bot.mode = 'hold'; bot.wait = .8; } }
    }
    function drawDrone(t) {
      var d = drone, s = .55 + d.alt * .55;
      if (d.phase === 'go' || d.phase === 'back' || d.phase === 'hover') {   // tether line of sight to the robot
        ctx.setLineDash([2, 6]); ctx.strokeStyle = 'rgba(' + BLUE + ',.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (d.phase === 'hover') {
        for (var k = 0; k < 2; k++) {
          var rr = ((d.scan * 60 + k * 40) % 80) + 14;
          ctx.strokeStyle = 'rgba(' + MINT + ',' + (1 - rr / 94).toFixed(3) + ')'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(d.x, d.y, rr, 0, 6.283); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,' + (.35 * d.alt) + ')'; ctx.beginPath(); ctx.ellipse(d.x + 10 * d.alt, d.y + 14 * d.alt, 16 * s, 10 * s, 0, 0, 6.283); ctx.fill();
      ctx.save(); ctx.translate(d.x, d.y); ctx.scale(s, s); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(' + INK + ',.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
      [[14, 0], [-14, 0], [0, 14], [0, -14]].forEach(function (m, i) {
        ctx.strokeStyle = 'rgba(' + INK + ',.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m[0], m[1], 7, 0, 6.283); ctx.stroke();
        ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(t * (i % 2 ? 40 : -40)); ctx.strokeStyle = 'rgba(' + BLUE + ',.8)';
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.restore();
      });
      ctx.fillStyle = 'rgba(4,7,12,.95)'; ctx.fillRect(-4, -4, 8, 8); ctx.strokeStyle = 'rgba(' + MINT + ',.9)'; ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
      var st = d.phase === 'up' ? 'TAKE OFF' : d.phase === 'go' ? 'EN ROUTE' : d.phase === 'hover' ? 'SCANNING' : d.phase === 'back' ? 'RETURN TO BASE' : 'LANDING';
      label('DRONE 01  ' + st, d.x + 22, d.y - 16, .85, d.phase === 'hover' ? MINT : INK);
      label('ALT ' + (d.alt * 12).toFixed(1) + ' m', d.x + 22, d.y - 3, .5);
    }

    /* ---------- ambient flights on the right: rocket, then a drone dropping a CanSat ---------- */
    var flight = null, nextFlight = 2600, flightKind = 0;
    function startFlight() {
      var mob = W < 860;
      flight = { kind: flightKind, x0: mob ? W - 22 : W * .93, y0: mob ? bandBot : H - 30, t: 0, apo: mob ? bandTop + 30 : H * .16, drift: mob ? -10 : -.06 * W, pts: [] };
      flightKind = 1 - flightKind;
    }
    function drawRocket(dt) {
      var r = flight; r.t += dt;
      var BURN = 2.6, COAST = 1.4, DESC = 7, T = r.t, x, y, phase, climb = r.y0 - r.apo;
      if (T < BURN) { var q = T / BURN; q = q * q; x = r.x0 + r.drift * q * .6; y = r.y0 - climb * .78 * q; phase = 'burn'; }
      else if (T < BURN + COAST) { var c = (T - BURN) / COAST; c = 1 - (1 - c) * (1 - c); x = r.x0 + r.drift * (.6 + .4 * c); y = r.y0 - climb * (.78 + .22 * c); phase = 'coast'; }
      else if (T < BURN + COAST + DESC) { var d = (T - BURN - COAST) / DESC; x = r.x0 + r.drift + Math.sin(d * 6) * 6; y = r.apo + climb * .5 * d; phase = 'chute'; }
      else return false;
      var prev = r.pts.length ? r.pts[r.pts.length - 1] : [x, y + 1], ang = Math.atan2(y - prev[1], x - prev[0]);
      if (phase !== 'chute') r.pts.push([x, y]);
      var fade = phase === 'chute' ? clamp(1 - (T - BURN - COAST - DESC + 1.5) / 1.5, 0, 1) : 1;
      for (var i = 1; i < r.pts.length; i++) {
        ctx.strokeStyle = 'rgba(' + (phase === 'burn' && i > r.pts.length - 12 ? ORANGE : INK) + ',' + ((i / r.pts.length) * .5 * fade).toFixed(3) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(r.pts[i - 1][0], r.pts[i - 1][1]); ctx.lineTo(r.pts[i][0], r.pts[i][1]); ctx.stroke();
      }
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = fade;
      if (phase === 'chute') chute(0, -18, T); else ctx.rotate(ang + Math.PI / 2);
      ctx.strokeStyle = 'rgba(' + INK + ',.9)'; ctx.fillStyle = 'rgba(4,7,12,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(5, -10, 4, -4); ctx.lineTo(4, 10); ctx.lineTo(-4, 10); ctx.lineTo(-4, -4); ctx.quadraticCurveTo(-5, -10, 0, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-8, 12); ctx.lineTo(-4, 10); ctx.moveTo(4, 4); ctx.lineTo(8, 12); ctx.lineTo(4, 10); ctx.stroke();
      if (phase === 'burn') { var fl = 8 + Math.random() * 6; ctx.fillStyle = 'rgba(' + ORANGE + ',.9)'; ctx.beginPath(); ctx.moveTo(-3, 11); ctx.lineTo(0, 11 + fl); ctx.lineTo(3, 11); ctx.closePath(); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1;
      var alt = clamp((r.y0 - y) / climb, 0, 1) * 1.21, vel = phase === 'burn' ? T / BURN * 240 : phase === 'coast' ? 240 * (1 - (T - BURN) / COAST) : 6, tx = x - 128, ty = y - 6;
      label('ROCKET  T+' + T.toFixed(1) + 's', tx, ty, .75 * fade);
      label('ALT ' + alt.toFixed(2) + ' km', tx, ty + 13, .5 * fade);
      label(phase === 'burn' ? 'MOTOR BURN' : phase === 'coast' ? 'COAST TO APOGEE' : 'CHUTE DEPLOYED', tx, ty + 26, .55 * fade, phase === 'chute' ? MINT : phase === 'burn' ? ORANGE : INK);
      if (phase !== 'chute') label('VEL ' + Math.round(vel) + ' m/s', tx, ty + 39, .4 * fade);
      return true;
    }
    function chute(cx, cy, T) {
      ctx.save(); ctx.rotate(Math.sin(T * 2) * .08);
      ctx.strokeStyle = 'rgba(' + INK + ',.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy - 22, 16, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 16, cy - 22); ctx.lineTo(cx, cy); ctx.lineTo(cx + 16, cy - 22); ctx.stroke();
      ctx.restore();
    }
    function sideDrone(x, y, T, a) {
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(' + INK + ',.9)'; ctx.fillStyle = 'rgba(4,7,12,.95)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-9, -4, 18, 7, 2); else ctx.rect(-9, -4, 18, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(-20, -4); ctx.moveTo(9, -2); ctx.lineTo(20, -4); ctx.moveTo(-6, 3); ctx.lineTo(-9, 8); ctx.moveTo(6, 3); ctx.lineTo(9, 8); ctx.stroke();
      var pw = 6 + Math.abs(Math.sin(T * 60)) * 5;
      ctx.strokeStyle = 'rgba(' + BLUE + ',.85)'; ctx.beginPath(); ctx.moveTo(-20 - pw, -6); ctx.lineTo(-20 + pw, -6); ctx.moveTo(20 - pw, -6); ctx.lineTo(20 + pw, -6); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function can(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(' + INK + ',.9)'; ctx.fillStyle = 'rgba(4,7,12,.95)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-4, -6, 8, 12, 2); else ctx.rect(-4, -6, 8, 12); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + MINT + ',.9)'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawCansat(dt) {
      var f = flight; f.t += dt;
      var T = f.t, LIFT = 3.2, HOLD = .6, FALL = .7, DESC = 6.5, top = f.apo + 30, x = f.x0 + f.drift * .5;
      var dy, cy, cyv, phase;
      if (T < LIFT) { var q = T / LIFT; q = q * q * (3 - 2 * q); dy = lerp(f.y0, top, q); cy = dy + 14; phase = 'LIFTING CANSAT'; }
      else if (T < LIFT + HOLD) { dy = top; cy = top + 14; phase = 'RELEASE IN ' + (LIFT + HOLD - T).toFixed(1) + 's'; }
      else {
        var u = T - LIFT - HOLD; dy = lerp(top, f.y0, clamp(u / 3.4, 0, 1));
        if (u < FALL) { cy = top + 14 + 140 * u * u; phase = 'RELEASED'; }
        else { cy = top + 14 + 140 * FALL * FALL + (u - FALL) * 38; phase = 'CHUTE OPEN'; }
        if (u > FALL + DESC) return false;
      }
      var fadeC = clamp(1 - (T - LIFT - HOLD - FALL - DESC + 1.2) / 1.2, 0, 1), fadeD = T > LIFT + HOLD + 3.4 ? 0 : 1;
      if (fadeD) sideDrone(x, dy, T, 1);
      var cx = x + (T > LIFT + HOLD + FALL ? Math.sin(T * 1.6) * 5 : 0);
      if (T > LIFT + HOLD + FALL) { ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = fadeC; chute(0, -6, T); ctx.restore(); ctx.globalAlpha = 1; }
      if (T < LIFT + HOLD) { ctx.strokeStyle = 'rgba(' + INK + ',.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, dy + 3); ctx.lineTo(x, cy - 6); ctx.stroke(); }
      can(cx, cy, fadeC);
      var alt = clamp((f.y0 - cy) / (f.y0 - top), 0, 1) * .8, lx = x - 140, ly = cy - 4;
      label('CANSAT  ' + phase, lx, ly, .8 * fadeC, phase === 'CHUTE OPEN' ? MINT : INK);
      label('ALT ' + alt.toFixed(2) + ' km   TLM OK', lx, ly + 13, .5 * fadeC);
      if (fadeD && T < LIFT + HOLD) label('DRONE 02  CARRY', x + 26, dy - 8, .6);
      return true;
    }

    /* ---------- loop ---------- */
    function size() {
      var r = hero.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
      [fcv, cv].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
      g.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField(); obstacles();
      var hr0 = hero.getBoundingClientRect(), me = hero.querySelector('.sig-meta'), nm = hero.querySelector('.sig-name');
      bandTop = me ? me.getBoundingClientRect().bottom - hr0.top + 24 : H * .2;
      bandBot = nm ? nm.getBoundingClientRect().top - hr0.top - 26 : H * .5;
      if (bandBot - bandTop < 120) bandBot = bandTop + 120;
      if (bot.mode === 'patrol') { var p = patrolPose(bot.pt); bot.x = p.x; bot.y = p.y; }
      bot.trail = [];
    }
    function frame(now) {
      if (!visible) { raf = 0; return; }
      var t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
      BLUE = ACC;
      stepBot(dt, t); if (drone) stepDrone(dt);
      mouse.sx += (mouse.x - mouse.sx) * .1; mouse.sy += (mouse.y - mouse.sy) * .1;
      var atts = [{ x: bot.x, y: bot.y, r: Math.min(190, W * .16) }];
      if (mouse.inside) atts.push({ x: mouse.sx, y: mouse.sy, r: Math.min(240, W * .2) });
      if (drone) atts.push({ x: drone.x, y: drone.y, r: 90 + 50 * drone.alt });
      drawField(t, atts);
      ctx.clearRect(0, 0, W, H);
      drawRoute(); drawBot(t); if (drone) drawDrone(t);
      if (!flight && now - t0 > nextFlight) startFlight();
      if (flight && !(flight.kind === 0 ? drawRocket(dt) : drawCansat(dt))) { flight = null; nextFlight = (now - t0) + 5000; }
      raf = requestAnimationFrame(frame);
    }
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      if (!mouse.inside) { mouse.sx = mouse.x; mouse.sy = mouse.y; } mouse.inside = true;
    });
    hero.addEventListener('pointerleave', function () { mouse.inside = false; });
    hero.addEventListener('click', function (e) {
      if (e.target.closest('a,button')) return;
      var r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      obstacles();
      if (inText(x, y)) { if (!drone) launchDrone(x, y); }
      else if (!drone) goTo(x, y);
    });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf && !RM) { last = performance.now(); raf = requestAnimationFrame(frame); } }).observe(hero);
    var tmo; window.addEventListener('resize', function () { clearTimeout(tmo); tmo = setTimeout(size, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    size();
    if (!RM) raf = requestAnimationFrame(frame); else { var p0 = patrolPose(0); bot.x = p0.x; bot.y = p0.y; drawField(0, [{ x: bot.x, y: bot.y, r: 180 }]); drawBot(0); }
  })();

  /* ================================================================ 2. endless flight through the work */
  (function () {
    var sec = $('#work'), space = $('#fly-space'); if (!sec || !space) return;
    var cards = $$('.fly-card', space), N = cards.length; if (!N) return;
    var fn = $('#fly-n'), ft = $('#fly-t'), fk = $('#fly-k'), fc = $('#fly-c'), bar = $('#fly-bar');
    // A tunnel of images filling the whole frame: they stream in from the distance, come close and grow,
    // and fade before any edge could slice them. The perspective is computed here (flat 2D layers with an
    // explicit stacking order), so the browser's 3D sorting can never draw a far card over a near one.
    var RS = 1.4;   // cards are laid out 1.4x larger and scaled down, so the browser never stretches a blurry copy
    var GAP = 48, FAR = 4500, GONE = 600, FADE_IN = 2400, FADE_OUT = 520, PERSP = 1000, DEPTH = Math.max(N * GAP, FAR + GONE + 800);
    var cam = 0, speed = 0, BASE = 420, hover = -1, cur = -1, visible = false, raf = 0, last = 0, seen = 0;
    var stage = sec.querySelector('.fly-stage'), SW = 0, SH = 0, CW = 0, CH = 0, TOP = 0, BOT = 100, CY = 0, pos = [], mob = false;
    function rnd(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
    function layout() {
      SW = stage.clientWidth; SH = stage.clientHeight;
      mob = SW < 700;
      CW = mob ? 132 : 250; CH = CW * 9 / 16;
      TOP = SH * (mob ? .05 : .06); BOT = mob ? 150 : 100;
      CY = TOP + (SH - TOP - BOT) / 2;                    // vanishing point: middle of the free band
      space.style.top = CY + 'px';
      var smid = PERSP / (PERSP + 1100);
      var rx = (SW / 2) / smid, ry = ((SH - TOP - BOT) / 2) / smid;
      // more cards towards the sides in world space, so on screen they fill left, middle and right evenly
      function spot(i, k) {
        var u = rnd(i, k) * 2 - 1, v = rnd(i, k + 1) * 2 - 1;
        return { x: (u < 0 ? -1 : 1) * Math.pow(Math.abs(u), .75) * rx, y: (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), .85) * ry };
      }
      // how far a spot is from the cards just before and after it in depth (they fly in together), in card sizes
      function clear(i, p) {
        var m = 1e9, q, d, j;
        for (d = 1; d <= 16; d++) {
          j = i - d; if (j >= 0) { q = pos[j]; m = Math.min(m, Math.max(Math.abs(p.x - q.x) / CW, Math.abs(p.y - q.y) / CH)); }
          j = i + d - N; if (j >= 0 && j < i) { q = pos[j]; m = Math.min(m, Math.max(Math.abs(p.x - q.x) / CW, Math.abs(p.y - q.y) / CH)); }
        }
        return m;
      }
      pos = [];
      for (var i = 0; i < N; i++) {
        var p = spot(i, 1), ps = clear(i, p);
        for (var t = 0; t < 24 && ps < 1.5; t++) { var c = spot(i, 11 + 2 * t), cs = clear(i, c); if (cs > ps) { p = c; ps = cs; } }
        p.z = -i * GAP - rnd(i, 3) * GAP * .6;
        pos.push(p);
      }
    }
    layout();
    var lt; window.addEventListener('resize', function () { clearTimeout(lt); lt = setTimeout(layout, 150); });
    function hide(c) { if (c._v) { c.style.visibility = 'hidden'; c.style.willChange = 'auto'; c._v = false; c._b = -1; c._o = -1; c._z = null; } }
    function frame(now) {
      if (!visible) { raf = 0; return; }
      var dt = Math.min(.05, (now - last) / 1000 || 0); last = now; seen += dt;
      speed = lerp(speed, BASE, .06);   // constant flow; hovering only names the card
      cam += speed * dt;
      var best = -1, bestD = 1e9, K = Math.floor(cam / DEPTH) * DEPTH;
      for (var i = 0; i < N; i++) {
        var q = pos[i], c = cards[i];
        if (mob && i % 2) { hide(c); continue; }          // phones: half the cards, half the work
        var tot = q.z + cam, lap = Math.floor(tot / DEPTH), rel = tot - lap * DEPTH - DEPTH + GONE + 40;
        if (rel < -FAR || rel > GONE) { hide(c); continue; }
        var s = PERSP / (PERSP - rel), cx = SW / 2 + q.x * s, cy = CY + q.y * s, hw = CW / 2 * s, hh = CH / 2 * s;
        var room = Math.min(cx - hw, SW - cx - hw, cy - hh - TOP, SH - BOT - cy - hh);
        var op = Math.min(1, (rel + FAR) / FADE_IN, (GONE - rel) / FADE_OUT, room / 90);
        if (op < .03) { hide(c); continue; }
        c.style.transform = 'translate3d(' + (q.x * s).toFixed(1) + 'px,' + (q.y * s).toFixed(1) + 'px,0) scale(' + (s / RS).toFixed(4) + ')';
        // nearer always on top; this number only changes when a card loops round, so the browser
        // is not asked to re-sort the stack on every frame
        var zi = Math.round(q.z - lap * DEPTH + K + 2 * DEPTH);
        if (c._z !== zi) { c._z = zi; c.style.zIndex = zi; }
        // far away: dim in from the dark (it sits behind everything nearer, so it can never hide one);
        // close up or near an edge: turn see-through, so a fading card never leaves a dark block over others
        var dim = Math.min(1, (rel + FAR) / FADE_IN), out = Math.min(1, (GONE - rel) / FADE_OUT, room / 90);
        var b = Math.round(dim * 20) / 20, o = Math.round(out * 20) / 20;
        if (mob) { o = Math.min(o, b); b = 1; }               // phones: plain opacity, no filters to recompute
        if (c._b !== b) { c._b = b; c.style.filter = b < 1 ? 'brightness(' + (.1 + .9 * b).toFixed(2) + ')' : ''; }
        var oo = b < .25 ? Math.min(o, b / .25) : o;
        if (c._o !== oo) { c._o = oo; c.style.opacity = oo < 1 ? oo.toFixed(2) : '1'; }
        if (!c._v) { c.style.visibility = 'visible'; c.style.willChange = 'transform'; c._v = true; }
        var dz = Math.abs(rel + 900); if (dz < bestD && op > .6) { bestD = dz; best = i; }
      }
      show(hover >= 0 ? hover : best);
      bar.style.width = ((cam % DEPTH) / DEPTH * 100) + '%';
      raf = requestAnimationFrame(frame);
    }
    function pad(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }
    function show(i) {
      if (i === cur || i < 0) return;
      if (cur >= 0) cards[cur].classList.remove('cur');
      cur = i; cards[i].classList.add('cur');
      fn.textContent = pad(i + 1); ft.textContent = cards[i].dataset.t; fk.textContent = cards[i].dataset.k; fc.textContent = i + 1;
    }
    cards.forEach(function (c, i) {
      c.addEventListener('pointerenter', function () { hover = i; show(i); });
      c.addEventListener('pointerleave', function () { hover = -1; });
    });
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting && !RM;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!es[0].isIntersecting) seen = 0;
    }, { threshold: .2 }).observe(sec);
    if (RM) cards.slice(0, 12).forEach(function (c, i) { c.style.visibility = 'visible'; var s = PERSP / (PERSP + 600 + i * 200); c.style.zIndex = 100 - i; c.style.transform = 'translate3d(' + pos[i].x * s + 'px,' + pos[i].y * s + 'px,0) scale(' + s / RS + ')'; });
  })();
})();
