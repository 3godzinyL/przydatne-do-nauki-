// Giełda Klubowa — front platformy.
// Lightweight Charts: osie, przesuwanie, zoom, skale, krzyżyk.
// Rust (WASM) + WebGL2: rysuje świece i wolumen pod biblioteką, w tej samej klatce.

import init, { ChartGl } from '../pkg/chart_gl.js';

const LW = window.LightweightCharts;
const $ = (id) => document.getElementById(id);

const INTERVALS = [
  ['1m', '1m'], ['3m', '3m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'],
  ['1h', '1h'], ['4h', '4h'], ['12h', '12h'], ['1d', '1D'], ['1w', '1W'],
];
const STEP_MS = {
  '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3,
  '1h': 3600e3, '4h': 14400e3, '12h': 43200e3, '1d': 86400e3, '1w': 604800e3,
};
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'TRXUSDT', 'PEPEUSDT'];
const UP = '#2fbf8f';
const DOWN = '#e5534b';
const CLEAR = 'rgba(0,0,0,0)';
// Biblioteka pokazuje czas UTC. Stałe przesunięcie o strefę komputera daje czas lokalny
// i zostaje rosnące (przesuwanie zależne od daty psułoby kolejność przy zmianie czasu).
const TZ = -new Date().getTimezoneOffset() * 60;
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const DAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const WS_HOSTS = ['wss://stream.binance.com:9443/ws/', 'wss://data-stream.binance.vision/ws/'];

const state = {
  symbol: 'BTCUSDT',
  interval: '1h',
  candles: [],            // [t, o, h, l, c, v] od najstarszej
  info: null,
  hasMore: true,
  token: 0,               // rośnie przy zmianie pary/interwału, stare odpowiedzi są pomijane
  loadingOlder: false,
  catching: false,
  ws: null,
  wsTimer: 0,
  wsOpen: false,
  hover: null,
  file: null,
};
try {
  const saved = JSON.parse(localStorage.getItem('gk-view') || '{}');
  if (saved.symbol) state.symbol = saved.symbol;
  if (STEP_MS[saved.interval]) state.interval = saved.interval;
} catch (e) { /* brak dostępu do localStorage */ }

const pad = (n) => String(n).padStart(2, '0');
const utc = (t) => new Date(t * 1000);

// Logo TradingView na wykresie wyłączone: licencja (Apache 2.0) wymaga wtedy oznaczenia i linku
// do tradingview.com w innym miejscu strony — jest w pasku stanu (#stLib w app.html).
// TradingView Lightweight Charts™ · Copyright (c) 2026 TradingView, Inc. https://www.tradingview.com/
const chart = LW.createChart($('chart'), {
  autoSize: true,
  layout: {
    attributionLogo: false,
    background: { type: LW.ColorType.Solid, color: 'transparent' },
    textColor: '#cfc2a2',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontSize: 12,
  },
  grid: {
    vertLines: { color: 'rgba(223,189,104,0.05)' },
    horzLines: { color: 'rgba(223,189,104,0.05)' },
  },
  rightPriceScale: { borderColor: '#3a3220', scaleMargins: { top: 0.1, bottom: 0.22 } },
  timeScale: {
    borderColor: '#3a3220', rightOffset: 10, barSpacing: 9, timeVisible: true, secondsVisible: false,
    tickMarkFormatter: (time, type) => {
      const d = utc(time);
      if (type === LW.TickMarkType.Year) return String(d.getUTCFullYear());
      if (type === LW.TickMarkType.Month) return MONTHS[d.getUTCMonth()];
      if (type === LW.TickMarkType.DayOfMonth) return String(d.getUTCDate());
      return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    },
  },
  crosshair: {
    mode: LW.CrosshairMode.Normal,
    vertLine: { color: 'rgba(223,189,104,0.45)', labelBackgroundColor: '#6b5c34' },
    horzLine: { color: 'rgba(223,189,104,0.45)', labelBackgroundColor: '#6b5c34' },
  },
  localization: {
    locale: 'pl-PL',
    timeFormatter: (time) => {
      const d = utc(time);
      const day = DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2);
      return STEP_MS[state.interval] >= 86400e3 ? day : day + '  ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
    },
  },
  kineticScroll: { mouse: true, touch: true },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
  handleScale: {
    mouseWheel: true, pinch: true,
    axisPressedMouseMove: { time: true, price: true },
    axisDoubleClickReset: { time: true, price: true },
  },
});

