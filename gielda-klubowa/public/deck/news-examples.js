// Prawdziwe newsy z Privoty (zakładka News, 17–18.10.2026) i prawdziwe odpowiedzi ChatGPT
// dla nich: etap 1 (ocena wstępna, sam tekst) i — dla ważnych — etap 2 (pełna analiza ze zdjęciami).
// Slajd 6 ocenia te same teksty naszym silnikiem (news-engine.js) i pokazuje obie oceny obok siebie.
(function (root) {
  'use strict';
  root.NEWS_EXAMPLES = [
    {
      id: 'trump',
      source: 'trump', channel: 'Truth Social', time: Date.UTC(2026, 9, 17, 16, 31),
      title: 'Heading to Kentucky! Will be landing soon. Big Crowd. I’m watching it now on RSBN. The coverage is spectacular. In fact, it’s so good, that I don’t want to leave Air Force One. Vote for Andy Barr for U.S. Senate! President DONALD J. TRUMP',
      summary: '',
      gpt: {
        title_pl: 'Trump udaje się do Kentucky i zachęca do głosowania na Andy’ego Barra do Senatu USA',
        weight: 'niska', weight_score: 7, tone: 0, markets: { btc: 0, spx: 0, gold: 0, oil: 0 }, horizon: 'teraz', event: null,
        why: 'Bieżąca aktywność wyborcza — bez nowych decyzji, które mogłyby ruszyć wyceną.',
      },
      deep: null,
    },
    {
      id: 'stablecoin',
      source: 'coindesk', channel: 'RSS', time: Date.UTC(2026, 9, 18, 14, 0),
      title: 'Stablecoin supply stalls, but payments jump 45% as Visa, Mastercard and Stripe connect crypto to cash',
      summary: 'Analytics firm Allium said stablecoin payments hit $482 billion this year so far, up 45%, as card spending surges and global payment firms add crypto rails.',
      gpt: {
        title_pl: 'Płatności stablecoinami wzrosły o 45% mimo stagnacji podaży; Visa, Mastercard i Stripe rozwijają integracje',
        weight: 'średnia', weight_score: 48, tone: 20, markets: { btc: 1, spx: 0, gold: 0, oil: 0 }, horizon: 'teraz', event: null,
        why: 'Ważne dla adopcji krypto, ale stagnacja podaży i dane historyczne ograniczają natychmiastowy wpływ.',
      },
      deep: null,
    },
    {
      id: 'nato',
      source: 'investinglive', channel: 'RSS', time: Date.UTC(2026, 9, 18, 20, 22),
      title: 'Romanian F-16s shoot down two drones over Black Sea, NATO council to meet Tuesday',
      summary: 'A fresh airspace violation on NATO’s eastern flank adds a geopolitical risk premium. Back-to-back drone incidents near Romania’s coast raise the risk of higher war-risk insurance costs. Tuesday’s NATO council meeting is the next catalyst.',
      gpt: {
        title_pl: 'Rumuńskie F-16 zestrzeliły dwa drony nad Morzem Czarnym; NATO zbierze się we wtorek',
        weight: 'wysoka', weight_score: 73, tone: -50, markets: { btc: -1, spx: -1, gold: 1, oil: 1 }, horizon: 'teraz',
        event: { start: '2026-10-20', precision: 'dzień', title: 'Posiedzenie rady NATO w sprawie incydentów z dronami' },
        why: 'Zestrzelenie dronów przez państwo NATO to istotna eskalacja, choć jeszcze nie konfrontacja NATO z Rosją.',
      },
      deep: { hours: 24, priced_in: 30, btc: [40, 60], spx: [40, 60], gold: [55, 45], oil: [55, 45] },
    },
    {
      id: 'hormuz',
      source: 'aljazeera', channel: 'RSS', time: Date.UTC(2026, 9, 18, 0, 0),
      title: 'Iran war live: Tankers hit in Hormuz; Israeli settlers attack EU diplomats',
      summary: 'Fires reported on three tankers as masked settlers attack European politicians in the occupied West Bank.',
      gpt: {
        title_pl: 'Wojna z Iranem: trzy tankowce trafione w cieśninie Ormuz, atak na europejskich dyplomatów',
        weight: 'bardzo wysoka', weight_score: 91, tone: -85, markets: { btc: -2, spx: -2, gold: 2, oil: 2 }, horizon: 'teraz', event: null,
        why: 'Pożary tankowców w Ormuz to ryzyko poważnego zakłócenia dostaw ropy i szoku energetycznego.',
      },
      deep: { hours: 24, priced_in: 20, btc: [45, 55], spx: [45, 55], gold: [55, 45], oil: [60, 40] },
    },
  ];
})(this);
