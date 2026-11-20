// Silnik newsów — schemat 1:1 z Privoty (zakładka News), wersja do nauki, bez AI.
//
//   1. ŹRÓDŁA → KANAŁY     każdy podmiot (Trump, Biały Dom, Fed…) ma kilka kanałów (X, strona, RSS)
//   2. SITO (ten plik)      słownik reguł: waga 0–100, wydźwięk, kierunek rynków, „teraz / kalendarz”
//   3. ETAP 1 · ChatGPT     zawsze ten sam prompt → odpowiedź TYLKO w JSON (te same pola co tutaj)
//   4. ROZDZIELNIK          niska / średnia → od razu na stronę; wysoka+ → zapis wątku i etap 2
//   5. ETAP 2 · ChatGPT     wyższe ustawienia + 4 zdjęcia rynku → czas wpływu i szansa góra / dół
//
// Ten plik działa w przeglądarce (slajd 6) i w Node: const { evaluate } = require('./news-engine').
(function (root) {
  'use strict';

  // Poziom źródła = punkty startowe. Oficjalny komunikat > agencja > media > komentarz.
  var TIERS = {
    pierwotne: { label: 'pierwotne', base: 15 },  // sam podmiot: Trump, Biały Dom, Fed
    oficjalne: { label: 'oficjalne', base: 12 },  // instytucje: EBC, SEC, USTR, dane makro
    agencja: { label: 'serwis rynkowy', base: 8 }, // szybkie serwisy: InvestingLive, CNBC, FT
    media: { label: 'media', base: 5 },            // ogólne i krypto-media
  };

  // 20 źródeł i ich kanały (w Privoty 25+; X jest tu dla przykładu — jego API jest płatne).
  var SOURCES = [
    { id: 'trump', name: 'Donald Trump', tier: 'pierwotne', channels: ['Truth Social', 'X'] },
    { id: 'whitehouse', name: 'Biały Dom', tier: 'pierwotne', channels: ['strona', 'dekrety', 'fact sheets', 'oświadczenia'] },
    { id: 'musk', name: 'Elon Musk', tier: 'pierwotne', channels: ['X'] },
    { id: 'fed', name: 'Fed', tier: 'pierwotne', channels: ['komunikaty', 'wystąpienia'] },
    { id: 'ecb', name: 'EBC', tier: 'oficjalne', channels: ['RSS'] },
    { id: 'boj', name: 'Bank Japonii', tier: 'oficjalne', channels: ['RSS'] },
    { id: 'boe', name: 'Bank Anglii', tier: 'oficjalne', channels: ['RSS'] },
    { id: 'sec', name: 'SEC', tier: 'oficjalne', channels: ['komunikaty'] },
    { id: 'ustr', name: 'USTR · cła', tier: 'oficjalne', channels: ['RSS'] },
    { id: 'bea', name: 'BEA · dane USA', tier: 'oficjalne', channels: ['RSS'] },
    { id: 'calendar', name: 'Kalendarz makro', tier: 'oficjalne', channels: ['JSON'] },
    { id: 'investinglive', name: 'InvestingLive', tier: 'agencja', channels: ['RSS'] },
    { id: 'fxstreet', name: 'FXStreet', tier: 'agencja', channels: ['RSS'] },
    { id: 'cnbc', name: 'CNBC', tier: 'agencja', channels: ['RSS'] },
    { id: 'ft', name: 'Financial Times', tier: 'agencja', channels: ['RSS'] },
    { id: 'marketwatch', name: 'MarketWatch', tier: 'agencja', channels: ['RSS'] },
    { id: 'aljazeera', name: 'Al Jazeera', tier: 'media', channels: ['RSS'] },
    { id: 'bbc', name: 'BBC', tier: 'media', channels: ['RSS'] },
    { id: 'coindesk', name: 'CoinDesk', tier: 'media', channels: ['RSS'] },
    { id: 'theblock', name: 'The Block', tier: 'media', channels: ['RSS'] },
  ];

  // Reguły: wzorzec w tekście → punkty wagi, wydźwięk (−100…+100) i kierunek rynków (−2…+2).
  // To ta sama „rubryka”, którą ChatGPT dostaje w prompcie etapu 1 — tylko zapisana w kodzie.
  var RULES = [
    { id: 'ropa', re: /hormuz|ormuz|tanker|oil (?:route|supply)|pipeline/, w: 30, tone: -30, m: { btc: -1, spx: -1, gold: 1, oil: 2 }, topic: 'Ormuz i ropa', why: 'zagrożony szlak ropy' },
    { id: 'wojsko', re: /\bwar\b|attack|missile|airstrike|drones?\b|shoot(?:s)? down|military|invasion/, w: 40, tone: -30, m: { btc: -1, spx: -1, gold: 1, oil: 1 }, topic: 'Konflikty zbrojne', why: 'incydent militarny' },
    { id: 'mocarstwa', re: /\bnato\b|\biran\b|russia|china|israel/, w: 20, tone: -10, m: {}, why: 'w sprawę wchodzi mocarstwo' },
    { id: 'stopy', re: /rate (?:cut|hike|decision)|fomc|powell|lagarde|interest rates?/, w: 40, tone: 0, m: {}, topic: 'Banki centralne: stopy', why: 'decyzja o stopach' },
    { id: 'obniżka', re: /rate cuts?|cuts? (?:interest )?rates|dovish/, w: 0, tone: 30, m: { btc: 1, spx: 1, gold: 1 }, why: 'tańszy pieniądz' },
    { id: 'podwyżka', re: /rate hikes?|raises? (?:interest )?rates|hawkish/, w: 0, tone: -30, m: { btc: -1, spx: -1, gold: -1 }, why: 'droższy pieniądz' },
    { id: 'niespodzianka', re: /surprise|unexpected|emergency|effective immediately/, w: 20, tone: 0, m: {}, why: 'niespodzianka względem oczekiwań' },
    { id: 'dane', re: /\bcpi\b|inflation|payrolls|\bnfp\b|\bgdp\b|\bpce\b|jobs report/, w: 30, tone: 0, m: {}, topic: 'Dane makro USA', why: 'kluczowe dane makro' },
    { id: 'cla', re: /tariff|trade war|duties|export control/, w: 35, tone: -25, m: { btc: -1, spx: -2, gold: 1 }, topic: 'Cła USA', why: 'cła i handel' },
    { id: 'sankcje', re: /sanction|embargo/, w: 25, tone: -15, m: { spx: -1, oil: 1 }, topic: 'Sankcje', why: 'sankcje' },
    { id: 'hack', re: /hack|exploit|drained|stolen|bankrupt|insolven/, w: 25, tone: -25, m: { btc: -1 }, topic: 'Krypto: włamania', why: 'włamanie lub upadłość' },
    { id: 'krypto', re: /bitcoin|\bbtc\b|crypto|stablecoin|ethereum|\betf\b/, w: 8, tone: 0, m: {}, why: 'temat krypto' },
    { id: 'adopcja', re: /payments?|adoption|visa|mastercard|stripe|integrat/, w: 16, tone: 10, m: { btc: 1 }, why: 'adopcja i płatności' },
    { id: 'wzrost', re: /jumps?|surges?|record high|soars?|\d+%/, w: 6, tone: 5, m: {}, why: 'wyraźna zmiana liczb' },
    { id: 'kwota', re: /\$\s?\d[\d.,]*\s?(?:billion|bn|trillion)|\d+ (?:billion|trillion)/, w: 6, tone: 0, m: {}, why: 'duża kwota' },
    { id: 'pokoj', re: /ceasefire|truce|peace (?:deal|talks)|de-?escalat/, w: 25, tone: 35, m: { btc: 1, spx: 1, gold: -1, oil: -1 }, topic: 'Rozmowy pokojowe', why: 'deeskalacja' },
  ];
  // Szum: kampania, poparcia, wpisy okolicznościowe, transmisje — w Privoty to najczęstszy wpis Trumpa.
  var NOISE = { id: 'szum', re: /vote for|endorse|big crowd|watching it now|coverage is|congratulat|happy birthday|rally\b|youtube\.com/, w: -30, why: 'kampania lub wpis okolicznościowy' };

  // „Teraz” czy „kalendarz”: czy coś się już stało, czy news zapowiada termin.
  var HAPPENED = /\b(?:hit|shot|shoots? down|attacked|killed|announced|signed|raised|cut|jumps?|surged?|fell|rose|confirms?|says|said)\b/;
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  var DAYS_PL = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var FUTURE = /((?:[a-z0-9-]+ ){0,2})(?:to )?(meet|meeting|vote|decision|deadline|talks|speech|release)\b[^.]{0,30}?\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tomorrow|next week)\b/;
  var WHAT = { meet: 'spotkanie', meeting: 'spotkanie', vote: 'głosowanie', decision: 'decyzja', deadline: 'termin', talks: 'rozmowy', speech: 'wystąpienie', release: 'publikacja' };

  // Pasma wagi — te same co w prompcie ChatGPT (etap 1).
  var LEVELS = [
    { id: 'niska', min: 0 }, { id: 'średnia', min: 40 }, { id: 'wysoka', min: 65 }, { id: 'bardzo wysoka', min: 85 },
  ];
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function sourceOf(id) {
    for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i].id === id) return SOURCES[i];
    return { id: id, name: id, tier: 'media', channels: ['RSS'] };
  }

  function eventOf(text, publishedAt) {
    var m = FUTURE.exec(text);
    if (!m) return null;
    var word = m[3], d = new Date(publishedAt), add = 1;
    var wd = DAYS.indexOf(word);
    if (wd >= 0) add = ((wd - d.getUTCDay() + 7) % 7) || 7;
    else if (word === 'next week') add = 7;
    var day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add));
    var who = m[1].trim();
    return { start: day.toISOString().slice(0, 10), precision: 'dzień', title: WHAT[m[2]] + (who ? ' · ' + who : '') + (wd >= 0 ? ' (' + DAYS_PL[wd] + ')' : '') };
  }

  function shortText(title) {
    var t = String(title || '').replace(/\s+/g, ' ').trim();
    var cut = t.split(/(?<=[.!?;])\s/)[0];
    return cut.length > 110 ? cut.slice(0, 109).replace(/\s+\S*$/, '') + '…' : cut;
  }

  // Główna funkcja: news → ocena w tym samym formacie, jaki zwraca ChatGPT w etapie 1.
  function evaluate(news) {
    var src = sourceOf(news.source);
    var tier = TIERS[src.tier];
    var text = (String(news.title || '') + ' ' + String(news.summary || '')).toLowerCase();
    var fired = [{ id: 'źródło', w: tier.base, why: 'źródło: ' + tier.label }];
    var score = tier.base, tone = 0, markets = { btc: 0, spx: 0, gold: 0, oil: 0 }, topic = null, best = 0;

    RULES.concat([NOISE]).forEach(function (r) {
      if (!r.re.test(text)) return;
      fired.push({ id: r.id, w: r.w, why: r.why });
      score += r.w;
      tone += r.tone || 0;
      for (var k in r.m || {}) markets[k] += r.m[k];
      if (r.topic && r.w > best) { best = r.w; topic = r.topic; }
    });

    score = clamp(Math.round(score), 0, 100);
    var level = LEVELS[0].id;
    LEVELS.forEach(function (l) { if (score >= l.min) level = l.id; });
    for (var k in markets) markets[k] = clamp(markets[k], -2, 2);
    var event = eventOf(text, news.time);
    var horizon = event && !HAPPENED.test(text) ? 'kalendarz' : 'teraz';
    var deep = score >= 65;

    return {
      source: { name: src.name, channel: news.channel || src.channels[0], tier: tier.label },
      weight: level,
      weight_score: score,
      tone: clamp(Math.round(tone / 5) * 5, -100, 100),
      markets: markets,
      horizon: horizon,
      event: event,
      short: shortText(news.title),
      topic: deep ? topic : null,
      route: deep ? 'etap 2: zapis wątku + ChatGPT na wyższych ustawieniach + 4 zdjęcia rynku' : 'od razu na stronę',
      fired: fired,
    };
  }

  var api = { SOURCES: SOURCES, TIERS: TIERS, RULES: RULES, NOISE: NOISE, LEVELS: LEVELS, evaluate: evaluate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NewsEngine = api;
})(this);