// Świece zostają w bibliotece (autoskala, krzyżyk, legenda), ale są przezroczyste — widać to, co rysuje Rust.
const HIDDEN = { upColor: CLEAR, downColor: CLEAR, borderVisible: false, wickVisible: false };
const SHOWN = { upColor: UP, downColor: DOWN, borderVisible: false, wickVisible: true, wickUpColor: UP, wickDownColor: DOWN };
const candleSeries = chart.addSeries(LW.CandlestickSeries, Object.assign({}, HIDDEN, { lastValueVisible: false, priceLineVisible: false }));
const volSeries = chart.addSeries(LW.HistogramSeries, {
  priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false, visible: false,
});
chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
const lastLine = candleSeries.createPriceLine({ price: 0, color: UP, lineWidth: 1, lineStyle: LW.LineStyle.Dashed, axisLabelVisible: true, title: '' });

let fmtPrice = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat('pl-PL');
const fmtVol = new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 2 });

const toTime = (c) => c[0] / 1000 + TZ;
const indicators = []; // panele wskaźników (np. ?ind=rsi); zwykły wykres ich nie ma
const toBar = (c) => ({ time: c[0] / 1000 + TZ, open: c[1], high: c[2], low: c[3], close: c[4] });
const toVol = (c) => ({ time: c[0] / 1000 + TZ, value: c[5], color: c[4] >= c[1] ? 'rgba(47,191,143,0.4)' : 'rgba(229,83,75,0.4)' });

// ---------------------------------------------------------------- Rust / WebGL2
const canvas = $('gl');
let gl = null;
let glError = '';
let glKey = '';
let glDirty = true;
const glStats = { visible: 0, ms: 0 };
let pane = { w: 0, h: 0, dpr: 0 };

function syncSize() {
  const ps = chart.paneSize(0);
  const dpr = window.devicePixelRatio || 1;
  if (ps.width === pane.w && ps.height === pane.h && dpr === pane.dpr) return;
  pane = { w: ps.width, h: ps.height, dpr };
  canvas.style.width = ps.width + 'px';
  canvas.style.height = ps.height + 'px';
  if (gl) gl.resize(ps.width, ps.height, dpr);
  const btn = $('toNow');
  btn.style.left = (ps.width - 42) + 'px';
  btn.style.top = (ps.height - 42) + 'px';
  glDirty = true;
}

// Mapowanie bierzemy z biblioteki: indeks świecy -> X, cena -> Y. Rust rysuje tylko widoczne świece.
function renderGl() {
  if (!gl) return;
  syncSize();
  const ts = chart.timeScale();
  const r = ts.getVisibleLogicalRange();
  if (!r || !state.candles.length || pane.h < 2) {
    if (glDirty) { gl.render(0, 0, 0, 0, 0, 0); glDirty = false; glKey = ''; }
    return;
  }
  const a = Math.floor(r.from);
  const b = Math.ceil(r.to) + 1;
  const xa = ts.logicalToCoordinate(a);
  const xb = ts.logicalToCoordinate(b);
  const pTop = candleSeries.coordinateToPrice(0);
  const pBottom = candleSeries.coordinateToPrice(pane.h);
  if (xa == null || xb == null || pTop == null || pBottom == null || pTop === pBottom) return;
  const step = (xb - xa) / (b - a);
  const x0 = xa - step * a;
  const pa = pane.h / (pBottom - pTop);
  const pb = -pa * pTop;
  const key = r.from + '|' + r.to + '|' + x0 + '|' + step + '|' + pa + '|' + pb;
  if (!glDirty && key === glKey) return;
  glKey = key;
  glDirty = false;
  const t0 = performance.now();
  glStats.visible = gl.render(r.from, r.to, x0, step, pa, pb);
  glStats.ms = performance.now() - t0;
}

// Prymityw biblioteki: jego draw() wywołuje się, gdy biblioteka maluje panel,
// więc canvas WebGL zmienia się w tej samej klatce co osie (brak rozjazdu przy przeciąganiu).
candleSeries.attachPrimitive({
  paneViews: () => [{ renderer: () => ({ draw: () => renderGl() }) }],
});

// Zawsze rysuje Rust/WebGL2. Biblioteka przejmuje świece sama tylko wtedy, gdy WebGL2 nie ruszy
// albo karta graficzna zgubi kontekst (sterownik, uśpienie) — i oddaje je, gdy kontekst wróci.
function createGl() {
  try {
    gl = new ChartGl(canvas);
    gl.set_colors(UP, DOWN, 0.4);
    glError = '';
    pane = { w: 0, h: 0, dpr: 0 }; // wymusza ustawienie rozmiaru nowego kontekstu
    uploadGl();
  } catch (e) {
    gl = null;
    glError = String(e && e.message || e);
    console.warn('Rust/WebGL2 niedostępny, świece rysuje biblioteka:', glError);
  }
  applyMode();
}

