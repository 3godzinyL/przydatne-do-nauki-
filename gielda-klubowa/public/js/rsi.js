// RSI w osobnym panelu pod wykresem.
// Liczy Rust (WASM, przyrostowo), rysuje WebGL2 (kolor linii i stref wybiera shader).
// Biblioteka daje panel, skalę 0–100, krzyżyk i wspólną oś czasu — serwer nic tu nie liczy.

import { RsiPane, rsi as rsiAll } from '../pkg/chart_gl.js';

const PERIOD = 14;
const HI = '#e5534b';   // > 70 — wykupienie
const LO = '#2fbf8f';   // < 30 — wyprzedanie
const MID = '#a374ff';  // fioletowa linia RSI
const CLEAR = 'rgba(0,0,0,0)';
const fmt = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Zapas bez WASM (ten sam wzór Wildera, tylko w JS).
function jsRsi(closes, p) {
  const out = new Array(closes.length).fill(NaN);
  let g = 0, l = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (i <= p) { g += Math.max(d, 0); l += Math.max(-d, 0); if (i < p) continue; g /= p; l /= p; }
    else { g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p; }
    out[i] = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
  }
  return out;
}

const zone = (v) => (v > 70 ? HI : v < 30 ? LO : MID);

export function attachRsi({ LW, chart, toTime, wasm }) {
  const wrap = document.getElementById('wrap');
  chart.applyOptions({ layout: { panes: { separatorColor: '#2e281a', separatorHoverColor: 'rgba(223,189,104,0.25)' } } });

  const series = chart.addSeries(LW.LineSeries, {
    color: CLEAR, lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
  }, 1);
  series.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 }, borderColor: '#3a3220' });
  series.createPriceLine({ price: 70, color: HI, lineVisible: false, axisLabelVisible: true, title: '' });
  series.createPriceLine({ price: 30, color: LO, lineVisible: false, axisLabelVisible: true, title: '' });
  const lastLine = series.createPriceLine({ price: 50, color: MID, lineVisible: false, axisLabelVisible: true, title: '' });
  const pane = chart.panes()[1];

  const canvas = document.createElement('canvas');
  canvas.className = 'gl-pane';
  wrap.insertBefore(canvas, document.getElementById('chart')); // pod biblioteką, jak świece
  const legend = document.createElement('div');
  legend.className = 'legend rsi-legend';
  wrap.appendChild(legend);

  let gl = null;
  function useLibrary() { series.applyOptions({ color: MID }); canvas.style.display = 'none'; }
  if (wasm) {
    try { gl = new RsiPane(canvas, PERIOD); gl.set_colors(HI, LO, MID); } catch (e) { gl = null; }
  }
  if (!gl) useLibrary();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (gl) { gl.free(); gl = null; } useLibrary(); });

  let values = [];
  let closesCache = [];
  let hover = null;
  let dirty = true;
  let key = '';
  let size = { w: 0, h: 0, top: -1, dpr: 0 };

  function calcAll(closes) {
    return wasm ? Array.from(rsiAll(closes, PERIOD)) : jsRsi(closes, PERIOD);
  }

  function showLegend() {
    const i = hover != null ? hover : values.length - 1;
    const v = values[i];
    const txt = Number.isFinite(v) ? '<span style="color:' + zone(v) + '">' + fmt.format(v) + '</span>' : '—';
    legend.innerHTML = '<span class="name">RSI</span><span class="tf">' + PERIOD + ' · Rust + WebGL2</span>' + txt;
  }

  function afterValues() {
    const v = values[values.length - 1];
    if (Number.isFinite(v)) lastLine.applyOptions({ price: v, color: zone(v) });
    dirty = true;
    if (hover == null) showLegend();
  }

  // pełne dane (nowa para / interwał / dociągnięta historia)
  function all(cs) {
    const closes = Float64Array.from(cs, (c) => c[4]);
    closesCache = Array.from(closes);
    if (gl) { gl.set_closes(closes); values = Array.from(gl.values()); }
    else values = calcAll(closes);
    series.setData(cs.map((c, i) => (Number.isFinite(values[i]) ? { time: toTime(c), value: values[i] } : { time: toTime(c) })));
    afterValues();
  }

  // świeca na żywo: jeden krok liczenia
  function last(cs) {
    const i = cs.length - 1;
    const c = cs[i];
    closesCache[i] = c[4];
    if (gl) {
      const v = gl.upsert_close(i, c[4]);
      if (i <= PERIOD) values = Array.from(gl.values()); else values[i] = v;
    } else {
      values = calcAll(Float64Array.from(closesCache));
    }
    const v = values[i];
    series.update(Number.isFinite(v) ? { time: toTime(c), value: v } : { time: toTime(c) });
    afterValues();
  }

  chart.subscribeCrosshairMove((p) => {
    const idx = p && p.point && p.logical != null ? Math.round(p.logical) : null;
    const h = idx != null && idx >= 0 && idx < values.length ? idx : null;
    if (h === hover) return;
    hover = h;
    showLegend();
  });

  function syncSize() {
    const el = pane.getHTMLElement();
    if (!el) return;
    const ps = chart.paneSize(1);
    const top = Math.round(el.getBoundingClientRect().top - wrap.getBoundingClientRect().top);
    const dpr = window.devicePixelRatio || 1;
    if (ps.width === size.w && ps.height === size.h && top === size.top && dpr === size.dpr) return;
    size = { w: ps.width, h: ps.height, top, dpr };
    canvas.style.top = top + 'px';
    canvas.style.width = ps.width + 'px';
    canvas.style.height = ps.height + 'px';
    legend.style.top = (top + 6) + 'px';
    if (gl) gl.resize(ps.width, ps.height, dpr);
    dirty = true;
  }

  // to samo mapowanie co świece: numer świecy -> X, wartość -> Y (z biblioteki, ta sama klatka)
  function render() {
    syncSize();
    if (!gl || size.h < 2) return;
    const ts = chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const a = Math.floor(r.from);
    const b = Math.ceil(r.to) + 1;
    const xa = ts.logicalToCoordinate(a);
    const xb = ts.logicalToCoordinate(b);
    const vTop = series.coordinateToPrice(0);
    const vBottom = series.coordinateToPrice(size.h);
    if (xa == null || xb == null || vTop == null || vBottom == null || vTop === vBottom) return;
    const step = (xb - xa) / (b - a);
    const x0 = xa - step * a;
    const va = size.h / (vBottom - vTop);
    const vb = -va * vTop;
    const k = r.from + '|' + r.to + '|' + x0 + '|' + step + '|' + va + '|' + vb;
    if (!dirty && k === key) return;
    key = k;
    dirty = false;
    gl.render(r.from, r.to, x0, step, va, vb);
  }

  series.attachPrimitive({ paneViews: () => [{ renderer: () => ({ draw: () => render() }) }] });
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => { dirty = true; });
  (function loop() { requestAnimationFrame(loop); render(); })();

  // panel RSI = 30% wysokości jako proporcja (nie piksele): działa też, gdy ramka startuje ukryta i mała
  chart.panes()[0].setStretchFactor(0.7);
  pane.setStretchFactor(0.3);

  return { all, last };
}
