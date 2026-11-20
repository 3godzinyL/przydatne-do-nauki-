(function () {
  'use strict';

  // Slajd 4: ile tokenów czyta AI przy każdym zapytaniu (cała rozmowa od nowa).
  // Dane z plików sesji Claude Code (jsonl) z 20.11, kontekst = input + cache read + cache write
  // jednego zapytania, w tysiącach tokenów.
  // Stary czat: 100 zapytań w 4 promptach. Nowy czat (ta konsola): 55 zapytań przy slajdach 4–6.
  var OLD = [54,62,80,85,87,99,120,121,128,129,134,136,138,139,154,155,165,169,171,172,174,176,178,182,184,185,186,188,188,189,
    199,200,201,202,208,211,211,214,217,219,220,221,221,223,223,224,226,237,243,245,246,247,256,257,278,281,286,290,298,300,
    301,304,305,305,307,329,330,334,335,337,343,349,350,352,362,363,372,373,374,382,388,390,395,399,400,402,412,421,423,428,
    431,432,441,444,446,448,449,453,455,456];
  var NEW = [52,58,63,71,76,78,79,82,98,99,114,121,123,124,125,131,132,133,138,140,141,151,152,155,160,160,165,165,166,166,
    169,170,172,176,179,185,186,189,191,192,196,198,203,204,205,210,211,212,214,215,216,217,218,221,221];
  // Symulacja: te same kroki doklejone do starej rozmowy = kontekst końca starego czatu + przyrost nowego.
  var SIM = NEW.map(function (k) { return OLD[OLD.length - 1] + (k - NEW[0]); });
  var SEGS = [
    { n: 46, name: '1 · platforma', min: '23 min', read: '7,7 mln' },
    { n: 18, name: '2 · poprawki', min: '10,5 min', read: '4,9 mln' },
    { n: 21, name: '3 · film + RSI', min: '13,5 min', read: '7,6 mln' },
    { n: 15, name: '4 · poprawka', min: '6,8 min', read: '6,5 mln', hot: true },
  ];

  var svg = document.getElementById('tokChart');
  if (!svg) return;
  var W = 1640, H = 452;
  var X0 = 96, Y0 = 374, YT = 22, MAX = 700;
  var STEP = 8.7, GAP = 70;
  var X1 = X0 + OLD.length * STEP;
  var NX0 = X1 + GAP;
  var NX1 = NX0 + NEW.length * STEP;
  var xo = function (i) { return X0 + (i + 0.5) * STEP; };
  var xn = function (i) { return NX0 + (i + 0.5) * STEP; };
  var y = function (k) { return Y0 - k / MAX * (Y0 - YT); };
  var f1 = function (v) { return v.toFixed(1); };
  var out = '', grid = '';

  // siatka i oś (dokładane nad zasłoną, żeby nie znikały podczas odsłaniania)
  [100, 200, 300, 400, 500, 600, 700].forEach(function (k) {
    grid += '<line class="g" x1="' + X0 + '" x2="' + NX1 + '" y1="' + y(k) + '" y2="' + y(k) + '"/>' +
      '<text class="ax" x="' + (X0 - 14) + '" y="' + (y(k) + 6) + '" text-anchor="end">' + k + ' tys.</text>';
  });
  grid += '<line class="base" x1="' + X0 + '" x2="' + NX1 + '" y1="' + Y0 + '" y2="' + Y0 + '"/>';

  function pts(vals, x) {
    return vals.map(function (k, i) { return f1(x(i)) + ',' + f1(y(k)); });
  }
  function area(vals, x, a, b, left, right) {
    var d = 'M' + f1(left) + ',' + Y0 + ' L' + f1(left) + ',' + f1(y(vals[a]));
    for (var i = a; i <= b; i++) d += ' L' + f1(x(i)) + ',' + f1(y(vals[i]));
    return d + ' L' + f1(right) + ',' + f1(y(vals[b])) + ' L' + f1(right) + ',' + Y0 + ' Z';
  }

  // stary czat: pole pod krzywą = tokeny przeczytane w danym prompcie
  var i0 = 0;
  SEGS.forEach(function (s, k) {
    var a = i0, b = i0 + s.n - 1;
    var left = k === 0 ? X0 : (xo(a - 1) + xo(a)) / 2;
    var right = k === SEGS.length - 1 ? X1 : (xo(b) + xo(b + 1)) / 2;
    out += '<path class="area' + (s.hot ? ' hot' : '') + '" d="' + area(OLD, xo, a, b, left, right) + '"/>';
    if (k > 0) out += '<line class="sep" x1="' + left + '" x2="' + left + '" y1="' + (y(OLD[a]) - 10) + '" y2="' + Y0 + '"/>';
    var cx = (left + right) / 2;
    out += '<text class="rd' + (s.hot ? ' hot' : '') + '" x="' + cx + '" y="' + (Y0 - 18) + '" text-anchor="middle">' + s.read + '</text>' +
      '<text class="nm' + (s.hot ? ' hot' : '') + '" x="' + cx + '" y="' + (Y0 + 34) + '" text-anchor="middle">' + s.name + '</text>' +
      '<text class="mn" x="' + cx + '" y="' + (Y0 + 60) + '" text-anchor="middle">' + s.min + '</text>';
    i0 += s.n;
  });
  var oEnd = OLD[OLD.length - 1];
  out += '<path class="ln" d="M' + pts(OLD, xo).join(' L') + '"/>' +
    '<circle class="end" cx="' + xo(OLD.length - 1) + '" cy="' + y(oEnd) + '" r="6"/>' +
    '<text class="endt" x="' + (xo(OLD.length - 1) - 12) + '" y="' + (y(oEnd) - 14) + '" text-anchor="end">456 tys. na krok</text>';

  // dopisek: mała poprawka czyta prawie tyle, co budowa całej platformy
  out += '<text class="cl" x="' + (X0 + 24) + '" y="' + y(640) + '"><tspan class="hot">4 · mała poprawka:</tspan> 6,8 min pracy, a przeczytała <tspan class="hot">6,5 mln</tspan></text>' +
    '<text class="cl" x="' + (X0 + 24) + '" y="' + (y(640) + 30) + '">prawie tyle, co budowa całej platformy <tspan class="dim">(1 · 23 min, 7,7 mln)</tspan></text>';

  // zasłona odsłaniana od lewej (rysowanie jak na wykresach Privoty)
  out += '<rect class="wipe" x="' + (X0 - 2) + '" y="' + (YT - 16) + '" width="' + (X1 - X0 + 24) + '" height="' + (Y0 - YT + 14) + '"/>';
  out += grid;

  // nowy czat (ta konsola)
  var sx = (NX0 + NX1) / 2, nEnd = NEW[NEW.length - 1], sEnd = SIM[SIM.length - 1];
  out += '<g class="nc">' +
    '<line class="sep" x1="' + (X1 + GAP / 2) + '" x2="' + (X1 + GAP / 2) + '" y1="' + YT + '" y2="' + (Y0 + 66) + '" style="stroke-dasharray:2 7"/>' +
    '<text class="gapt" text-anchor="middle" transform="translate(' + (X1 + GAP / 2 - 9) + ' ' + y(230) + ') rotate(-90)">nowa konsola</text>' +
    '<path class="narea" d="' + area(NEW, xn, 0, NEW.length - 1, NX0, NX1) + '"/>' +
    '<path class="nln" d="M' + pts(NEW, xn).join(' L') + '"/>' +
    '<text class="rd hot" x="' + sx + '" y="' + (Y0 - 18) + '" text-anchor="middle">8,6 mln</text>' +
    '<text class="nk" x="' + (NX0 + 6) + '" y="' + (y(NEW[0]) - 12) + '">52 tys.</text>' +
    '<text class="nm hot" x="' + sx + '" y="' + (Y0 + 34) + '" text-anchor="middle">nowy czat · slajdy 4–6</text>' +
    '<text class="mn" x="' + sx + '" y="' + (Y0 + 60) + '" text-anchor="middle">15,6 min</text>' +
    '</g>';

  // symulacja: te same kroki doklejone do starej rozmowy (pas między krzywymi = nadmiar)
  var gapBand = 'M' + pts(SIM, xn).join(' L') + ' L' + pts(NEW, xn).reverse().join(' L') + ' Z';
  var midY = (y(sEnd) + y(nEnd)) / 2;
  out += '<g class="sim">' +
    '<path class="sarea" d="' + gapBand + '"/>' +
    '<path class="sln" d="M' + f1(xo(OLD.length - 1)) + ',' + f1(y(oEnd)) + ' L' + pts(SIM, xn).join(' L') + '"/>' +
    '<text class="st" x="' + sx + '" y="' + f1(y(sEnd) - 44) + '" text-anchor="middle">gdybym został w starym czacie</text>' +
    '<text class="sv" x="' + sx + '" y="' + f1(y(sEnd) - 14) + '" text-anchor="middle">30,8 mln</text>' +
    '<line class="br" x1="' + (NX1 + 12) + '" x2="' + (NX1 + 12) + '" y1="' + f1(y(sEnd)) + '" y2="' + f1(y(nEnd)) + '"/>' +
    '<text class="x9" x="' + (NX1 + 24) + '" y="' + f1(midY + 2) + '">3,6×</text>' +
    '<text class="x9s" x="' + (NX1 + 24) + '" y="' + f1(midY + 28) + '">mniej</text>' +
    '</g>';

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = out;
})();