let wasmReady = false;
async function startGl() {
  try {
    await init();
    wasmReady = true;
  } catch (e) {
    glError = 'nie wczytał się moduł WASM';
    applyMode();
    return;
  }
  createGl();
}

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); // pozwala przeglądarce oddać kontekst później
  if (gl) { gl.free(); gl = null; }
  glError = 'karta graficzna zgubiła kontekst';
  applyMode();
});
canvas.addEventListener('webglcontextrestored', () => createGl());

function applyMode() {
  const rust = !!gl;
  candleSeries.applyOptions(rust ? HIDDEN : SHOWN);
  volSeries.applyOptions({ visible: !rust });
  canvas.style.display = rust ? '' : 'none';
  glDirty = true;
}

function uploadGl() {
  if (!gl) return;
  const cs = state.candles;
  const flat = new Float64Array(cs.length * 5);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], j = i * 5;
    flat[j] = c[1]; flat[j + 1] = c[2]; flat[j + 2] = c[3]; flat[j + 3] = c[4]; flat[j + 4] = c[5];
  }
  gl.set_candles(flat);
  glDirty = true;
}

// ---------------------------------------------------------------- dane
async function api(params) {
  const res = await fetch('/api/candles?' + new URLSearchParams(params));
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Serwer: HTTP ' + res.status);
  return j;
}

function decimals(tick) {
  return tick > 0 ? Math.max(0, Math.min(10, Math.round(-Math.log10(tick)))) : 2;
}

function applyInfo(info) {
  const dec = decimals(info.tickSize);
  fmtPrice = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  candleSeries.applyOptions({ priceFormat: { type: 'price', precision: dec, minMove: info.tickSize } });
  chart.applyOptions({ localization: { priceFormatter: (p) => fmtPrice.format(p) } });
}

function pushAll() {
  const cs = state.candles;
  candleSeries.setData(cs.map(toBar));
  volSeries.setData(cs.map(toVol));
  uploadGl();
  afterChange();
  for (const ind of indicators) ind.all(cs);
}

function pushLast() {
  const cs = state.candles;
  const c = cs[cs.length - 1];
  candleSeries.update(toBar(c));
  volSeries.update(toVol(c));
  if (gl) gl.upsert(cs.length - 1, c[1], c[2], c[3], c[4], c[5]);
  afterChange();
  for (const ind of indicators) ind.last(cs);
}

let titleAt = 0;
function afterChange() {
  const cs = state.candles;
  if (cs.length) {
    const c = cs[cs.length - 1];
    lastLine.applyOptions({ price: c[4], color: c[4] >= c[1] ? UP : DOWN });
    if (Date.now() - titleAt > 1000) {
      titleAt = Date.now();
      document.title = state.symbol + ' ' + fmtPrice.format(c[4]) + ' · Giełda Klubowa';
    }
  }
  glDirty = true;
  if (state.hover == null) legend();
}

async function load(symbol, interval) {
  const token = ++state.token;
  closeWs();
  $('loading').textContent = 'Ładuję ' + symbol + ' · ' + label(interval) + '…';
  $('loading').classList.add('on');
  try {
    const j = await api({ symbol, interval, limit: 1500 });
    if (token !== state.token) return;
    state.symbol = j.symbol;
    state.interval = j.interval;
    state.info = j.info;
    state.candles = j.candles;
    state.hasMore = j.hasMore;
    state.hover = null;
    applyInfo(j.info);
    chart.timeScale().applyOptions({ timeVisible: STEP_MS[interval] < 86400e3, barSpacing: 9, rightOffset: 10 });
    chart.priceScale('right').applyOptions({ autoScale: true });
    pushAll();
    chart.timeScale().scrollToRealTime();
    setFile(j);
    markInterval();
    $('symbol').value = state.symbol;
    try { localStorage.setItem('gk-view', JSON.stringify({ symbol: state.symbol, interval: state.interval })); } catch (e) { /* bez zapisu */ }
    openWs();
  } catch (e) {
    if (token !== state.token) return;
    toast(e.message);
    $('symbol').value = state.symbol;
    if (state.candles.length) openWs();
  } finally {
    if (token === state.token) $('loading').classList.remove('on');
  }
}

