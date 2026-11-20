(function () {
  'use strict';

  // Slajd 6: lista źródeł na schemacie i „silnik na żywo” — prawdziwe newsy z Privoty
  // oceniane naszym silnikiem (news-engine.js) obok prawdziwej odpowiedzi ChatGPT.
  var E = window.NewsEngine;
  var X = window.NEWS_EXAMPLES || [];
  if (!E) return;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function signed(v) { return v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0'; }
  function when(t) {
    var d = new Date(t);
    return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + ' · ' +
      String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
  }
  var MK = { btc: 'BTC', spx: 'S&P', gold: 'złoto', oil: 'ropa' };
  function marketsText(m) {
    return Object.keys(MK).map(function (k) { return MK[k] + ' ' + signed(m[k] || 0); }).join(' · ');
  }

  // --- schemat: 20 źródeł i ich kanały -----------------------------------------
  var srcEl = document.getElementById('newsSources');
  if (srcEl) {
    srcEl.innerHTML = E.SOURCES.map(function (s) {
      return '<span class="sc t-' + s.tier + '"><b>' + esc(s.name) + '</b>' +
        s.channels.map(function (c) { return '<i>' + esc(c) + '</i>'; }).join('') + '</span>';
    }).join('');
  }

  // --- silnik na żywo --------------------------------------------------------------
  var pick = document.getElementById('newsPick');
  var card = document.getElementById('newsCard');
  var code = document.getElementById('newsCode');
  var json = document.getElementById('newsJson');
  var route = document.getElementById('newsRoute');
  var gpt = document.getElementById('newsGpt');
  if (!pick || !card || !code || !json) return;

  var own = { id: 'own', source: 'fed', channel: 'komunikaty', time: Date.UTC(2026, 10, 20, 19, 0), title: 'Fed cuts interest rates by 50 basis points in surprise decision', summary: '' };
  var current = 'nato';

  pick.innerHTML = X.map(function (ex) {
    var s = E.SOURCES.filter(function (q) { return q.id === ex.source; })[0];
    return '<button data-ex="' + ex.id + '">' + esc(s ? s.name : ex.source) + '</button>';
  }).join('') + '<button data-ex="own">✎ własny</button>';

  // Kod silnika rysowany z tych samych reguł, które liczą wynik (RULES z news-engine.js).
  function codeLines(res) {
    var hit = {};
    res.fired.forEach(function (f) { hit[f.id] = f; });
    var src = res.fired[0];
    var out = '<div class="cl cm">// 1. waga startowa ze źródła</div>' +
      '<div class="cl hit"><span class="k">TIERS</span> pierwotne 15 · oficjalne 12 · serwis 8 · media 5<span class="pts">+' + src.w + '</span></div>' +
      '<div class="cl cm">// 2. reguły: wzorzec → waga, wydźwięk, rynki</div>';
    E.RULES.concat([E.NOISE]).forEach(function (r) {
      // wzorzec do czytania: bez znaków technicznych (\b, \s, (?:…)), cyfry jako #
      var re = r.re.source.replace(/\\b/g, '').replace(/\\s\??/g, ' ').replace(/\\d/g, '#').replace(/\(\?:/g, '(').replace(/\\/g, '');
      if (re.length > 30) re = re.slice(0, 29) + '…';
      var on = hit[r.id];
      out += '<div class="cl' + (on ? ' hit' : '') + '"><span class="rid">' + esc(r.id) + '</span><span class="re">/' + esc(re) + '/</span>' +
        '<span class="w">' + (r.w ? signed(r.w) : '') + '</span><span class="tn">' + (r.tone ? 'tone ' + signed(r.tone) : '') + '</span></div>';
    });
    out += '<div class="cl cm">// 3. suma → poziom (progi jak w prompcie)</div>' +
      '<div class="cl hit"><span class="k">score</span> = ' + res.weight_score + ' → <b>' + esc(res.weight) + '</b><span class="lv">≥85 b. wysoka · ≥65 wysoka · ≥40 średnia</span></div>' +
      '<div class="cl cm">// 4. rozdzielnik</div>' +
      '<div class="cl hit"><span class="k">score ≥ 65</span> ? etap 2 : strona → <b>' + (res.weight_score >= 65 ? 'etap 2' : 'strona') + '</b></div>';
    return out;
  }

  // JSON z kolorami (klucze, napisy, liczby) — bez listy reguł i decyzji, jak odpowiedź ChatGPT.
  function jsonHtml(res) {
    var view = { source: res.source, weight: res.weight, weight_score: res.weight_score, tone: res.tone, markets: res.markets, horizon: res.horizon, event: res.event, short: res.short, topic: res.topic };
    // pola główne w osobnych wierszach, zagnieżdżone obiekty w jednym (krótko, jak na ekranie)
    var text = '{\n' + Object.keys(view).map(function (k) {
      return '  "' + k + '": ' + JSON.stringify(view[k]).replace(/":/g, '": ').replace(/,"/g, ', "');
    }).join(',\n') + '\n}';
    return esc(text)
      .replace(/&quot;([^&]*?)&quot;:/g, '<span class="jk">"$1"</span>:')
      .replace(/: &quot;(.*?)&quot;/g, ': <span class="js">"$1"</span>')
      .replace(/: (-?\d+)/g, ': <span class="jn">$1</span>')
      .replace(/: (null)/g, ': <span class="jz">$1</span>');
  }

  function cardHtml(ex) {
    var s = E.SOURCES.filter(function (q) { return q.id === ex.source; })[0] || { name: ex.source, tier: 'media' };
    var head = '<div class="nc-src"><b>' + esc(s.name) + '</b><span>' + esc(ex.channel) + ' · ' + esc(E.TIERS[s.tier].label) + '</span><em>' + when(ex.time) + '</em></div>';
    if (ex.id === 'own') {
      var opts = E.SOURCES.map(function (q) { return '<option value="' + q.id + '"' + (q.id === ex.source ? ' selected' : '') + '>' + esc(q.name) + '</option>'; }).join('');
      return head + '<label class="nc-lb">źródło <select id="ownSrc">' + opts + '</select></label>' +
        '<textarea id="ownText" spellcheck="false" placeholder="Wklej tytuł newsa po angielsku…">' + esc(ex.title) + '</textarea>' +
        '<div class="nc-hint">Pisz — silnik liczy przy każdej literze. Słowa klucz po angielsku, jak w prawdziwych źródłach.</div>';
    }
    return head + '<div class="nc-title">' + esc(ex.title) + '</div>' + (ex.summary ? '<div class="nc-sum">' + esc(ex.summary) + '</div>' : '') +
      '<div class="nc-real">prawdziwy news z Privoty</div>';
  }

  function gptHtml(ex, res) {
    if (!ex.gpt) return '<div class="g-h">ChatGPT</div><div class="g-na">Własny tekst — w Privoty poszedłby teraz do ChatGPT z tym samym promptem.</div>';
    var g = ex.gpt;
    var out = '<div class="g-h">ChatGPT w Privoty · prawdziwa odpowiedź</div>' +
      '<div class="g-bar"><i style="left:' + res.weight_score + '%" class="me" title="nasz silnik"></i><i style="left:' + g.weight_score + '%" class="ai" title="ChatGPT"></i></div>' +
      '<div class="g-leg"><span class="me">nasz silnik ' + res.weight_score + ' · ' + esc(res.weight) + '</span><span class="ai">ChatGPT ' + g.weight_score + ' · ' + esc(g.weight) + '</span></div>' +
      '<div class="g-row"><b>Etap 1</b>wydźwięk ' + signed(g.tone) + ' · ' + esc(marketsText(g.markets)) + (g.event ? ' · termin ' + esc(g.event.start.slice(8, 10) + '.' + g.event.start.slice(5, 7)) : '') + '</div>' +
      '<div class="g-pl">„' + esc(g.title_pl) + '”</div>';
    if (ex.deep) {
      var d = ex.deep;
      var mk = ['btc', 'spx', 'gold', 'oil'].map(function (k) {
        var up = d[k][0], down = d[k][1];
        return MK[k] + ' ' + (up >= down ? '↑' + up : '↓' + down) + '%';
      }).join(' · ');
      out += '<div class="g-row deep"><b>Etap 2</b>4 zdjęcia rynku → czas wpływu ' + d.hours + ' h · w cenie ' + d.priced_in + '% · ' + esc(mk) + '</div>';
    }
    return out;
  }

  function render(fresh) {
    var ex = current === 'own' ? own : X.filter(function (e) { return e.id === current; })[0];
    if (!ex) return;
    var res = E.evaluate(ex);
    Array.prototype.forEach.call(pick.children, function (b) { b.classList.toggle('on', b.dataset.ex === current); });
    if (fresh) card.innerHTML = cardHtml(ex);
    code.innerHTML = codeLines(res);
    json.innerHTML = jsonHtml(res);
    var deep = res.weight_score >= 65;
    route.className = 'eng-route ' + (deep ? 'deep' : 'page');
    route.innerHTML = deep
      ? '<b>' + esc(res.weight) + ' → etap 2</b>zapis wątku „' + esc(res.topic || 'nowy wątek') + '” · ChatGPT na wyższych ustawieniach + 4 zdjęcia rynku'
      : '<b>' + esc(res.weight) + ' → od razu na stronę</b>bez drugiego pytania do AI';
    gpt.innerHTML = gptHtml(ex, res);
    if (fresh) {
      [code, json, route, gpt].forEach(function (el) { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); });
    }
  }

  pick.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ex]');
    if (!b) return;
    current = b.dataset.ex;
    render(true);
  });
  card.addEventListener('input', function (e) {
    if (e.target.id === 'ownText') own.title = e.target.value;
    if (e.target.id === 'ownSrc') {
      own.source = e.target.value;
      own.channel = (E.SOURCES.filter(function (q) { return q.id === own.source; })[0] || { channels: ['RSS'] }).channels[0];
      render(true);
      return;
    }
    render(false);
  });

  render(true);
})();
