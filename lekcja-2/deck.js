(function () {
  'use strict';

  // Sterowanie prezentacją (jak w lekcji 1) + kroki na slajdzie:
  // slajd z data-steps="2" najpierw zmienia krok (animacja na tym samym slajdzie), dopiero potem idzie dalej.

  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var notesPanel = document.getElementById('notesPanel');
  var help = document.getElementById('help');
  var total = slides.length;
  var current = 0;
  var step = 0;
  var isPresenter = /[?&]presenter\b/.test(location.search);
  var CHANNEL = 'club-deck-gielda-2';

  var hud = document.createElement('div');
  hud.className = 'hud';
  hud.innerHTML = '<span>Klub · Giełda klubowa · lekcja 2</span><span class="count"></span>';
  stage.appendChild(hud);
  var countEl = hud.querySelector('.count');
  var bar = document.createElement('div');
  bar.className = 'progress';
  stage.appendChild(bar);

  var channel = null;
  try { channel = new BroadcastChannel(CHANNEL); } catch (e) { channel = null; }

  function stepsOf(i) { return Math.max(1, parseInt(slides[i] && slides[i].dataset.steps, 10) || 1); }

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function notesHtml(i) {
    var n = slides[i] && slides[i].querySelector('.notes');
    return n ? n.innerHTML : '';
  }

  function stepDots() {
    var n = stepsOf(current);
    if (n < 2) return '';
    var out = ' <span class="dots">';
    for (var k = 0; k < n; k++) out += '<i class="' + (k <= step ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function render(slideChanged) {
    slides.forEach(function (s, i) {
      s.classList.toggle('active', i === current);
      if (i === current) s.dataset.step = String(step);
    });
    countEl.innerHTML = stepDots() + '<b>' + (current + 1) + '</b> / ' + total;
    bar.style.width = ((current + 1) / total * 100) + '%';
    notesPanel.innerHTML = '<h4>Notatki · ' + slides[current].dataset.title + '</h4>' + notesHtml(current);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + (current + 1));
    if (isPresenter) renderPresenter();
    document.dispatchEvent(new CustomEvent(slideChanged ? 'deck:slide' : 'deck:step', {
      detail: { index: current, step: step, slide: slides[current] }
    }));
  }

  function goTo(i, st, fromRemote) {
    var next = Math.max(0, Math.min(total - 1, i));
    var nst = Math.max(0, Math.min(stepsOf(next) - 1, st || 0));
    if (next === current && nst === step && !fromRemote) return;
    var changed = next !== current;
    current = next; step = nst;
    render(changed || !!fromRemote);
    if (!fromRemote) send({ type: 'go', index: current, step: step });
  }

  function forward() {
    if (step < stepsOf(current) - 1) goTo(current, step + 1);
    else goTo(current + 1, 0);
  }
  function back() {
    if (step > 0) goTo(current, step - 1);
    else if (current > 0) goTo(current - 1, stepsOf(current - 1) - 1);
  }

  function send(msg) {
    if (channel) channel.postMessage(msg);
    try { localStorage.setItem(CHANNEL + '-msg', JSON.stringify({ m: msg, t: Date.now(), from: isPresenter })); } catch (e) { /* brak dostępu */ }
  }

  function receive(m) {
    if (m.type === 'go') goTo(m.index, m.step || 0, true);
    if (m.type === 'hello' && !isPresenter) send({ type: 'go', index: current, step: step });
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== CHANNEL + '-msg' || !e.newValue) return;
    try { var d = JSON.parse(e.newValue); if (d.from !== isPresenter) receive(d.m); } catch (err) { /* pomiń */ }
  });

  // ---- widok prowadzącego ----
  var started = Date.now();
  function renderPresenter() {
    var n = stepsOf(current);
    document.getElementById('pvNow').textContent = 'Slajd ' + (current + 1) + ' / ' + total + (n > 1 ? ' · krok ' + (step + 1) + ' / ' + n : '');
    document.getElementById('pvTitle').textContent = slides[current].dataset.title;
    document.getElementById('pvNotes').innerHTML = notesHtml(current) || '<p>Brak notatek.</p>';
    var nx = slides[current + 1];
    var nextText = step < n - 1 ? 'Następny krok na tym slajdzie.' : (nx ? 'Następny:<b>' + nx.dataset.title + '</b>' : 'To ostatni slajd.');
    document.getElementById('pvNextT').innerHTML = nextText;
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
    document.getElementById('pvPrev').onclick = back;
    document.getElementById('pvNext').onclick = forward;
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

  // ---- klawiatura (działa też z pilotem: PageUp/PageDown) ----
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); forward(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); back(); break;
      case 'Home': e.preventDefault(); goTo(0, 0); break;
      case 'End': e.preventDefault(); goTo(total - 1, 0); break;
      case 'f': case 'F': if (!isPresenter) toggleFullscreen(); break;
      case 'n': case 'N': notesPanel.classList.toggle('on'); break;
      case 'p': case 'P':
        if (!isPresenter) window.open(location.pathname + '?presenter#' + (current + 1), 'club-presenter-2', 'width=1100,height=720');
        break;
    }
  });

  // ---- klik: prawa część ekranu dalej, lewa wstecz ----
  document.querySelector('.deck').addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    if (e.clientX > window.innerWidth * 0.3) forward(); else back();
  });

  // ---- przesunięcie palcem ----
  var tx = null;
  document.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) { if (dx < 0) forward(); else back(); }
    tx = null;
  });

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
    if (h && h - 1 !== current) goTo(h - 1, 0);
  });

  var start = parseInt(location.hash.slice(1), 10);
  current = start ? Math.max(0, Math.min(total - 1, start - 1)) : 0;
  step = 0;
  fit();
  render(true);
})();
