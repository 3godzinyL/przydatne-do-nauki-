# Giełda Klubowa

Własna platforma wykresów typu TradingView, zrobiona na lekcji 2.
Prezentacja i platforma działają z jednego serwera.

## Start

Potrzebny [Node.js](https://nodejs.org) 18+. Kliknij `START.cmd` (za pierwszym razem sam zrobi `npm install`)
albo w terminalu: `npm install`, potem `npm start`. Otworzy się `http://127.0.0.1:3400/`:

- `/` — prezentacja `public/prezentacja-2.html` (7 slajdów: powitanie i prompt, platforma na żywo, RSI, nowy czat = mniej tokenów, dlaczego Node, newsy z AI, koniec i nad czym pracuję),
- `/app` — sama platforma (`/app?ind=rsi` — z panelem RSI),
- `/film/` — film „Jak to działa” z lektorem (ok. 1:42),
- `/film-rsi/` — film „Jak działa wskaźnik RSI” (ok. 1:18),
- `/film-node/` — film „Dlaczego serwer w Node.js” (ok. 1:21),
- `/film-news/` — film „Jak AI sprawdza newsy” (ok. 3:03, 8 scen: m.in. jak serwer wykrywa nowy news, po co AI zdjęcia rynku i na koniec ciekawostka „ChatGPT bez API” — okno Chrome sterowane z Node).

Prezentacja: strzałki / spacja / pilot, `F` pełny ekran, `N` notatki, `P` widok prowadzącego.
Nawigacja: ← → slajdy, ↑ ↓ widok w dół/w górę, spacja/pilot po kolei; to samo robią przyciski na slajdach.
Slajd 2: w dół = pierwszy prompt (słowa klucz na złoto) z kosztem pierwszego zadania i film (startuje sam, pauza po wyjściu), w prawo = slajd 3 z RSI.
Slajd 3: wykres z RSI, w dół = prompt na RSI ze słowami klucz i film o wskaźniku.
Slajd 4: kontekst na zapytanie — stary czat, nowy czat i symulacja „gdybym został w starym” (dane z plików sesji Claude Code w `public/deck/tokens.js`).
Slajd 5: Node vs Rust vs Python na serwerze + film `/film-node/` (startuje sam).
Slajd 6: zapowiedź newsów → w dół schemat 1:1 z Privoty + film `/film-news/` → w dół „silnik na żywo”: 4 prawdziwe newsy z Privoty
oceniane naszym silnikiem (`public/deck/news-engine.js`, działa też w Node) obok prawdziwej odpowiedzi ChatGPT, plus pole na własny tekst.
Slajd 7 (w dół = lista projektów klubu: Enter dodaje, numeracja 1, 2, 3 sama, podwójny klik = poprawka, zapis do data/projekty-klubu.json przez /api/projects + kopia w przeglądarce): koniec na dziś + nad czym pracuję — AI z własnym widokiem rynku sama rysuje SMC (`public/deck/smc.js`, świece przykładowe).
Gdy kursor jest w wykresie albo w filmie, strzałki i pilot dalej przełączają slajdy.

Po zmianie kodu w Rust: `BUILD_RUST.cmd` (potrzebny `wasm-pack`).

## Jak to działa

```
Binance REST ──> Node.js (server.js) ──> data/BTCUSDT/1h.json
                       │                       (jeden plik na parę i interwał)
                       ▼
przeglądarka: Lightweight Charts (osie, zoom, przesuwanie, skale)
            + Rust -> WASM -> WebGL2 (rysuje świece i wolumen)
            + WebSocket Binance (świeca na żywo)
```

- **Node.js** (`server.js`, `src/`) — bez frameworka. Pobiera świece z Binance,
  trzyma je w pamięci i zapisuje do JSON (zapis przez `.tmp` + rename, kolejka na plik).
  Najpierw zwraca najnowsze świece, starsze dociąga dopiero przy przewinięciu w lewo.
  Po przerwie dociąga brakujące świece od ostatniej zapisanej.
- **Plik JSON**: `{"symbol","interval","complete","savedAt","candles":[[czas_ms,o,h,l,c,wolumen],…]}`.
  Krótkie tablice zamiast obiektów, więc 1000 świec waży ok. 60 KB.
- **Wykres** — gotowa biblioteka [Lightweight Charts](https://github.com/tradingview/lightweight-charts)
  (Apache 2.0; logo TradingView na wykresie wyłączone `attributionLogo: false`, wymagane oznaczenie z linkiem jest w pasku stanu) robi skale, przesuwanie, zoom
  i krzyżyk. Jej świece są przezroczyste.
- **Rust** (`rust/chart-gl`) — świece i wolumen w buforze GPU, jedna świeca = jedna instancja,
  rysowane tylko widoczne. Mapowanie (indeks → X, cena → Y) bierze z biblioteki w tej samej
  klatce, więc świece trzymają się osi przy przeciąganiu. Rysuje zawsze Rust; biblioteka
  przejmuje świece sama tylko wtedy, gdy WebGL2 nie ruszy albo karta zgubi kontekst (i oddaje je, gdy wróci).

## API

| adres | co zwraca |
|---|---|
| `/api/candles?symbol=BTCUSDT&interval=1h&limit=1500` | najnowsze świece |
| `/api/candles?…&before=<czas_ms>` | starsze przed danym czasem (dociąga z Binance) |
| `/api/candles?…&since=<czas_ms>` | świece od danego czasu (dociąganie luk) |
| `/api/files` | lista plików JSON w `data/` |

Interwały: 1m 3m 5m 15m 30m 1h 2h 4h 6h 12h 1d 1w (bez `1M` — na Windows `1M.json` = `1m.json`).
Port i katalog danych: zmienne `PORT` (domyślnie 3400) i `DATA_DIR`.

## Wskaźniki (RSI)

`rust/chart-gl/src/rsi.rs` liczy RSI(14) metodą Wildera przyrostowo (nowa świeca = jeden krok) i rysuje
osobny panel WebGL2: linia fioletowa, ponad 70 czerwona, pod 30 zielona — kolor wybiera shader dla każdego piksela.
`public/js/rsi.js` podpina panel pod bibliotekę (oś 0–100, krzyżyk, wspólny czas). Serwer nic nie liczy.

## Film i lektor

`public/film/index.html` + `player.js` + `film.css` — animacja HTML/CSS (8 scen), napisy i rozdziały;
`public/film-rsi/` używa tego samego odtwarzacza (6 scen). Dźwięk to jedna ścieżka
`audio/film.mp3` z osią `audio/timeline.json`, więc film nie zatrzymuje się między scenami. Serwer obsługuje `Range`, bez tego Chrome nie przewija dźwięku.
Tekst lektora i napisy: `public/film/script.json` (`say` = pisownia dla lektora, `cap` = napis). Po zmianie tekstu:

```
node tools/make-voice.cjs                              (Zofia)
node tools/make-voice.cjs --voice pl-PL-MarekNeural    (głos męski)
node tools/make-voice.cjs --film film-rsi              (film o RSI)
node tools/make-voice.cjs --film film-node             (film: dlaczego Node)
node tools/make-voice.cjs --film film-news             (film: jak AI sprawdza newsy)
```

Głos: neuronowy polski głos Microsoft z „Czytaj na głos” w Edge (darmowy, internet tylko przy generowaniu;
to nieoficjalne użycie tej usługi poza Edge, więc może kiedyś przestać działać — gotowe MP3 zostają).
Skrypt sam poprawia różnicę zegara komputera (usługa odrzuca token przy złym czasie). `ffmpeg` skleja sceny.
