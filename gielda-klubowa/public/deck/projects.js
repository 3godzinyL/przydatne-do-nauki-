(function () {
  'use strict';

  // Slajd 7 → w dół: lista projektów uczestników klubu (1, 2, 3…), które pokażę w swoim wykonaniu.
  // Zapis do pliku na serwerze (PUT /api/projects → data/projekty-klubu.json) i kopia w przeglądarce
  // (localStorage) — gdy serwer jeszcze nie zna tego adresu albo nie działa, nic nie ginie.
  var KEY = 'club-projekty-klubu';
  var listEl = document.getElementById('projList');
  var input = document.getElementById('projText');
  var who = document.getElementById('projWho');
  var addBtn = document.getElementById('projAdd');
  var status = document.getElementById('projStatus');
  if (!listEl || !input) return;
  var online = /^https?:$/.test(location.protocol);
  var items = [];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function local() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function setStatus(where) {
    status.textContent = where === 'file'
      ? 'zapisane w pliku data/projekty-klubu.json'
      : 'zapisane w tej przeglądarce — po ponownym START.cmd zapis pójdzie też do pliku';
    status.className = 'pj-status ' + where;
  }

  // Zapisy po kolei: jeden naraz, a zmiany w trakcie wysyłamy potem jako najnowszą listę —
  // równoległe zapytania mogłyby dojść w innej kolejności i starsza lista nadpisałaby nowszą.
  var sending = false, dirty = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* brak dostępu */ }
    if (!online) return setStatus('local');
    if (sending) { dirty = true; return; }
    sending = true;
    dirty = false;
    fetch('api/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); setStatus('file'); })
      .catch(function () { setStatus('local'); })
      .then(function () { sending = false; if (dirty) save(); });
  }

  function render() {
    if (!items.length) {
      listEl.innerHTML = '<li class="pj-empty">Lista jest pusta — wpiszcie pierwszy pomysł na projekt.</li>';
      return;
    }
    listEl.innerHTML = items.map(function (it, i) {
      return '<li><span class="pj-n">' + (i + 1) + '</span><span class="pj-t" data-i="' + i + '" title="Podwójny klik — edycja">' + esc(it.text) + '</span>' +
        (it.who ? '<span class="pj-w">' + esc(it.who) + '</span>' : '') +
        '<button class="pj-x" data-del="' + i + '" title="Usuń">✕</button></li>';
    }).join('');
    listEl.scrollTop = listEl.scrollHeight;
  }

  function add() {
    var text = input.value.replace(/\s+/g, ' ').trim();
    if (!text) { input.focus(); return; }
    items.push({ text: text.slice(0, 300), who: who.value.replace(/\s+/g, ' ').trim().slice(0, 60), at: Date.now() });
    input.value = '';
    who.value = '';
    render();
    save();
    input.focus();
  }

  addBtn.addEventListener('click', add);
  [input, who].forEach(function (el) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  });

  listEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    items.splice(+b.dataset.del, 1);
    render();
    save();
  });
  // podwójny klik = poprawka tekstu w miejscu (Enter lub kliknięcie obok zapisuje, Esc anuluje)
  listEl.addEventListener('dblclick', function (e) {
    var t = e.target.closest('.pj-t');
    if (!t) return;
    var i = +t.dataset.i, before = items[i].text;
    t.contentEditable = 'true';
    t.focus();
    function done(keep) {
      t.contentEditable = 'false';
      var v = t.textContent.replace(/\s+/g, ' ').trim();
      if (keep && v && v !== before) { items[i].text = v.slice(0, 300); save(); }
      render();
    }
    t.addEventListener('keydown', function (k) {
      if (k.key === 'Enter') { k.preventDefault(); done(true); }
      if (k.key === 'Escape') { k.preventDefault(); done(false); }
      k.stopPropagation();
    });
    t.addEventListener('blur', function () { done(true); }, { once: true });
  });

  // start: lista z pliku na serwerze; gdy pliku jeszcze nie ma, a przeglądarka coś ma — wysyłamy to do pliku
  items = local();
  render();
  if (!online) { setStatus('local'); return; }
  fetch('api/projects').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
    if (j.items && j.items.length) { items = j.items; render(); setStatus('file'); try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* pomiń */ } }
    else if (items.length) save();
    else setStatus('file');
  }).catch(function () { setStatus('local'); });
})();
