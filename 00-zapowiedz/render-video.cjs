#!/usr/bin/env node
'use strict';
// Renderuje zapowiedz.html do filmu MP4 (1920x1080, 30 kl./s, H.264) — dla platform, które nie wczytują HTML.
// Uruchomienie:  node render-video.cjs            (wynik: zapowiedz.mp4 + zdjecia\zapowiedz-slajd-N.png)
//                node render-video.cjs --max 6    (test: tylko pierwsze 6 s)
// Wymaga: Node 22+, Chrome lub Edge, ffmpeg w PATH, internet (świece BTC z Binance pobierane raz przed startem).
//
// Jak to działa: strona działa na sztucznym zegarze (setTimeout, rAF, performance.now) i animacjach CSS
// ustawianych przez Web Animations API, więc każda klatka jest policzona dokładnie, bez szarpania.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const HTML = path.join(HERE, 'zapowiedz.html');
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };

const FPS = +opt('fps', 30);
const OUT = path.resolve(HERE, opt('out', 'zapowiedz.mp4'));
const MAX_SEC = opt('max', null) === null ? Infinity : +opt('max', 0);
const STILLS = path.join(HERE, 'zdjecia');
const HOLD = [8.5, 10, 12.5, 7.5];   // ile sekund trwa każdy z 4 slajdów (animacja + czas na przeczytanie)
const FADE_OUT = 0.8;                // wygaszenie na końcu
const PORT = 9347;
const W = 1920, H = 1080;

