(function () {
  'use strict';

  // Animacje lekcji 2. Każdy slajd z animacją ma wpis w ANIMS: enter / step / frame / leave.
  // Pętla rAF działa tylko dla aktywnego slajdu. Bez internetu — wszystko jest lokalne.

  if (/[?&]presenter\b/.test(location.search)) return;

  var stage = document.getElementById('stage');
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var COL = {
    grid: 'rgba(255,255,255,.045)',
    upBody: 'rgba(232,219,180,.86)', upWick: 'rgba(222,208,168,.72)',
    dnBody: 'rgba(102,106,102,.70)', dnWick: 'rgba(139,142,137,.58)',
    gold: '#dfbd68', goldDark: '#6b5c34', ink: '#f4efe3', ink2: '#cfc2a2', ink3: '#9d8f6e',
    line: '#3a3220', node: '#74c64f', no: '#e3604f', bg: '#0b0a08',
    libUp: '#26a69a', libDn: '#ef5350'
  };
  var FONT = '"Segoe UI", system-ui, sans-serif';
  var MONO = '"Cascadia Code", Consolas, monospace';

  // ---------- narzędzia ----------
  function setup(canvas) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    var k = stage.getBoundingClientRect().width / 1920 || 1;
    var ratio = Math.max(1, (window.devicePixelRatio || 1) * k);
    var W = Math.round(w * ratio), H = Math.round(h * ratio);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx: ctx, w: w, h: h, ratio: ratio };
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function walk(n, start, vol, seed) {
    var r = rng(seed), out = [], c = start;
    for (var i = 0; i < n; i++) {
      var o = c;
      c = o + (r() - 0.5 + Math.sin(i / 37) * 0.18 + Math.sin(i / 9) * 0.12) * vol;
      out.push({ o: o, h: Math.max(o, c) + r() * vol * 0.55, l: Math.min(o, c) - r() * vol * 0.55, c: c });
    }
    return out;
  }

  function aggregate(base, L) {
    var out = [];
    for (var i = 0; i + L <= base.length; i += L) {
      var o = base[i].o, c = base[i + L - 1].c, h = -Infinity, l = Infinity;
      for (var j = i; j < i + L; j++) { if (base[j].h > h) h = base[j].h; if (base[j].l < l) l = base[j].l; }
      out.push({ o: o, h: h, l: l, c: c });
    }
    return out;
  }

  function seg(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  function grid(ctx, x0, y0, w, h, nx, ny) {
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (var i = 0; i <= ny; i++) { var gy = Math.round(y0 + h * i / ny) + 0.5; seg(ctx, x0, gy, x0 + w, gy); }
    for (i = 0; i <= nx; i++) { var gx = Math.round(x0 + w * i / nx) + 0.5; seg(ctx, gx, y0, gx, y0 + h); }
  }

  function candle(ctx, x, bw, y, c, up, colors) {
    colors = colors || COL;
    ctx.strokeStyle = up ? (colors.upWick || colors.up) : (colors.dnWick || colors.dn);
    ctx.lineWidth = 1;
    seg(ctx, x, y(c.h), x, y(c.l));
    var yo = y(c.o), yc = y(c.c);
    ctx.fillStyle = up ? (colors.upBody || colors.up) : (colors.dnBody || colors.dn);
    ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.3, Math.abs(yc - yo)));
  }

  function range(cs, a, b) {
    var lo = Infinity, hi = -Infinity;
    for (var i = Math.max(0, a); i < Math.min(cs.length, b); i++) { if (cs[i].l < lo) lo = cs[i].l; if (cs[i].h > hi) hi = cs[i].h; }
    return { lo: lo, hi: hi };
  }

  function fmtInt(n) { return Math.round(n).toLocaleString('pl-PL'); }
  function ease(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function $(id) { return document.getElementById(id); }

  // ---------- rejestr i pętla ----------
  var ANIMS = [];
  var current = null, currentSlide = null, raf = 0, lastT = 0, t0 = 0;

  function loop(t) {
    raf = 0;
    if (!current) return;
    if (!t0) t0 = t;
    var dt = lastT ? Math.min(100, t - lastT) : 16;
    lastT = t;
    if (current.frame) current.frame(t - t0, dt);
    raf = requestAnimationFrame(loop);
  }

  function onSlide(slide, step) {
    if (current && current.leave) current.leave();
    current = null; currentSlide = slide;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastT = 0; t0 = 0;
    if (!slide) return;
    for (var i = 0; i < ANIMS.length; i++) {
      if (slide.querySelector(ANIMS[i].sel)) { current = ANIMS[i]; break; }
    }
    if (!current) return;
    if (current.enter) current.enter(slide, step || 0);
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener('deck:slide', function (e) { onSlide(e.detail.slide, e.detail.step); });
  document.addEventListener('deck:step', function (e) {
    if (current && current.step) current.step(e.detail.step);
  });

  // ---------- 3 · gwiazdy UE ----------
  (function stars() {
    var g = document.querySelector('.eu-ring .stars');
    if (!g) return;
    var html = '';
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2 - Math.PI / 2, cx = 100 + Math.cos(a) * 84, cy = 100 + Math.sin(a) * 84, d = '';
      for (var k = 0; k < 10; k++) {
        var rr = k % 2 ? 3.2 : 8, aa = k / 10 * Math.PI * 2 - Math.PI / 2;
        d += (k ? 'L' : 'M') + (cx + Math.cos(aa) * rr).toFixed(1) + ',' + (cy + Math.sin(aa) * rr).toFixed(1);
      }
      html += '<path d="' + d + 'Z"/>';
    }
    g.innerHTML = html;
  })();

  // ---------- 4 · wykres: biblioteka (krok 0) → Rust/WASM + WebGL2 (krok 1) ----------
  var lib = { data: walk(3000, 100, 1.2, 21), drawnAt: 0, stallUntil: 0, pan: 0, r: rng(5) };
  var own = { data: walk(400, 100, 1.4, 33), cell: 3 };

  function libFrame(t) {
    var canvas = $('libChart'); if (!canvas) return;
    var cyc = t % 12000;
    var p = clamp(cyc / 9000, 0, 1);
    var count = 500 + ease(p) * (43200 - 500);
    var fps = clamp(60 - count / 720, 7, 60);
    $('libCount').textContent = fmtInt(count);
    var fpsEl = $('libFps');
    // Biblioteka rysuje rzadziej, im więcej elementów — stąd szarpanie
    if (t < lib.stallUntil) return;
    var need = 1000 / fps + lib.r() * (count > 20000 ? 90 : 10);
    if (t - lib.drawnAt < need) return;
    if (count > 28000 && lib.r() < 0.025) lib.stallUntil = t + 260 + lib.r() * 260;
    lib.drawnAt = t;
    fpsEl.textContent = Math.round(fps) + ' FPS';
    fpsEl.classList.toggle('ok', fps > 40);

    var s = setup(canvas); if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h, pad = 14;
    ctx.clearRect(0, 0, w, h);
    grid(ctx, pad, pad, w - 2 * pad, h - 2 * pad, 6, 4);
    var vis = 70, start = Math.floor(t / 1000 * 7) % (lib.data.length - vis);
    var rg = range(lib.data, start, start + vis), span = Math.max(1e-9, rg.hi - rg.lo);
    var step = (w - 2 * pad) / vis, bw = step * 0.62;
    var y = function (v) { return pad + (rg.hi - v) / span * (h - 2 * pad); };
    for (var i = 0; i < vis; i++) {
      var c = lib.data[start + i];
      candle(ctx, pad + step * i + step / 2, bw, y, c, c.c >= c.o, { up: COL.libUp, dn: COL.libDn });
    }
  }

  function ownFrame(t) {
    var canvas = $('ownChart'); if (!canvas) return;
    var s = setup(canvas); if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var cyc = reduced ? 4200 : t % 10500;
    var paintEnd = 2600, pad = 14, visible = 70;
    var src = own.data.slice(0, visible), rg = range(src, 0, src.length);
    var span = Math.max(1e-9, rg.hi - rg.lo);
    var plotW = w - pad * 2, plotH = h - pad * 2;
    var step = plotW / visible, bw = step * .58;
    var y = function (v) { return pad + (rg.hi - v) / span * plotH; };
    var count = cyc < paintEnd ? Math.ceil(ease(cyc / paintEnd) * visible) : visible;
    ctx.clearRect(0, 0, w, h);
    grid(ctx, pad, pad, plotW, plotH, 8, 5);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, pad + step * count, h); ctx.clip();
    for (var i = 0; i < count; i++) candle(ctx, pad + step * (i + .5), bw, y, src[i], src[i].c >= src[i].o);
    ctx.restore();
    var mode = $('ownMode');
    if (cyc < paintEnd) {
      var scan = pad + step * count;
      ctx.fillStyle = COL.gold; ctx.fillRect(scan - 2, 0, 3, h);
      ctx.fillStyle = 'rgba(223,189,104,.08)'; ctx.fillRect(scan - 40, 0, 38, h);
      mode.textContent = 'seria OHLC → render';
    } else {
      mode.textContent = 'piksele canvasa';
      // Lupa powiększa geometrię świecy widoczną w renderowanym kadrze.
      var lx = w * 0.72, R = Math.min(90, h * 0.24), z = 5;
      var ci = clamp(Math.floor((lx - pad) / step), 0, src.length - 1), c = src[ci];
      var ly = clamp(y((c.h + c.l) / 2), R + 4, h - R - 40), priceScale = Math.min(R * 1.35 / Math.max(c.h - c.l, span * .025), R * 3);
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = COL.bg; ctx.fillRect(lx - R, ly - R, 2 * R, 2 * R);
      var center = (c.h + c.l) / 2, top = function (v) { return ly + (center - v) * priceScale; };
      ctx.strokeStyle = c.c >= c.o ? COL.upWick : COL.dnWick; ctx.lineWidth = 4;
      seg(ctx, lx, top(c.h), lx, top(c.l));
      ctx.fillStyle = c.c >= c.o ? COL.upBody : COL.dnBody;
      ctx.fillRect(lx - R * .24, Math.min(top(c.o), top(c.c)), R * .48, Math.max(5, Math.abs(top(c.o) - top(c.c))));
      ctx.restore();
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      seg(ctx, lx + R * 0.72, ly + R * 0.72, lx + R * 1.08, ly + R * 1.08);
      ctx.lineCap = 'butt';
      ctx.fillStyle = COL.gold; ctx.font = '600 15px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('OHLC → piksele', lx, ly + R + 34);
      ctx.textAlign = 'left';
    }
  }

  var chartStep = 0;
  ANIMS.push({
    sel: '#libChart',
    enter: function (slide, step) { chartStep = step; lib.drawnAt = 0; lib.stallUntil = 0; },
    step: function (step) { chartStep = step; },
    frame: function (t) { if (chartStep === 0) libFrame(t); else ownFrame(t); }
  });

  // ---------- 9 · mapa wyników testera ----------
  (function heatInit() {
    var el = $('heat'); if (!el) return;
    var html = '';
    for (var i = 0; i < 45; i++) html += '<i></i>';
    el.innerHTML = html;
  })();

  function heatColor(v) {
    // v w zakresie -1..1: strata (czerwony) → zero (ciemny) → zysk (zielony)
    if (v >= 0) return 'rgba(116,198,79,' + (0.18 + v * 0.75).toFixed(2) + ')';
    return 'rgba(227,96,79,' + (0.18 - v * 0.7).toFixed(2) + ')';
  }

  ANIMS.push({
    sel: '#heat',
    enter: function () { this.cells = Array.prototype.slice.call(document.querySelectorAll('#heat i')); this.shown = -1; this.round = 0; },
    frame: function (t) {
      var cyc = t % 7000, n = this.cells.length;
      var upto = reduced ? n : Math.floor(clamp((cyc - 500) / 2600, 0, 1) * n);
      var round = Math.floor(t / 7000);
      if (round !== this.round) { this.round = round; this.shown = -1; this.cells.forEach(function (c) { c.style.background = ''; }); }
      for (var i = this.shown + 1; i < upto; i++) {
        var gx = i % 9, gy = Math.floor(i / 9);
        var v = Math.exp(-(Math.pow(gx - 5.5 + round % 2, 2) / 6 + Math.pow(gy - 2, 2) / 2.5)) * 1.3 - 0.35 + Math.sin(i * 7.1 + round) * 0.12;
        this.cells[i].style.background = heatColor(clamp(v, -1, 1));
      }
      this.shown = Math.max(this.shown, upto - 1);
    }
  });

  // ---------- 5 · zoom: świece łączą się w większe ----------
  var LEVELS = [1, 5, 15, 60, 240];
  var zoom = { base: null, agg: {}, level: 1, prev: 1, fadeAt: -1e9 };

  function zoomInit() {
    if (zoom.base) return;
    // spokojniejszy rynek: losowy krok + wolno zmieniający się trend
    var r = rng(77), out = [], c = 100, vol = 0.09;
    for (var i = 0; i < 20160; i++) {
      var o = c;
      c = o + (r() - 0.5) * vol + Math.sin(i / 520) * vol * 0.012 + Math.sin(i / 1700 + 1) * vol * 0.01;
      out.push({ o: o, h: Math.max(o, c) + r() * vol * 0.4, l: Math.min(o, c) - r() * vol * 0.4, c: c });
    }
    zoom.base = out;
    LEVELS.forEach(function (L) { zoom.agg[L] = L === 1 ? zoom.base : aggregate(zoom.base, L); });
  }

  function spanText(min) {
    if (min < 60) return Math.round(min) + ' min';
    if (min < 1440) return (min / 60).toFixed(min < 600 ? 1 : 0).replace('.', ',').replace(',0', '') + ' h';
    return (min / 1440).toFixed(1).replace('.', ',').replace(',0', '') + ' dni';
  }

  function drawLevel(ctx, L, span, x0, w, y, alpha) {
    var n = zoom.base.length, cs = zoom.agg[L], from = n - span;
    var first = Math.max(0, Math.floor(from / L)), bw = Math.max(1, L / span * w * 0.66);
    ctx.globalAlpha = alpha;
    for (var k = first; k < cs.length; k++) {
      var xm = x0 + ((k * L + L / 2) - from) / span * w;
      if (xm < x0 - bw) continue;
      candle(ctx, xm, bw, y, cs[k], cs[k].c >= cs[k].o);
    }
    ctx.globalAlpha = 1;
    return cs.length - first;
  }

  ANIMS.push({
    sel: '#zoomChart',
    enter: function () { zoomInit(); zoom.level = 1; zoom.prev = 1; zoom.fadeAt = -1e9; },
    frame: function (t) {
      var canvas = $('zoomChart'), s = setup(canvas); if (!s) return;
      var ctx = s.ctx, w = s.w, h = s.h, padL = 16, padR = 16, padY = 22;
      var MIN = 120, MAX = 20160, cyc = reduced ? 8000 : t % 16000, p;
      if (cyc < 1500) p = 0;
      else if (cyc < 7000) p = ease((cyc - 1500) / 5500);
      else if (cyc < 9000) p = 1;
      else if (cyc < 14500) p = 1 - ease((cyc - 9000) / 5500);
      else p = 0;
      var span = Math.round(MIN * Math.pow(MAX / MIN, p));
      var L = LEVELS[LEVELS.length - 1];
      for (var i = 0; i < LEVELS.length; i++) if (span / LEVELS[i] <= 150) { L = LEVELS[i]; break; }
      if (L !== zoom.level) { zoom.prev = zoom.level; zoom.level = L; zoom.fadeAt = t; }
      var a = clamp((t - zoom.fadeAt) / 380, 0, 1);

      var plotW = w - padL - padR, n = zoom.base.length;
      var rg = range(zoom.agg[L], Math.floor((n - span) / L), zoom.agg[L].length);
      var pr = (rg.hi - rg.lo) * 0.06, hi = rg.hi + pr, lo = rg.lo - pr;
      if (zoom.yhi === undefined) { zoom.yhi = hi; zoom.ylo = lo; }
      zoom.yhi += (hi - zoom.yhi) * 0.12; zoom.ylo += (lo - zoom.ylo) * 0.12;
      var yh = zoom.yhi, yl = zoom.ylo;
      var y = function (v) { return padY + (yh - v) / Math.max(1e-9, yh - yl) * (h - 2 * padY); };

      ctx.clearRect(0, 0, w, h);
      grid(ctx, padL, padY, plotW, h - 2 * padY, 8, 4);
      ctx.save(); ctx.beginPath(); ctx.rect(padL, 0, plotW, h); ctx.clip();
      if (a < 1) drawLevel(ctx, zoom.prev, span, padL, plotW, y, 1 - a);
      var drawn = drawLevel(ctx, L, span, padL, plotW, y, a);
      ctx.restore();

      $('zSpan').textContent = spanText(span);
      $('zTf').textContent = L >= 60 ? (L / 60) + 'h' : L + 'm';
      $('zDrawn').textContent = fmtInt(drawn);
      $('zRaw').textContent = fmtInt(span);
      var lis = document.querySelectorAll('#zLod li');
      for (i = 0; i < lis.length; i++) lis[i].classList.toggle('on', +lis[i].dataset.l === L);
    }
  });

  // ---------- 6 · jeden wątek Node: kolejka zapytań ----------
  var sim = null;
  function simReset(mode) {
    sim = { mode: mode, now: 0, nextArr: 300, idx: 0, queue: [], running: null, jobs: [], waits: [], r: rng(9) };
  }
  function simStep(dt) {
    sim.now += dt;
    while (sim.now >= sim.nextArr) {
      var heavy = sim.idx % 14 === 1;
      var dur = heavy ? (sim.mode === 0 ? 5200 : 430) : 90 + sim.r() * 60;
      sim.queue.push({ arr: sim.nextArr, dur: dur, heavy: heavy, id: sim.idx });
      sim.idx++;
      sim.nextArr += 380 + sim.r() * 160;
    }
    if (sim.running && sim.now >= sim.running.end) {
      sim.waits.push(sim.running.end - sim.running.arr);
      if (sim.waits.length > 14) sim.waits.shift();
      sim.running = null;
    }
    if (!sim.running && sim.queue.length) {
      var j = sim.queue.shift();
      j.start = Math.max(sim.now, j.arr); j.end = j.start + j.dur;
      sim.running = j; sim.jobs.push(j);
      if (sim.jobs.length > 80) sim.jobs.shift();
    }
  }

  ANIMS.push({
    sel: '#limChart',
    enter: function (slide, step) { simReset(step); },
    step: function (step) { simReset(step); },
    frame: function (t, dt) {
      simStep(dt);
      var canvas = $('limChart'), s = setup(canvas); if (!s) return;
      var ctx = s.ctx, w = s.w, h = s.h, now = sim.now;
      var nowX = w * 0.78, pxPerMs = (nowX - 150) / 9000, laneY = Math.round(h * 0.13), laneH = Math.round(h * 0.26);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = COL.ink3; ctx.font = '700 15px ' + FONT;
      ctx.fillText('WĄTEK NODE', 24, laneY - 22);
      ctx.fillText('CZEKAJĄ W KOLEJCE', 24, Math.round(h * 0.62));
      ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
      ctx.strokeRect(150.5, laneY + 0.5, w - 174, laneH);
      ctx.save(); ctx.beginPath(); ctx.rect(151, laneY + 1, w - 176, laneH - 2); ctx.clip();
      sim.jobs.forEach(function (j) {
        var x1 = nowX - (now - j.start) * pxPerMs, x2 = nowX - (now - j.end) * pxPerMs;
        var col = j.heavy ? (sim.mode === 0 ? COL.no : COL.gold) : 'rgba(207,194,162,.55)';
        ctx.fillStyle = col;
        ctx.globalAlpha = j.end > now ? 0.55 : 1;
        ctx.fillRect(x1, laneY + 12, Math.max(2, Math.min(x2, nowX) - x1 - 2), laneH - 24);
        if (j.end > now) { ctx.globalAlpha = 0.22; ctx.fillRect(nowX, laneY + 12, x2 - nowX, laneH - 24); }
        ctx.globalAlpha = 1;
        if (j.heavy && x2 - x1 > 120) {
          ctx.fillStyle = sim.mode === 0 ? '#fff' : COL.bg; ctx.font = '700 17px ' + FONT;
          ctx.fillText(sim.mode === 0 ? '1m × rok · ciężki wskaźnik' : '1m × 30 dni', Math.max(x1 + 10, 160), laneY + laneH / 2 + 6);
        }
      });
      ctx.restore();
      ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; seg(ctx, nowX, laneY - 10, nowX, laneY + laneH + 10);
      ctx.fillStyle = COL.gold; ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('teraz', nowX, laneY + laneH + 28); ctx.textAlign = 'left';

      // kolejka użytkowników
      var qy = Math.round(h * 0.78), qn = sim.queue.length, MAXQ = 14;
      for (var i = 0; i < Math.min(qn, MAXQ); i++) {
        var qx = 48 + i * 52, q = sim.queue[i], waited = now - q.arr;
        ctx.fillStyle = waited > 1500 ? COL.no : COL.ink3;
        ctx.beginPath(); ctx.arc(qx, qy - 12, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(qx, qy + 26, 20, Math.PI, 0); ctx.fill();
      }
      if (!qn) { ctx.fillStyle = COL.node; ctx.font = '600 26px ' + FONT; ctx.fillText('nikt nie czeka', 30, qy + 12); }
      if (qn > MAXQ) { ctx.fillStyle = COL.no; ctx.font = '700 24px ' + FONT; ctx.fillText('+' + (qn - MAXQ), 48 + MAXQ * 52, qy + 14); }
      ctx.fillStyle = qn > 3 ? COL.no : COL.ink2; ctx.font = '700 56px ' + FONT;
      ctx.fillText(String(qn), w - 130, qy + 16);
      ctx.font = '16px ' + FONT; ctx.fillStyle = COL.ink3; ctx.fillText('w kolejce', w - 130, qy + 42);

      var avg = sim.waits.length ? sim.waits.reduce(function (a, b) { return a + b; }, 0) / sim.waits.length : 0;
      if (sim.running && sim.running.heavy && sim.mode === 0) avg = Math.max(avg, now - sim.running.arr);
      var el = $('limWait');
      el.textContent = sim.waits.length || sim.running ? (avg / 1000).toFixed(1).replace('.', ',') + ' s' : '—';
      el.style.color = avg > 1000 ? COL.no : COL.node;
    }
  });

  // ---------- 8 · podział plików: najpierw najnowszy miesiąc ----------
  var jsonData = walk(160, 100, 1.5, 51);
  function miniChart(ctx, x0, y0, w, h, cs, visibleFrom, alphaOf) {
    var rg = range(cs, 0, cs.length), span = rg.hi - rg.lo;
    var step = w / cs.length, bw = step * 0.6;
    var y = function (v) { return y0 + 6 + (rg.hi - v) / span * (h - 12); };
    for (var i = visibleFrom; i < cs.length; i++) {
      var a = alphaOf(i); if (a <= 0) continue;
      ctx.globalAlpha = a;
      candle(ctx, x0 + step * i + step / 2, bw, y, cs[i], cs[i].c >= cs[i].o);
    }
    ctx.globalAlpha = 1;
  }

  ANIMS.push({
    sel: '#jsonChart',
    frame: function (t) {
      var canvas = $('jsonChart'), s = setup(canvas); if (!s) return;
      var ctx = s.ctx, w = s.w, h = s.h, cyc = reduced ? 7000 : t % 9000, x0 = 24, cw = w - 48;
      var half = (h - 30) / 2, MONTHS = ['08', '09', '10', '11'];
      ctx.clearRect(0, 0, w, h);
      $('jsT').textContent = (Math.min(cyc, 6000) / 1000).toFixed(1).replace('.', ',') + ' s';

      // góra: jeden wielki plik
      var ty = 14, ch = half - 74;
      ctx.fillStyle = COL.ink3; ctx.font = '700 15px ' + FONT;
      ctx.fillText('JEDEN WIELKI PLIK', x0, ty + 14);
      grid(ctx, x0, ty + 28, cw, ch, 8, 3);
      var load = clamp(cyc / 4800, 0, 1);
      if (load < 1) {
        ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x0, ty + 28 + ch / 2 - 6, cw, 12);
        ctx.fillStyle = COL.goldDark; ctx.fillRect(x0, ty + 28 + ch / 2 - 6, cw * load, 12);
        ctx.fillStyle = COL.ink3; ctx.font = '600 17px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText('wykres pusty — czyta cały plik… ' + Math.round(load * 100) + '%', x0 + cw / 2, ty + 28 + ch / 2 - 18);
        ctx.textAlign = 'left';
      } else {
        miniChart(ctx, x0, ty + 28, cw, ch, jsonData, 0, function () { return clamp((cyc - 4800) / 300, 0, 1); });
      }

      // dół: podział na miesiące, najnowszy pierwszy
      var by = ty + half + 22;
      ctx.fillStyle = COL.gold; ctx.font = '700 15px ' + FONT;
      ctx.fillText('PODZIAŁ NA MIESIĄCE · NAJPIERW NAJNOWSZY', x0, by + 14);
      grid(ctx, x0, by + 28, cw, ch, 8, 3);
      var at = [250, 1000, 1700, 2400];
      miniChart(ctx, x0, by + 28, cw, ch, jsonData, 0, function (i) {
        var m = 3 - Math.floor(i / 40);
        return clamp((cyc - at[m]) / 300, 0, 1);
      });
      var mw = cw / 4;
      for (var chunk = 0; chunk < 4; chunk++) {
        var on = cyc >= at[3 - chunk];
        var bx = x0 + mw * chunk, byy = by + 36 + ch;
        ctx.strokeStyle = on ? COL.gold : COL.line; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 3.5, byy + 0.5, mw - 7, 28);
        ctx.fillStyle = on ? COL.gold : COL.ink3; ctx.font = '600 15px ' + MONO; ctx.textAlign = 'center';
        ctx.fillText('2026-' + MONTHS[chunk] + '.json', bx + mw / 2, byy + 20);
        ctx.textAlign = 'left';
      }
      if (cyc >= 250) {
        ctx.fillStyle = COL.node; ctx.font = '700 16px ' + FONT; ctx.textAlign = 'right';
        ctx.fillText('✓ prawy koniec od razu', x0 + cw, by + 14);
        ctx.textAlign = 'left';
      }
    }
  });

  // ---------- 10 · linia od faktycznego entry do entry z kodu ----------
  var chkData = (function () {
    var cs = walk(44, 100, 1.3, 64);
    var bad = 29;
    cs[bad].l = Math.min(cs[bad].o, cs[bad].c) - 4.2;   // długi dolny knot = „najlepsza cena”
    return cs;
  })();
  var TRADES = [{ s: 5 }, { s: 13 }, { s: 21 }, { s: 29, bad: true }, { s: 37 }];

  ANIMS.push({
    sel: '#chkChart',
    frame: function (t) {
      var canvas = $('chkChart'), s = setup(canvas); if (!s) return;
      var ctx = s.ctx, w = s.w, h = s.h, pad = 22, cs = chkData;
      var cyc = reduced ? 20000 : t % 11000;
      var rg = range(cs, 0, cs.length), span = rg.hi - rg.lo;
      var step = (w - 2 * pad) / cs.length, bw = step * 0.56;
      var y = function (v) { return pad + 30 + (rg.hi - v) / span * (h - 2 * pad - 110); };
      var xc = function (i) { return pad + step * i + step / 2; };
      ctx.clearRect(0, 0, w, h);
      grid(ctx, pad, pad, w - 2 * pad, h - 2 * pad, 8, 4);
      for (var i = 0; i < cs.length; i++) candle(ctx, xc(i), bw, y, cs[i], cs[i].c >= cs[i].o);

      var shown = 0, badShown = false;
      TRADES.forEach(function (tr, k) {
        var start = 700 + k * 1300;
        if (cyc < start) return;
        shown++;
        var p = clamp((cyc - start) / 600, 0, 1), sc = cs[tr.s], nx = cs[tr.s + 1];
        var col = tr.bad ? COL.no : COL.gold;
        // faktyczne entry = sygnał (znacznik pod świecą sygnału)
        var sx = xc(tr.s), sy = y(Math.min(sc.l, nx.l)) + 34;
        if (tr.bad) sy = y(sc.l) + 34;
        ctx.fillStyle = COL.ink;
        ctx.beginPath(); ctx.moveTo(sx, sy - 10); ctx.lineTo(sx - 9, sy + 5); ctx.lineTo(sx + 9, sy + 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = COL.ink3; ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText('sygnał', sx, sy + 24);
        // entry z kodu
        var bx = tr.bad ? xc(tr.s) : xc(tr.s + 1) - bw / 2, by = tr.bad ? y(sc.l) : y(nx.o);
        // linia rysuje się od faktycznego entry do entry z kodu
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
        seg(ctx, sx, sy - 12, sx + (bx - sx) * p, sy - 12 + (by - sy + 12) * p);
        ctx.setLineDash([]);
        if (p >= 1) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = COL.bg; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = '700 17px ' + FONT; ctx.fillStyle = col;
          if (tr.bad) {
            badShown = true;
            ctx.textAlign = 'left';
            ctx.fillText('✗ knot świecy sygnału', bx + 16, by + 6);
            ctx.font = '600 15px ' + FONT; ctx.fillText('kod zna przyszłość', bx + 16, by + 26);
          } else {
            ctx.fillText('✓ OPEN', bx + 4, by - 16);
          }
        }
        ctx.textAlign = 'left';
      });
      $('chkCount').textContent = shown + ' / 5' + (badShown ? ' · 1 błąd' : '');
      $('chkCount').style.color = badShown ? COL.no : '';
    }
  });

  // deck.js wysłał pierwsze zdarzenie, zanim ten plik się wczytał
  var first = document.querySelector('.slide.active');
  if (first) onSlide(first, parseInt(first.dataset.step, 10) || 0);
})();
