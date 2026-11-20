(function () {
  'use strict';

  // Ramki (platforma, film) leżą nad sceną bez skalowania, w miejscu swoich slotów [data-frame] —
  // dzięki temu mają prawdziwe piksele ekranu. data-step mówi, na którym kroku slajdu slot jest widoczny.

  var SRC = { app: 'app', film: 'film/', rsi: 'app?ind=rsi', 'film-rsi': 'film-rsi/', 'film-node': 'film-node/', 'film-news': 'film-news/' };
  var isPresenter = /[?&]presenter\b/.test(location.search);
  var online = /^https?:$/.test(location.protocol) && !isPresenter;

  var items = Array.prototype.map.call(document.querySelectorAll('[data-frame]'), function (slot) {
    var frame = null;
    if (online) {
      frame = document.createElement('iframe');
      frame.className = 'app-frame';
      frame.title = slot.dataset.frame;
      frame.allow = 'autoplay; fullscreen';
      frame.src = SRC[slot.dataset.frame];
      document.body.appendChild(frame);
      var msg = slot.querySelector('.slot-msg');
      if (msg) msg.textContent = 'Ładuję…';
    }
    return { slot: slot, frame: frame, on: false };
  });

  function visible(it) {
    var slide = it.slot.closest('.slide');
    if (!slide.classList.contains('active')) return false;
    var st = it.slot.dataset.step;
    return st == null || st === (slide.dataset.step || '0');
  }

  function film(it, cmd) {
    if (it.slot.dataset.frame.indexOf('film') !== 0 || !it.frame.contentWindow) return;
    it.frame.contentWindow.postMessage({ type: 'film', cmd: cmd }, location.origin);
  }

  var timer = 0;
  // Znikające ramki chowamy od razu; nowe pokazujemy po przejeździe slajdu (delay).
  function update(delay) {
    clearTimeout(timer);
    items.forEach(function (it) {
      if (it.frame && it.on && !visible(it)) {
        it.on = false;
        it.frame.classList.remove('on');
        it.frame.blur();
        film(it, 'pause');
      }
    });
    timer = setTimeout(function () {
      items.forEach(function (it) {
        if (!it.frame || !visible(it)) return;
        var r = it.slot.getBoundingClientRect();
        it.frame.style.left = (r.left + 1) + 'px';
        it.frame.style.top = (r.top + 1) + 'px';
        it.frame.style.width = Math.max(0, r.width - 2) + 'px';
        it.frame.style.height = Math.max(0, r.height - 2) + 'px';
        if (!it.on) {
          it.on = true;
          it.frame.classList.add('on');
          film(it, 'play');
        }
      });
    }, delay);
  }

  document.addEventListener('deck:slide', function () { update(0); });
  document.addEventListener('deck:step', function () { update(850); });
  window.addEventListener('resize', function () { update(0); });
  document.addEventListener('fullscreenchange', function () { update(0); });

  // Klawisze z ramek (pilot, strzałki, F, N) wracają do slajdów.
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'deck-key') return;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: e.data.key, bubbles: true }));
  });

  update(0);
})();
