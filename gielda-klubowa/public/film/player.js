(function () {
  'use strict';
  // Cały film to JEDNA ścieżka dźwięku (audio/film.mp3) i oś czasu (audio/timeline.json).
  // Scena wynika z czasu ścieżki, więc przejście między scenami nie wymaga nowego play()
  // i nic nie może się zatrzymać w połowie. Bez dźwięku film leci na zwykłym zegarze.
  var stage = document.getElementById('stage');
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var capEl = document.getElementById('cap');
  var playBtn = document.getElementById('play');
  var cover = document.getElementById('cover');
  var embedded = window.parent !== window;
  var script = [];
  var tl = null;
  var audio = new Audio();
  var useAudio = true;
  var playing = false, ended = false, idx = -1, clock = 0, lastTs = 0;

  audio.preload = 'auto';
  audio.src = 'audio/film.mp3';
  audio.addEventListener('error', function () { useAudio = false; });
  audio.addEventListener('ended', finish);
  // pauza z zewnątrz (system, słuchawki) — pokazujemy ją w przyciskach
  audio.addEventListener('pause', function () { if (playing && useAudio && !audio.ended) pause(); });

  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  // ---- świece do ilustracji (stały los, żeby film był zawsze taki sam) ----
  function rng(seed) { return function () { seed = seed * 16807 % 2147483647; return seed / 2147483647; }; }
  function candles(svg) {
    var spec = svg.dataset.candles.split(','), n = +spec[0], r = rng(+spec[1] * 7919);
    var vb = svg.viewBox.baseVal, w = vb.width, h = vb.height, p = 100, list = [];
    for (var i = 0; i < n; i++) {
      var o = p, c = o + (r() - 0.48) * 3, hi = Math.max(o, c) + r() * 1.4, lo = Math.min(o, c) - r() * 1.4;
      list.push([o, hi, lo, c]); p = c;
    }
    var max = -1e9, min = 1e9;
    list.forEach(function (k) { max = Math.max(max, k[1]); min = Math.min(min, k[2]); });
    var sx = w / n, bw = Math.max(1.5, sx * 0.64);
    var y = function (v) { return (max - v) / (max - min) * (h * 0.86) + h * 0.07; };
    var out = '';
    list.forEach(function (k, i) {
      var x = i * sx + sx / 2, col = k[3] >= k[0] ? '#2fbf8f' : '#e5534b';
      var top = y(Math.max(k[0], k[3])), bh = Math.max(1.5, Math.abs(y(k[0]) - y(k[3])));
      var last = svg.dataset.live && i === n - 1;
      out += '<g' + (last ? ' class="lc"' : '') + '><line x1="' + x + '" x2="' + x + '" y1="' + y(k[1]) + '" y2="' + y(k[2]) +
        '" stroke="' + col + '" stroke-width="' + Math.max(1, sx * 0.1) + '"/><rect x="' + (x - bw / 2) + '" y="' + top +
        '" width="' + bw + '" height="' + bh + '" fill="' + col + '"/></g>';
    });
    svg.innerHTML = svg.dataset.group ? '<g class="' + svg.dataset.group + '">' + out + '</g>' : out;
  }
  Array.prototype.forEach.call(document.querySelectorAll('svg[data-candles]'), candles);
  var cells = '';
  for (var k = 0; k < 300; k++) cells += '<i style="--k:' + k + '"></i>';
  var cellsEl = document.getElementById('cells');
  if (cellsEl) cellsEl.innerHTML = cells;

  // ---- oś czasu ----
  function dur(i) {
    if (tl && tl.scenes[i]) return tl.scenes[i].dur;
    var t = script[i] ? script[i].cap : '';
    return Math.max(6, t.split(/\s+/).length / 2.3 + 1);
  }
  function start(i) {
    if (tl && tl.scenes[i]) return tl.scenes[i].start;
    var s = 0;
    for (var k = 0; k < i; k++) s += dur(k) + 0.5;
    return s;
  }
  function total() { return tl ? tl.total : start(scenes.length - 1) + dur(scenes.length - 1); }
  function sceneAt(t) {
    for (var i = scenes.length - 1; i > 0; i--) if (t >= start(i) - 0.01) return i;
    return 0;
  }
  // Przewinięcie, zanim przeglądarka zna długość nagrania, jest ignorowane —
  // zapamiętujemy je i ustawiamy, gdy dźwięk będzie gotowy.
  var pendingSeek = null;
  audio.addEventListener('loadedmetadata', function () {
    if (pendingSeek != null) { audio.currentTime = pendingSeek; pendingSeek = null; }
  });
  function now() {
    if (!useAudio) return clock;
    return pendingSeek != null ? pendingSeek : audio.currentTime;
  }
  function setNow(t) {
    clock = t;
    if (!useAudio) return;
    if (audio.readyState >= 1) { audio.currentTime = t; pendingSeek = null; } else pendingSeek = t;
  }

  var chap = document.getElementById('chap');
  scenes.forEach(function (s, i) {
    var d = document.createElement('div');
    d.innerHTML = '<i></i>';
    d.title = String(i + 1);
    d.onclick = function () { seek(i); };
    chap.appendChild(d);
  });
  function layoutChapters() {
    Array.prototype.forEach.call(chap.children, function (d, i) { d.style.flex = String(dur(i) + 0.5); });
  }

  // Pokazuje scenę i ustawia jej animacje na właściwy moment (przy przewijaniu też).
  function show(i, offset) {
    idx = i;
    scenes.forEach(function (s) { s.classList.remove('on'); });
    void stage.offsetWidth; // restart animacji CSS
    var s = scenes[i];
    s.style.setProperty('--T', dur(i).toFixed(2));
    s.classList.add('on');
    if (offset > 0.05 && s.getAnimations) {
      s.getAnimations({ subtree: true }).forEach(function (a) { try { a.currentTime = offset * 1000; } catch (e) { /* pomiń */ } });
    }
    capEl.textContent = script[i] ? script[i].cap : '';
    document.getElementById('nm').textContent = (i + 1) + ' / ' + scenes.length + (script[i] ? ' · ' + script[i].title : '');
  }

  function play() {
    if (ended) { ended = false; setNow(0); show(0, 0); }
    cover.classList.add('off');
    playing = true;
    stage.classList.remove('paused');
    playBtn.textContent = '❚❚';
    lastTs = performance.now();
    if (!useAudio) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function (e) {
      if (e && e.name === 'NotAllowedError') { pause(); cover.classList.remove('off'); } // przeglądarka chce kliknięcia
      else if (e && e.name !== 'AbortError') { useAudio = false; clock = audio.currentTime || clock; } // dźwięk padł — film leci dalej
    });
  }

  function pause() {
    playing = false;
    if (useAudio && !audio.paused) audio.pause();
    stage.classList.add('paused');
    playBtn.textContent = '▶';
  }

  function finish() {
    playing = false;
    ended = true;
    if (useAudio && !audio.paused) audio.pause();
    stage.classList.add('paused');
    playBtn.textContent = '↺';
  }

  // Najpierw play(), potem przewinięcie: play() na skończonym nagraniu przeskakuje na 0
  // i nadpisałoby wybraną scenę.
  function seek(i) {
    if (!playing) play();
    setNow(start(i));
    show(i, 0);
  }

  function toggle() { if (playing) pause(); else play(); }
  playBtn.onclick = toggle;
  cover.onclick = function () { play(); };

  function fmt(t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  function tick(ts) {
    requestAnimationFrame(tick);
    if (playing && !useAudio) {
      clock += Math.min(0.25, Math.max(0, ts - lastTs) / 1000);
      if (clock >= total()) { clock = total(); finish(); }
    }
    lastTs = ts;
    var t = now();
    var i = sceneAt(t);
    if (i !== idx) show(i, t - start(i));
    Array.prototype.forEach.call(chap.children, function (d, k) {
      var f = k < i ? 1 : k > i ? 0 : Math.min(1, Math.max(0, (t - start(k)) / (dur(k) + 0.5)));
      d.firstChild.style.width = (ended ? 100 : f * 100) + '%';
    });
    document.getElementById('tm').textContent = fmt(t) + ' / ' + fmt(total());
  }

  // Sterowanie z prezentacji (widok w dół) i klawisze slajdów z ramki.
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'film') return;
    if (e.data.cmd === 'play' && !playing) play();
    if (e.data.cmd === 'pause' && playing) pause();
  });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); toggle(); return; }
    if (embedded) {
      if (['PageDown', 'PageUp', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'f', 'F', 'n', 'N'].indexOf(e.key) >= 0) {
        e.preventDefault();
        window.parent.postMessage({ type: 'deck-key', key: e.key }, location.origin);
      }
      return;
    }
    if (e.key === 'ArrowRight') seek(Math.min(scenes.length - 1, idx + 1));
    if (e.key === 'ArrowLeft') seek(Math.max(0, idx - 1));
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen();
    }
  });

  window.addEventListener('resize', fit);
  fit();
  Promise.all([
    fetch('script.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
    fetch('audio/timeline.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
  ]).then(function (res) {
    script = res[0] || [];
    tl = res[1];
    if (!tl) useAudio = false;
    layoutChapters();
    show(sceneAt(now()), 0);
  });
  show(0, 0);
  stage.classList.add('paused');
  layoutChapters();
  requestAnimationFrame(tick);

  // podgląd i testy (F12): film.seek(4), film.time …
  window.film = {
    seek: seek, play: play, pause: pause, dur: dur, start: start, total: total,
    get idx() { return idx; }, get playing() { return playing; }, get ended() { return ended; },
    get time() { return now(); }, get audio() { return audio; },
  };
})();
