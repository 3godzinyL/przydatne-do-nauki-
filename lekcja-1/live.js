(function () {
  'use strict';

  // Wykresy prezentacji w stylu Privoty:
  //  - slajd „Cel”: świece rysują się od lewej do prawej jak mini wykresy na stronie głównej Privoty,
  //  - slajd „Na żywo”: BTCUSDT 1m z Binance (REST = historia, WebSocket = zmiany na żywo).
  // Bez internetu wykres „Cel” pokazuje przykładowe świece, a „Na żywo” — symulację z wyraźnym podpisem.

  if (/[?&]presenter\b/.test(location.search)) return;

  var stage = document.getElementById('stage');
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var REVEAL_MS = 2450;
  var REST = ['https://api.binance.com', 'https://data-api.binance.vision'];
  var WS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];
  var LIVE_COUNT = 90;

  var COL = {
    grid: 'rgba(255,255,255,.045)',
    upBody: 'rgba(232,219,180,.86)', upWick: 'rgba(222,208,168,.72)',
    dnBody: 'rgba(102,106,102,.66)', dnWick: 'rgba(139,142,137,.54)',
    gold: '#dfbd68', goldLine: 'rgba(223,189,104,.45)', bg: '#0e0d0a'
  };

  // ---------- rysowanie ----------
  function setup(canvas) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    var k = stage.getBoundingClientRect().width / 1920 || 1;
    var ratio = Math.max(1, (window.devicePixelRatio || 1) * k);
    var W = Math.round(w * ratio), H = Math.round(h * ratio);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function seg(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  function fmt(v) { return v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function draw(canvas, candles, reveal, opts) {
    var s = setup(canvas); if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var padL = 12, padR = opts.priceTag ? 118 : 12, padY = 18;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) { var gy = Math.round(padY + (h - 2 * padY) * i / 4) + 0.5; seg(ctx, padL, gy, w - padR, gy); }
    for (i = 0; i <= 6; i++) { var gx = Math.round(padL + (w - padL - padR) * i / 6) + 0.5; seg(ctx, gx, padY, gx, h - padY); }
    if (!candles || !candles.length) return;

    var lo = Infinity, hi = -Infinity;
    candles.forEach(function (c) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; });
    var range = Math.max(1e-9, hi - lo);
    var plotW = w - padL - padR, plotH = h - 2 * padY;
    var step = plotW / candles.length, bw = Math.max(1.2, Math.min(9, step * 0.58));
    var y = function (p) { return padY + (hi - p) / range * plotH; };
    var shown = Math.ceil(candles.length * Math.max(0, Math.min(1, reveal)));

    for (i = 0; i < shown; i++) {
      var c = candles[i], x = padL + step * i + step / 2, up = c.c >= c.o;
      ctx.strokeStyle = up ? COL.upWick : COL.dnWick;
      seg(ctx, x, y(c.h), x, y(c.l));
      var yo = y(c.o), yc = y(c.c);
      ctx.fillStyle = up ? COL.upBody : COL.dnBody;
      ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.3, Math.abs(yc - yo)));
    }

    if (reveal > 0.96) {
      var last = candles[candles.length - 1], ly = y(last.c);
      ctx.save();
      ctx.strokeStyle = COL.goldLine; ctx.setLineDash([4, 5]);
      seg(ctx, padL, ly, w - padR, ly);
      ctx.restore();
      if (opts.priceTag) {
        ctx.fillStyle = COL.gold;
        ctx.fillRect(w - padR + 8, ly - 14, padR - 10, 28);
        ctx.fillStyle = COL.bg;
        ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(fmt(last.c), w - padR + 16, ly + 1);
      }
    }
  }

  // Odsłanianie od lewej do prawej, tempo i krzywa jak na stronie głównej Privoty
  function reveal(canvas, getCandles, opts, done) {
    var token = {};
    canvas._anim = token;
    var start = null;
    function frame(t) {
      if (canvas._anim !== token) return;
      if (start === null) start = t;
      var p = reduced ? 1 : Math.min(1, (t - start) / REVEAL_MS);
      draw(canvas, getCandles(), 1 - Math.pow(1 - p, 2.25), opts);
      if (p < 1) requestAnimationFrame(frame);
      else { canvas._anim = null; if (done) done(); }
    }
    requestAnimationFrame(frame);
  }

  // ---------- dane ----------
  function timeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }

  function fetchKlines(interval, limit) {
    var i = 0;
    function attempt() {
      if (i >= REST.length) return Promise.reject(new Error('offline'));
      var url = REST[i++] + '/api/v3/klines?symbol=BTCUSDT&interval=' + interval + '&limit=' + limit;
      return timeout(fetch(url, { cache: 'no-store' }), 4000)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (rows) {
          if (!Array.isArray(rows) || !rows.length) throw new Error('pusto');
          return rows.map(function (k) { return { t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }; });
        })
        .catch(attempt);
    }
    return attempt();
  }

  function demoCandles(n, start, vol, seed) {
    var s = seed >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var out = [], c = start;
    for (var i = 0; i < n; i++) {
      var o = c;
      c = o + (r() - 0.5 + Math.sin(i / 11) * 0.32) * vol;
      out.push({ t: i, o: o, h: Math.max(o, c) + r() * vol * 0.5, l: Math.min(o, c) - r() * vol * 0.5, c: c });
    }
    return out;
  }

  // ---------- slajd „Cel” ----------
  var goal = { data: null, req: null, shown: null };

  function goalData() {
    if (!goal.req) goal.req = fetchKlines('1h', 120).then(function (d) { goal.data = d; return d; }, function () { return null; });
    return goal.req;
  }

  function playGoal(slide) {
    var canvas = slide.querySelector('#goalChart');
    var badge = slide.querySelector('[data-goal-src]');
    var started = false;
    function go(data) {
      if (started) return;
      started = true;
      goal.shown = data || demoCandles(120, 100, 1.6, 7);
      if (badge) { badge.textContent = data ? 'dane z giełdy' : 'podgląd bez internetu'; badge.parentNode.classList.toggle('off', !data); }
      reveal(canvas, function () { return goal.shown; }, {});
    }
    if (goal.data) { go(goal.data); return; }
    goalData().then(go);
    setTimeout(function () { go(goal.data); }, 1200);
  }

  // ---------- slajd „Na żywo” ----------
  var live = { active: false, canvas: null, candles: null, ws: null, wsIdx: 0, fails: 0, timers: [], drawn: false, last: null, mode: '', raf: 0 };

  function el(id) { return document.getElementById(id); }

  function setStatus(mode) {
    live.mode = mode;
    var s = el('liveStatus'); if (!s) return;
    var text = { connect: 'łączenie z giełdą…', on: 'na żywo · WebSocket', poll: 'na żywo · co 3 s', sim: 'brak internetu — symulacja' }[mode];
    s.className = 'lc-status ' + mode;
    s.lastChild.textContent = text;
  }

  function setPrice(p) {
    var node = el('livePrice'); if (!node) return;
    node.textContent = fmt(p);
    if (live.last !== null && p !== live.last) {
      node.classList.remove('up', 'dn');
      void node.offsetWidth;
      node.classList.add(p > live.last ? 'up' : 'dn');
      clearTimeout(live.flash);
      live.flash = setTimeout(function () { node.classList.remove('up', 'dn'); }, 650);
    }
    live.last = p;
  }

  function setInfo() {
    var node = el('liveInfo'); if (!node || !live.candles) return;
    var last = live.candles[live.candles.length - 1];
    node.textContent = live.mode === 'sim'
      ? live.candles.length + ' świec · dane przykładowe'
      : live.candles.length + ' świec · ostatnia ' + new Date(last.t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }

  function repaint() {
    if (!live.drawn || live.raf) return;
    live.raf = requestAnimationFrame(function () { live.raf = 0; if (live.active) draw(live.canvas, live.candles, 1, { priceTag: true }); });
  }

  function merge(c) {
    var a = live.candles; if (!a || !a.length) return;
    var last = a[a.length - 1];
    if (c.t === last.t) a[a.length - 1] = c;
    else if (c.t > last.t) { a.push(c); if (a.length > LIVE_COUNT) a.shift(); }
    else return;
    setPrice(c.c); setInfo(); repaint();
  }

  function later(fn, ms) { live.timers.push(setTimeout(fn, ms)); }

  function closeWs() {
    if (!live.ws) return;
    var ws = live.ws; live.ws = null;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) { /* już zamknięty */ }
  }

  function openWs() {
    closeWs();
    if (!live.active) return;
    if (live.fails >= 4) { poll(); return; }
    var ws, opened = false;
    try { ws = new WebSocket(WS[live.wsIdx % WS.length] + '/ws/btcusdt@kline_1m'); } catch (e) { live.fails++; later(openWs, 1500); return; }
    live.ws = ws;
    ws.onopen = function () { opened = true; live.fails = 0; setStatus('on'); };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m && m.k) merge({ t: m.k.t, o: +m.k.o, h: +m.k.h, l: +m.k.l, c: +m.k.c });
    };
    ws.onclose = function () {
      if (live.ws !== ws) return;
      live.ws = null;
      if (!live.active) return;
      if (!opened) { live.fails++; live.wsIdx++; }
      setStatus('connect');
      later(openWs, 1500);
    };
  }

  // Gdy WebSocket jest zablokowany w sieci: ostatnie świece co 3 s przez REST
  function poll() {
    if (!live.active) return;
    fetchKlines('1m', 2).then(function (rows) {
      if (!live.active) return;
      setStatus('poll');
      rows.forEach(merge);
    }, function () { /* spróbujemy za chwilę */ }).then(function () { later(poll, 3000); });
  }

  function startSim() {
    setStatus('sim');
    var base = demoCandles(LIVE_COUNT, 100000, 55, 11);
    base.forEach(function (c, i) { c.t = i; });
    live.candles = base;
    setPrice(base[base.length - 1].c); setInfo();
    reveal(live.canvas, function () { return live.candles; }, { priceTag: true }, function () { live.drawn = true; });
    var ticks = 0;
    (function tick() {
      if (!live.active) return;
      var a = live.candles, last = a[a.length - 1];
      if (++ticks % 16 === 0) merge({ t: last.t + 1, o: last.c, h: last.c, l: last.c, c: last.c });
      else {
        var c = last.c + (Math.random() - 0.5) * 18;
        merge({ t: last.t, o: last.o, h: Math.max(last.h, c), l: Math.min(last.l, c), c: c });
      }
      later(tick, 600);
    })();
  }

  function liveEnter(slide) {
    if (live.active) return;
    live.active = true;
    live.canvas = slide.querySelector('#liveChart');
    live.drawn = false; live.fails = 0; live.last = null;
    setStatus('connect');
    fetchKlines('1m', LIVE_COUNT).then(function (d) {
      if (!live.active) return;
      live.candles = d;
      setPrice(d[d.length - 1].c); setInfo();
      reveal(live.canvas, function () { return live.candles; }, { priceTag: true }, function () { live.drawn = true; });
      openWs();
    }, function () { if (live.active) startSim(); });
  }

  function liveLeave() {
    if (!live.active) return;
    live.active = false;
    closeWs();
    live.timers.forEach(clearTimeout); live.timers = [];
    if (live.canvas) live.canvas._anim = null;
  }

  // ---------- sterowanie ze zmiany slajdu ----------
  function onSlide(slide) {
    if (!slide) return;
    if (slide.querySelector('#goalChart')) playGoal(slide);
    if (slide.querySelector('#liveChart')) liveEnter(slide); else liveLeave();
  }

  document.addEventListener('deck:slide', function (e) { onSlide(e.detail && e.detail.slide); });
  window.addEventListener('resize', function () {
    var g = document.getElementById('goalChart');
    if (g && goal.shown && !g._anim) draw(g, goal.shown, 1, {});
    if (live.active && live.drawn) draw(live.canvas, live.candles, 1, { priceTag: true });
  });

  goalData();
  onSlide(document.querySelector('.slide.active'));
})();
