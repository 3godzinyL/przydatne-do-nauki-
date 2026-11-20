# Klub · AI w programowaniu

Lekcje z klubu: jak dobrze zacząć z AI i zbudować z nią **działający produkt —
własną platformę krypto**. Każda lekcja to prezentacja w HTML (czerń + złoto,
działa bez internetu poza danymi z giełdy), a od lekcji 2 także kod platformy,
który powstał na zajęciach.

> Prowadzący mówi, slajdy pokazują. Argumenty i szczegóły są w notatkach
> prowadzącego — klawisz `N` w każdej prezentacji.

## Indeks

| | Co | Plik | Jak otworzyć |
|---|---|---|---|
| 0 | **Zapowiedź** — zaproszenie na zajęcia | [`00-zapowiedz/zapowiedz.html`](00-zapowiedz/zapowiedz.html) · film [`zapowiedz.mp4`](00-zapowiedz/zapowiedz.mp4) | dwuklik |
| 1 | **Lekcja 1** — Jak dobrze zacząć z AI, aby stworzyć funkcjonujący produkt | [`lekcja-1/prezentacja-1.html`](lekcja-1/prezentacja-1.html) | dwuklik |
| 2 | **Lekcja 2** — Giełda Klubowa: platforma zbudowana na zajęciach | [`lekcja-2/gielda-klubowa/public/prezentacja-2.html`](lekcja-2/gielda-klubowa/public/prezentacja-2.html) | `START.cmd` (serwer Node) |
| 2a | Lekcja 2 — najważniejsze decyzje na start (wersja teoretyczna) | [`lekcja-2/decyzje-na-start/prezentacja-2-decyzje.html`](lekcja-2/decyzje-na-start/prezentacja-2-decyzje.html) | dwuklik |

## Sterowanie

| klawisz | co robi |
|---|---|
| `→` `←` / spacja / pilot | następny / poprzedni slajd |
| `↑` `↓` | w prezentacji 2 — widok w dół / w górę (slajdy mają drugą i trzecią stronę) |
| `F` | pełny ekran |
| `N` | notatki prowadzącego |
| `P` | widok prowadzącego w osobnym oknie (lekcje 1 i 2; przełącza slajdy razem z główną prezentacją) |

Slajdy mają stałą scenę 1920×1080, skalowaną do okna — wyglądają tak samo na laptopie i na rzutniku.

---

## 0 · Zapowiedź

Jeden plik HTML bez żadnych zależności, 4 slajdy:

1. Wykres BTC 1h rysujący się od lewej do prawej (Binance, na żywo przez WebSocket; bez internetu — dane przykładowe) z pivotami dziennymi i zapalającymi się funkcjami platformy.
2. Technologie: giełdy → Node.js → TypeScript + Rust → WebAssembly.
3. AI pisze kod: ChatGPT → Claude → Codex.
4. Zaproszenie z kartką kalendarza.

Datę, godzinę i miejsce spotkania zmienia się w obiekcie `SPOTKANIE` na górze skryptu w `zapowiedz.html`.

Platforma klubu nie przyjmuje plików HTML, dlatego obok jest **film** `zapowiedz.mp4` (1080p, ok. 38 s)
i **zdjęcia** slajdów w `zdjecia/`. Po zmianie zapowiedzi film robi się od nowa:

```
node 00-zapowiedz/render-video.cjs
```

(potrzebne: Node 22+, Chrome albo Edge, `ffmpeg` w PATH, internet do pobrania świec).

## 1 · Lekcja 1 — Jak dobrze zacząć z AI

`lekcja-1/prezentacja-1.html` — 18 slajdów. **Cel:** zbudować automatyczną platformę krypto;
droga do celu: czego używać i jak używać.

- **Czego używać:** Codex i Claude (po 20 $), Azure od Microsoftu (AI po API, płacisz za tokeny),
  VS Code z AI w panelu obok, mapa „co chcesz zrobić → czego użyć”.
- **Języki:** Node.js (jeden język prawie do wszystkiego), Rust i TypeScript (gdy nie może lagować),
  C# WinForms, dlaczego nie Python (projekt wysłany koledze).
- **Jak używać:** skille dla AI, pierwszy projekt w 5 krokach, zasady pracy.
- **Platforma:** backend i frontend, BTC na żywo prosto z giełdy (Binance REST + WebSocket), plan kolejnych lekcji.