function findBrowser() {
  const c = [
    process.env.CHROME,
    process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env['ProgramFiles'] + '\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  const hit = c.find(p => fs.existsSync(p));
  if (!hit) throw new Error('Nie znaleziono Chrome ani Edge (ustaw zmienną CHROME).');
  return hit;
}

async function pobierzSwiece() {
  for (const host of ['https://api.binance.com', 'https://data-api.binance.vision']) {
    try {
      const r = await fetch(host + '/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=120', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length >= 30) return rows;
    } catch (e) { /* następny host */ }
  }
  throw new Error('Nie udało się pobrać świec z Binance — film bez prawdziwych danych miałby podpis „podgląd bez internetu”.');
}

// Skrypt wstrzykiwany PRZED skryptami strony: sztuczny zegar + dane zamiast sieci.
function clockScript(rows) {
  return '(' + function (KL) {
    var now = 0, seq = 0, rid = 0, timers = new Map(), rafQ = [], rec = new WeakMap();

    // powtarzalne „losowe” pisanie w terminalu
    var s = 12345;
    Math.random = function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    performance.now = function () { return now; };
    window.setTimeout = function (fn, ms) {
      var id = ++seq;
      timers.set(id, { id: id, due: now + Math.max(0, +ms || 0), fn: fn, args: [].slice.call(arguments, 2), every: 0 });
      return id;
    };
    window.setInterval = function (fn, ms) {
      var id = ++seq, e = Math.max(1, +ms || 0);
      timers.set(id, { id: id, due: now + e, fn: fn, args: [].slice.call(arguments, 2), every: e });
      return id;
    };
    window.clearTimeout = window.clearInterval = function (id) { timers.delete(id); };
    window.requestAnimationFrame = function (fn) { var id = ++rid; rafQ.push({ id: id, fn: fn }); return id; };
    window.cancelAnimationFrame = function (id) { rafQ = rafQ.filter(function (r) { return r.id !== id; }); };

    // animacje i przejścia CSS: pauza + ręczne ustawianie czasu od chwili powstania
    function syncAnims() {
      var list = document.getAnimations();
      for (var i = 0; i < list.length; i++) {
        var a = list[i], r = rec.get(a);
        if (!r) { r = { t0: now }; rec.set(a, r); a.pause(); }
        a.currentTime = now - r.t0;
      }
    }

    function runTimers(target) {
      for (;;) {
        var next = null;
        timers.forEach(function (t) {
          if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) next = t;
        });
        if (!next) break;
        if (next.due > now) now = next.due;
        if (next.every) next.due += next.every; else timers.delete(next.id);
        try { next.fn.apply(window, next.args); } catch (e) { console.error(e); }
        syncAnims();
      }
    }

    window.__fake = {
      advanceTo: function (target) {
        runTimers(target);
        now = target;
        var q = rafQ; rafQ = [];
        q.forEach(function (r) { try { r.fn(now); } catch (e) { console.error(e); } });
        syncAnims();
        return now;
      },
      sync: syncAnims
    };

    // dane: świece z Binance pobrane wcześniej, bez WebSocketu (film nie jest „na żywo”)
    window.fetch = function (url) {
      if (String(url).indexOf('/api/v3/klines') >= 0) {
        return Promise.resolve(new Response(JSON.stringify(KL), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return Promise.reject(new Error('offline (render)'));
    };
    window.WebSocket = function () { this.close = function () {}; };
  }.toString() + ')(' + JSON.stringify(rows) + ');';
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      } else if (m.method && this.onEvent) this.onEvent(m);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = findBrowser();
  console.log('Przeglądarka:', browser);
  console.log('Pobieram świece BTC z Binance…');
  const rows = await pobierzSwiece();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zapowiedz-render-'));
  const chrome = spawn(browser, [
    '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=' + W + ',' + H, '--hide-scrollbars', '--force-device-scale-factor=1',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' });

  let ff = null;
  const cleanup = () => {
    try { spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* już zamknięty */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* profil może być jeszcze zajęty */ }
  };
  process.on('exit', cleanup);

  try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(250);
      try { target = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find(t => t.type === 'page'); } catch (e) { /* jeszcze się uruchamia */ }
    }
    if (!target) throw new Error('Przeglądarka nie odpowiada na porcie ' + PORT);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new CDP(ws);
    const ev = async expr => {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('Błąd w stronie: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      return r.result.value;
    };

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: clockScript(rows) });
    const loaded = new Promise(res => { cdp.onEvent = m => { if (m.method === 'Page.loadEventFired') res(); }; });
    await cdp.send('Page.navigate', { url: pathToFileURL(HTML).href });
    await loaded;
    // odliczanie „za N dni” zestarzałoby się w filmie — chowamy je
    await ev("document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'.cal-left{display:none!important}'})),1");
    await sleep(600); // dane z (podstawionego) fetch dochodzą w prawdziwym czasie, zanim ruszy zegar

    const nTotal = Math.min(Math.round(HOLD.reduce((a, b) => a + b, 0) * FPS), Math.round(MAX_SEC * FPS));
    const durSec = nTotal / FPS;
    const bounds = []; HOLD.reduce((acc, h) => { acc += h; bounds.push(Math.round(acc * FPS)); return acc; }, 0); // klatka, od której startuje kolejny slajd
    fs.mkdirSync(STILLS, { recursive: true });

    const fadeStart = Math.max(0, durSec - FADE_OUT);
    ff = spawn(process.env.FFMPEG || 'ffmpeg', [
      '-y', '-loglevel', 'error', '-nostats',
      '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'png', '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', 'fade=t=out:st=' + fadeStart.toFixed(2) + ':d=' + FADE_OUT + ',scale=out_range=tv:out_color_matrix=bt709,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-x264-params', 'aq-mode=3',
      '-r', String(FPS), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', OUT
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    const ffDone = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg zakończył się kodem ' + code + '\n' + ffErr)));
    });
    ff.stdin.on('error', () => { /* błąd zgłosi 'close' */ });
    const write = buf => new Promise(res => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });

    console.log('Renderuję ' + nTotal + ' klatek (' + durSec.toFixed(1) + ' s)…');
    const t0 = Date.now();
    let slide = 0;
    for (let f = 0; f < nTotal; f++) {
      const ms = f * 1000 / FPS;
      await ev('__fake.advanceTo(' + ms + ')');
      if (slide < bounds.length - 1 && f === bounds[slide]) {
        slide++;
        await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'})),__fake.sync(),1");
      }
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const buf = Buffer.from(shot.data, 'base64');
      // zdjęcie slajdu = ostatnia klatka przed przejściem (wszystko już narysowane)
      const lastOfSlide = bounds.findIndex(b => f === b - 1);
      if (lastOfSlide >= 0 || f === nTotal - 1) {
        const k = lastOfSlide >= 0 ? lastOfSlide : slide;
        fs.writeFileSync(path.join(STILLS, 'zapowiedz-slajd-' + (k + 1) + '.png'), buf);
      }
      await write(buf);
      if (f % 60 === 59 || f === nTotal - 1) {
        const el = (Date.now() - t0) / 1000;
        console.log('  ' + (f + 1) + '/' + nTotal + '  (' + el.toFixed(0) + ' s, jeszcze ok. ' + (el / (f + 1) * (nTotal - f - 1)).toFixed(0) + ' s)');
      }
    }
    ff.stdin.end();
    await ffDone;
    console.log('Gotowe: ' + OUT + ' (' + (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB)');
  } finally {
    cleanup();
  }
}

main().catch(e => { console.error('BŁĄD:', e.message); process.exitCode = 1; });