// Przewinięcie w lewo do początku danych => dociągamy starsze świece z serwera.
async function loadOlder() {
  if (state.loadingOlder || !state.hasMore || !state.candles.length) return;
  state.loadingOlder = true;
  const token = state.token;
  setHist();
  try {
    const j = await api({ symbol: state.symbol, interval: state.interval, limit: 1000, before: state.candles[0][0] });
    if (token !== state.token) return;
    if (j.candles.length) {
      state.candles = j.candles.concat(state.candles);
      pushAll();
    }
    state.hasMore = j.hasMore && j.candles.length > 0;
    setFile(j);
  } catch (e) {
    if (token === state.token) toast(e.message);
  } finally {
    state.loadingOlder = false;
    if (token === state.token) setHist();
  }
}

// Dociągnięcie brakujących świec (po uśpieniu komputera albo gdy WebSocket nie działa).
async function catchUp() {
  if (state.catching || !state.candles.length) return;
  state.catching = true;
  const token = state.token;
  try {
    const cs = state.candles;
    const j = await api({ symbol: state.symbol, interval: state.interval, since: cs[cs.length - 1][0] });
    if (token !== state.token) return;
    let added = 0;
    for (const c of j.candles) {
      const last = cs[cs.length - 1];
      if (c[0] === last[0]) cs[cs.length - 1] = c;
      else if (c[0] > last[0]) { cs.push(c); added++; }
    }
    if (added > 1) pushAll(); else if (j.candles.length) pushLast();
    setFile(j);
  } catch (e) {
    /* następna próba za chwilę */
  } finally {
    state.catching = false;
  }
}

function onKline(c) {
  const cs = state.candles;
  if (!cs.length) return;
  const last = cs[cs.length - 1];
  if (c[0] < last[0]) return;
  if (c[0] === last[0]) cs[cs.length - 1] = c;
  else if (c[0] === last[0] + STEP_MS[state.interval]) cs.push(c);
  else return catchUp(); // luka — bierzemy brakujące świece z serwera
  pushLast();
}

// ---------------------------------------------------------------- na żywo (WebSocket Binance)
function openWs() {
  closeWs();
  const token = state.token;
  const stream = state.symbol.toLowerCase() + '@kline_' + state.interval;
  let attempt = 0;
  const connect = () => {
    if (token !== state.token) return;
    const ws = new WebSocket(WS_HOSTS[attempt % WS_HOSTS.length] + stream);
    state.ws = ws;
    ws.onopen = () => { attempt = 0; setLive(true); catchUp(); };
    ws.onmessage = (ev) => {
      const k = JSON.parse(ev.data).k;
      if (k && token === state.token) onKline([k.t, +k.o, +k.h, +k.l, +k.c, +k.v]);
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      if (state.ws !== ws) return;
      setLive(false);
      attempt++;
      state.wsTimer = setTimeout(connect, Math.min(10000, 1000 * attempt));
    };
  };
  connect();
}

function closeWs() {
  clearTimeout(state.wsTimer);
  const ws = state.ws;
  state.ws = null;
  if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); }
  setLive(false);
}

// Bez WebSocketu co 5 s pytamy własny serwer (on dociąga z Binance i zapisuje do JSON).
setInterval(() => { if (!state.wsOpen) catchUp(); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) catchUp(); });

// ---------------------------------------------------------------- interfejs
function label(iv) {
  const f = INTERVALS.find((x) => x[0] === iv);
  return f ? f[1] : iv;
}

function buildToolbar() {
  const tfs = $('tfs');
  for (const [iv, txt] of INTERVALS) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.dataset.iv = iv;
    b.onclick = () => { if (iv !== state.interval) load(state.symbol, iv); };
    tfs.appendChild(b);
  }
  $('symbols').innerHTML = SYMBOLS.map((s) => '<option value="' + s + '">').join('');
  const input = $('symbol');
  const go = () => {
    const s = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s && s !== state.symbol) load(s, state.interval);
    else input.value = state.symbol;
  };
  input.addEventListener('change', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { go(); input.blur(); } if (e.key === 'Escape') { input.value = state.symbol; input.blur(); } });
  input.addEventListener('focus', () => input.select());

  $('toNow').onclick = () => chart.timeScale().scrollToRealTime();
  $('auto').onclick = () => {
    const on = chart.priceScale('right').options().autoScale;
    chart.priceScale('right').applyOptions({ autoScale: !on });
  };
}

function markInterval() {
  for (const b of $('tfs').children) b.classList.toggle('on', b.dataset.iv === state.interval);
}

function setLive(on) {
  state.wsOpen = on;
  const el = $('live');
  el.classList.toggle('on', on);
  el.querySelector('span').textContent = on ? 'Na żywo' : 'Łączę…';
}

function fmtBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

function setFile(j) {
  state.file = j;
  $('stFile').textContent = j.file;
  $('stFile').title = 'Plik na serwerze: ' + fmtInt.format(j.stored) + ' świec';
  setHist();
}

function setHist() {
  const j = state.file;
  if (!j) return;
  const where = fmtInt.format(j.stored) + ' świec w pliku' + (j.bytes ? ' · ' + fmtBytes(j.bytes) : '');
  const hist = state.loadingOlder ? 'dociągam starszą historię…'
    : state.hasMore ? 'przewiń w lewo — dociągnie starsze' : 'cała historia z Binance';
  $('stHist').textContent = where + '  ·  na wykresie ' + fmtInt.format(state.candles.length) + '  ·  ' + hist;
}

function legend() {
  const cs = state.candles;
  const i = state.hover != null ? state.hover : cs.length - 1;
  const c = cs[i];
  const base = state.info ? state.info.base + '/' + state.info.quote : state.symbol;
  if (!c) { $('legend').innerHTML = '<span class="name">' + base + '</span>'; return; }
  const prev = cs[i - 1];
  const ref = prev ? prev[4] : c[1];
  const ch = ref ? (c[4] - ref) / ref * 100 : 0;
  const cls = c[4] >= c[1] ? 'u' : 'd';
  const v = (k, val) => '<span><span class="k">' + k + '</span><span class="' + cls + '">' + val + '</span></span>';
  $('legend').innerHTML =
    '<span class="name">' + base + '</span><span class="tf">' + label(state.interval) + ' · Binance</span>' +
    v('O', fmtPrice.format(c[1])) + v('H', fmtPrice.format(c[2])) + v('L', fmtPrice.format(c[3])) + v('C', fmtPrice.format(c[4])) +
    '<span class="' + (ch >= 0 ? 'u' : 'd') + '">' + (ch >= 0 ? '+' : '') + ch.toFixed(2).replace('.', ',') + '%</span>' +
    '<span><span class="k">Wol.</span>' + fmtVol.format(c[5]) + '</span>';
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
}

chart.subscribeCrosshairMove((p) => {
  const n = state.candles.length;
  const idx = p && p.point && p.logical != null ? Math.round(p.logical) : null;
  const hover = idx != null && idx >= 0 && idx < n ? idx : null;
  if (hover === state.hover) return;
  state.hover = hover;
  legend();
});

// Sprawdzamy w następnej klatce: przy zmianie pary/interwału zakres na moment jest jeszcze stary.
let olderCheck = 0;
chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
  glDirty = true;
  if (olderCheck) return;
  olderCheck = requestAnimationFrame(() => {
    olderCheck = 0;
    const r = chart.timeScale().getVisibleLogicalRange();
    if (r && r.from < 80) loadOlder();
  });
});

// Pętla pomocnicza: rozmiar canvasu, przyciski Auto i », statystyki Rusta.
let uiAt = 0;
function tick(now) {
  requestAnimationFrame(tick);
  syncSize();
  renderGl();
  if (now - uiAt < 250) return;
  uiAt = now;
  $('auto').classList.toggle('on', chart.priceScale('right').options().autoScale);
  $('toNow').classList.toggle('on', chart.timeScale().scrollPosition() < -3);
  $('stGl').innerHTML = gl
    ? '<b>Rust · WebGL2</b> · ' + fmtInt.format(glStats.visible) + ' świec · ' + glStats.ms.toFixed(2).replace('.', ',') + ' ms'
    : 'świece rysuje biblioteka' + (glError ? ' (' + glError.slice(0, 50) + ')' : '');
}

// W prezentacji platforma jest w ramce — klawisze pilota przekazujemy slajdom.
if (window.parent !== window) {
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (['PageDown', 'PageUp', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'f', 'F', 'n', 'N'].includes(e.key)) {
      e.preventDefault();
      window.parent.postMessage({ type: 'deck-key', key: e.key }, location.origin);
    }
  });
}

// Podgląd w konsoli przeglądarki (F12): gk.state, gk.chart, gk.glStats
window.gk = { state, chart, glStats, get gl() { return gl; }, get canvas() { return canvas; } };

buildToolbar();
markInterval();
$('symbol').value = state.symbol;
await startGl();
applyMode();
if (new URLSearchParams(location.search).get('ind') === 'rsi') {
  const { attachRsi } = await import('./rsi.js');
  indicators.push(attachRsi({ LW, chart, toTime, wasm: wasmReady }));
}
requestAnimationFrame(tick);
load(state.symbol, state.interval);