Wykresy na slajdach liczy `live.js`, przełączanie slajdów — `deck.js`, ikony produktów są w `img/`.

## 2 · Lekcja 2 — Giełda Klubowa

`lekcja-2/gielda-klubowa/` to **projekt platformy** zbudowany na zajęciach:
serwer Node.js bez frameworka, świece z Binance zapisywane w JSON, wykres na
[Lightweight Charts](https://github.com/tradingview/lightweight-charts), a świece i wolumen rysuje
**Rust → WebAssembly → WebGL2**.

Prezentacja lekcji 2 działa z tego samego serwera, bo na slajdach jest prawdziwa platforma na żywo:

```
cd lekcja-2/gielda-klubowa
npm install
npm start
```

albo dwuklik `START.cmd`. Otwórz `http://127.0.0.1:3400/` — to prezentacja `public/prezentacja-2.html`
(7 slajdów):

1. Powitanie i prompt, od którego wszystko się zaczęło.
2. Platforma na żywo → w dół: pierwszy prompt ze słowami klucz, koszt pierwszego zadania i film „Jak to działa”.
3. Wskaźnik RSI liczony w Rust → w dół: prompt na RSI i film o wskaźniku.
4. Nowy czat = mniej tokenów (prawdziwe dane z sesji Claude Code).
5. Dlaczego serwer w Node.js + film.
6. AI sama sprawdza newsy → schemat → silnik ocen na żywo na prawdziwych newsach.
7. To wszystko na dziś + nad czym pracuję (AI sama rysuje SMC) → lista projektów klubu.

Inne adresy: `/app` — sama platforma, `/app?ind=rsi` — z RSI, `/film/`, `/film-rsi/`, `/film-node/`, `/film-news/` — filmy z lektorem.
Szczegóły (API, format JSON, Rust, lektor): [`lekcja-2/gielda-klubowa/README.md`](lekcja-2/gielda-klubowa/README.md).

`lekcja-2/decyzje-na-start/` — pierwsza, teoretyczna wersja lekcji 2 (12 slajdów, otwiera się dwuklikiem):
serwer na Node.js, trzy giełdy, własny wykres w Rust zamiast gotowej biblioteki, łączenie świec przy oddalaniu,
krótszy zakres na 1m, liczy komputer użytkownika, podział plików, Tester i Deep Test, entry z dobrego miejsca,
dwie AI sprawdzające się nawzajem.

---

## Struktura

```
00-zapowiedz/            zapowiedź: zapowiedz.html, zapowiedz.mp4, zdjecia/, render-video.cjs
lekcja-1/                prezentacja-1.html, style.css, deck.js, live.js, img/
lekcja-2/
  gielda-klubowa/        projekt platformy (Node + Rust/WASM) z prezentacją 2
    server.js            serwer: / = prezentacja, /app = platforma, /api = świece
    src/                 Binance, magazyn świec JSON, lista projektów
    public/              prezentacja-2.html, platforma, deck/, filmy, pkg/ (gotowy WASM)
    rust/chart-gl/       źródło Rusta (świece, wolumen, RSI w WebGL2)
    tools/               generowanie lektora do filmów
  decyzje-na-start/      prezentacja-2-decyzje.html (12 slajdów)
```

## Czego nie ma w repo (i skąd to wziąć)

| folder | skąd |
|---|---|
| `node_modules/` | `npm install` w `lekcja-2/gielda-klubowa` (robi to też `START.cmd`) |
| `rust/chart-gl/target/` | powstaje przy kompilacji Rusta; gotowy WASM jest już w `public/pkg/`, więc do uruchomienia Rust nie jest potrzebny. Po zmianie kodu w Rust: `BUILD_RUST.cmd` (potrzebny `wasm-pack`) |
| `data/` | tworzy się sam przy pierwszym uruchomieniu (świece pobierane z Binance) |

## Wymagania

- przeglądarka Chrome / Edge (zapowiedź, lekcja 1, decyzje na start — wystarczy otworzyć plik),
- [Node.js](https://nodejs.org) 18+ do lekcji 2 (22+ do renderowania filmu zapowiedzi),
- internet tylko po świece z giełdy — bez niego slajdy pokazują dane przykładowe.
