(function () {
  'use strict';

  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var notesPanel = document.getElementById('notesPanel');
  var help = document.getElementById('help');
  var total = slides.length;
  var current = 0;
  var isPresenter = /[?&]presenter\b/.test(location.search);

  // Stopka i pasek postępu na scenie
  var hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = '<span>Klub · Programowanie z AI</span><span class="count"></span>';
  stage.appendChild(hud);
  var countEl = hud.querySelector('.count');
  var bar = document.createElement('div');
  bar.className = 'progress';
  stage.appendChild(bar);

  // Kanał między oknem prezentacji a widokiem prowadzącego
  var channel = null;
  try { channel = new BroadcastChannel('club-deck'); } catch (e) { channel = null; }

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function notesHtml(i) {
    var n = slides[i] && slides[i].querySelector('.notes');
    return n ? n.innerHTML : '';
  }

  function render() {
    slides.forEach(function (s, i) { s.classList.toggle('active', i === current); });
    countEl.innerHTML = '<b>' + (current + 1) + '</b> / ' + total;
    bar.style.width = ((current + 1) / total * 100) + '%';
    notesPanel.innerHTML = '<h4>Notatki · ' + slides[current].dataset.title + '</h4>' + notesHtml(current);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + (current + 1));
    if (isPresenter) renderPresenter();
    // Slajdy z żywymi wykresami (live.js) startują i zatrzymują się na to zdarzenie
    document.dispatchEvent(new CustomEvent('deck:slide', { detail: { index: current, slide: slides[current] } }));
  }

  function go(i, fromRemote) {
    var next = Math.max(0, Math.min(total - 1, i));
    if (next === current && !fromRemote) return;
    current = next;
    render();
    if (!fromRemote) send({ type: 'go', index: current });
  }

  function send(msg) {
    if (channel) channel.postMessage(msg);
    try { localStorage.setItem('club-deck-msg', JSON.stringify({ m: msg, t: Date.now(), from: isPresenter })); } catch (e) { /* brak dostępu */ }
  }

  function receive(m) {
    if (m.type === 'go') go(m.index, true);
    if (m.type === 'hello' && !isPresenter) send({ type: 'go', index: current });
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== 'club-deck-msg' || !e.newValue) return;
    try { var d = JSON.parse(e.newValue); if (d.from !== isPresenter) receive(d.m); } catch (err) { /* pomiń */ }
  });

  // ---- widok prowadzącego ----
  var started = Date.now();
  function renderPresenter() {
    document.getElementById('pvNow').textContent = 'Slajd ' + (current + 1) + ' / ' + total;
    document.getElementById('pvTitle').textContent = slides[current].dataset.title;
    document.getElementById('pvNotes').innerHTML = notesHtml(current) || '<p>Brak notatek.</p>';
    var nx = slides[current + 1];
    document.getElementById('pvNextT').innerHTML = nx ? 'Następny:<b>' + nx.dataset.title + '</b>' : 'To ostatni slajd.';
  }
  function tick() {
    var sec = Math.floor((Date.now() - started) / 1000);
    var mm = String(Math.floor(sec / 60)).padStart(2, '0');
    var ss = String(sec % 60).padStart(2, '0');
    document.getElementById('pvClock').innerHTML = mm + ':' + ss + '<small>czas lekcji</small>';
  }

  if (isPresenter) {
    document.body.classList.add('presenter');
    document.title = 'Prowadzący — ' + document.title;
    document.getElementById('pvPrev').onclick = function () { go(current - 1); };
    document.getElementById('pvNext').onclick = function () { go(current + 1); };
    document.getElementById('pvReset').onclick = function () { started = Date.now(); tick(); };
    setInterval(tick, 1000);
    tick();
  }

  if (channel) channel.onmessage = function (ev) { receive(ev.data || {}); };
  if (isPresenter) send({ type: 'hello' });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  // ---- klawiatura (działa też z pilotem do prezentacji: PageUp/PageDown) ----
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); go(current + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); go(current - 1); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(total - 1); break;
      case 'f': case 'F': if (!isPresenter) toggleFullscreen(); break;
      case 'n': case 'N': notesPanel.classList.toggle('on'); break;
      case 'p': case 'P':
        if (!isPresenter) window.open(location.pathname + '?presenter#' + (current + 1), 'club-presenter', 'width=1100,height=720');
        break;
    }
  });

  // ---- klik: prawa część ekranu dalej, lewa wstecz ----
  document.querySelector('.deck').addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    if (e.clientX > window.innerWidth * 0.3) go(current + 1); else go(current - 1);
  });

  // ---- przesunięcie palcem ----
  var tx = null;
  document.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
    tx = null;
  });

  // Podpowiedź klawiszy na chwilę po ruchu myszy
  var helpTimer = null;
  document.addEventListener('mousemove', function () {
    if (isPresenter) return;
    help.classList.add('on');
    clearTimeout(helpTimer);
    helpTimer = setTimeout(function () { help.classList.remove('on'); }, 1800);
  });

  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', function () {
    var h = parseInt(location.hash.slice(1), 10);
    if (h && h - 1 !== current) go(h - 1);
  });

  var start = parseInt(location.hash.slice(1), 10);
  current = start ? Math.max(0, Math.min(total - 1, start - 1)) : 0;
  fit();
  render();
})();
