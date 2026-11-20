(function () {
  'use strict';

  // Slajd 7: wykres, na którym „AI sama rysuje” Smart Money Concepts — płynność pod dołkiem,
  // zebranie jej knotem, order block, FVG i BOS, a na końcu wejście przez API giełdy.
  // Świece są przykładowe (ręcznie ułożone), żeby każdy element SMC był czytelny.
  var svg = document.getElementById('smcChart');
  if (!svg) return;

  // [open, high, low, close]
  var C = [
    [70, 71, 66, 68], [68, 69, 64, 66], [66, 68, 64, 67], [67, 68, 62, 64], [64, 66, 62, 65], [65, 70, 64, 69],
    [69, 74, 68, 72], [72, 73, 69, 70], [70, 71, 66, 67], [67, 68, 63, 65], [65, 66, 61, 63], [63, 65, 57, 64],
    [64, 65, 61, 62], [62, 71, 62, 70], [70, 76, 69, 75], [75, 78, 74, 77], [77, 78, 73, 74], [74, 75, 70, 71],
    [71, 72, 67, 69.5], [69.5, 75, 69, 74], [74, 79, 73, 78], [78, 82, 77, 81], [81, 83, 79, 80], [80, 85, 79, 84],
  ];
  var W = 960, H = 330, L = 20, R = 860, TOP = 20, BOT = 300, PMIN = 55, PMAX = 87;
  var step = (R - L) / C.length;
  var x = function (i) { return L + step * (i + 0.5); };
  var y = function (p) { return BOT - (p - PMIN) / (PMAX - PMIN) * (BOT - TOP); };
  var bw = step * 0.56;
  var out = '';

  C.forEach(function (k, i) {
    var up = k[3] >= k[0], col = up ? '#2fbf8f' : '#e5534b';
    var top = y(Math.max(k[0], k[3])), h = Math.max(2, Math.abs(y(k[0]) - y(k[3])));
    out += '<g class="cd" style="--k:' + i + '"><line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + y(k[1]) + '" y2="' + y(k[2]) + '" stroke="' + col + '" stroke-width="2"/>' +
      '<rect x="' + (x(i) - bw / 2) + '" y="' + top + '" width="' + bw + '" height="' + h + '" fill="' + col + '"/></g>';
  });

  // 1) płynność pod równymi dołkami (świece 3–4) i jej zebranie knotem świecy 11
  out += '<g class="ann" style="--a:0">' +
    '<line class="liq" x1="' + x(3) + '" x2="' + x(11) + '" y1="' + y(62) + '" y2="' + y(62) + '"/>' +
    '<text class="tl" x="' + (x(3) - 6) + '" y="' + (y(62) + 22) + '">płynność</text>' +
    '<circle class="sweep" cx="' + x(11) + '" cy="' + y(57) + '" r="9"/>' +
    '<text class="tl" x="' + (x(11) + 14) + '" y="' + (y(57) + 6) + '">zebrana</text></g>';
  // 2) order block = ostatnia spadkowa świeca przed mocnym wybiciem (12)
  out += '<g class="ann" style="--a:1">' +
    '<rect class="ob" x="' + (x(12) - bw / 2) + '" y="' + y(65) + '" width="' + (R - x(12) + bw / 2) + '" height="' + (y(61) - y(65)) + '"/>' +
    '<text class="tz" x="' + (R - 8) + '" y="' + (y(61) - 7) + '" text-anchor="end">OB</text></g>';
  // 3) FVG = luka między szczytem świecy 12 a dołkiem świecy 14
  out += '<g class="ann" style="--a:2">' +
    '<rect class="fvg" x="' + x(13) + '" y="' + y(69) + '" width="' + (R - x(13)) + '" height="' + (y(65) - y(69)) + '"/>' +
    '<text class="tz" x="' + (R - 8) + '" y="' + (y(65) - 8) + '" text-anchor="end">FVG</text></g>';
  // 4) BOS = przebicie ostatniego szczytu (świeca 6) przez świecę 14
  out += '<g class="ann" style="--a:3">' +
    '<line class="bos" x1="' + x(6) + '" x2="' + x(15) + '" y1="' + y(74) + '" y2="' + y(74) + '"/>' +
    '<text class="tb" x="' + ((x(6) + x(15)) / 2) + '" y="' + (y(74) - 10) + '" text-anchor="middle">BOS</text></g>';
  // 5) wejście po powrocie do FVG (świeca 18) — zlecenie przez API
  out += '<g class="ann" style="--a:4">' +
    '<path class="ent" d="M' + x(18) + ',' + (y(67) + 30) + ' l-10,16 h20 Z"/>' +
    '<text class="te" x="' + x(18) + '" y="' + (y(67) + 70) + '" text-anchor="middle">AI: long · zlecenie przez API</text></g>';

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = out;
})();
