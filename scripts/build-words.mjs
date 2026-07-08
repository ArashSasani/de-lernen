// scripts/build-words.mjs
// Phase 1b — Refine + merge (deterministic, re-runnable).
//
// Reads the three normalized source files produced by Phase 1a:
//   data/sources/telc-a1-1.json, telc-a1-2.json, goethe-a1.json
// and emits the immutable runtime dataset:
//   data/words.json      (array of Word, sorted by id)
//   data/changelog.json  (array of { lemma, from, to } corrections)
//
// No network, no LLM. All translations for Goethe-only entries are baked into
// GOETHE_EN below (all A1 vocabulary). Running this repeatedly is idempotent.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'sources');

const SOURCES = [
  { file: 'telc-a1-1.json', tag: 'telc-a1.1' },
  { file: 'telc-a1-2.json', tag: 'telc-a1.2' },
  { file: 'goethe-a1.json', tag: 'goethe' },
];

// --- slug / lemma normalization -------------------------------------------

function slug(lemma) {
  return lemma
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Apply a Goethe-style plural suffix notation to a noun stem.
function applyPluralNotation(stem, note) {
  const n = note.trim();
  if (/^-(e?n|s|e|er)$/.test(n)) return stem + n.slice(1);
  return null;
}

// A few Phase-1a Goethe rows leaked column notation into the lemma. Strip it
// here (1b is the refine step) and recover the plural where it was the leak.
function normalizeLemma(raw) {
  let lemma = raw.trim();
  let pluralFromNote = null;

  // "Herr; -en" → lemma "Herr", plural "Herren"
  const semi = lemma.match(/^(.*?)\s*;\s*(-\S+)\s*$/);
  if (semi) {
    lemma = semi[1].trim();
    pluralFromNote = applyPluralNotation(lemma, semi[2]);
  }

  // "Ende (Sg)" / "Ende (Sg.)" → lemma "Ende", singular-only (plural null)
  let singularOnly = false;
  const sg = lemma.match(/^(.*?)\s*\((Sg|Pl)\.?\)\s*$/i);
  if (sg) {
    lemma = sg[1].trim();
    singularOnly = true;
  }

  return { lemma, pluralFromNote, singularOnly };
}

// --- corrections ("only obvious", per CLAUDE.md) ---------------------------
// Keyed by normalized lemma. Verified against the source text layer.

const CORRECTIONS = {
  zahlen: 'to pay', // was "to count"
  Schnupfen: 'cold / runny nose', // was "to sniff" (it's der Schnupfen, a noun)
  kreativ: 'creative', // was "people" (row misaligned with die Leute)
  verzögern: 'to delay', // was "to hesitate"
  Position: 'position', // was "police station"; alphabetically Polizei/Position/Post — German is right, gloss wrong
};

// --- English for Goethe-only entries (no English in the Goethe source) -----
// Keyed by normalized lemma. Every Goethe-only entry must appear here.

const GOETHE_EN = {
  abfahren: 'to depart / leave',
  abgeben: 'to hand in / drop off',
  abholen: 'to pick up / collect',
  Ahnung: 'idea / clue',
  alle: 'all / everyone',
  allein: 'alone',
  Alter: 'age',
  'ander-': 'other',
  Anfang: 'beginning / start',
  Angst: 'fear',
  ankommen: 'to arrive',
  Anruf: 'phone call',
  Anrufbeantworter: 'answering machine',
  Appetit: 'appetite',
  arbeitslos: 'unemployed',
  Artikel: 'article',
  aufmachen: 'to open',
  aufpassen: 'to pay attention / watch out',
  aufräumen: 'to tidy up',
  'auf sein': 'to be open',
  Ausflug: 'excursion / outing',
  Ausland: 'abroad / foreign countries',
  aussehen: 'to look / appear',
  'aus sein': 'to be over / finished',
  aussteigen: 'to get off / out',
  Automat: 'vending machine',
  Baby: 'baby',
  Bahnsteig: 'platform',
  Band: 'band',
  Basketball: 'basketball',
  basteln: 'to do crafts / make things',
  bedeuten: 'to mean',
  besetzt: 'occupied / taken',
  besonders: 'especially / particularly',
  beste: 'best',
  CD: 'CD',
  Comic: 'comic',
  danken: 'to thank',
  dein: 'your',
  'der, die, das': 'the (definite article)',
  deshalb: 'therefore / that is why',
  dick: 'fat / thick',
  Disco: 'disco / club',
  dumm: 'stupid / dumb',
  Durst: 'thirst',
  duschen: 'to shower',
  ein: 'a / an / one',
  Eins: 'a one (top grade)',
  einsteigen: 'to get in / board',
  'einverstanden sein': 'to agree / be in agreement',
  Ende: 'end',
  entschuldigen: 'to excuse / apologise',
  euer: 'your (plural)',
  Fach: 'subject / compartment',
  Fahrplan: 'timetable / schedule',
  Fehler: 'mistake / error',
  Ferien: 'holidays / vacation',
  'fertig sein': 'to be finished / ready',
  fliegen: 'to fly',
  Flugzeug: 'aeroplane',
  Fluss: 'river',
  Fotoapparat: 'camera',
  Fuß: 'foot',
  geboren: 'born',
  genug: 'enough',
  Gepäck: 'luggage / baggage',
  Geschichte: 'story / history',
  'geschlossen sein': 'to be closed',
  gewinnen: 'to win',
  Glück: 'luck / happiness',
  Glückwunsch: 'congratulations',
  Großeltern: 'grandparents',
  Handy: 'mobile phone',
  Herr: 'gentleman / Mr',
  herzlich: 'warm / cordial',
  hoffen: 'to hope',
  hoffentlich: 'hopefully',
  hübsch: 'pretty',
  Internet: 'internet',
  jeder: 'every / each / everyone',
  Jugendliche: 'young people / teenagers',
  jung: 'young',
  Junge: 'boy',
  Kakao: 'cocoa / hot chocolate',
  Kamera: 'camera',
  Katze: 'cat',
  kein: 'no / not any',
  kennenlernen: 'to get to know / meet',
  Kiosk: 'kiosk / newsstand',
  Klassenarbeit: 'class test',
  Klavier: 'piano',
  lachen: 'to laugh',
  lange: 'for a long time',
  laufen: 'to run / walk',
  leicht: 'easy / light',
  leid: 'sorry (es tut mir leid)',
  lieb: 'dear / kind',
  lieber: 'rather / preferably',
  'Lieblings-': 'favourite',
  Lust: 'desire / inclination',
  Mädchen: 'girl',
  Mail: 'email',
  Mal: 'time (occurrence)',
  Marktplatz: 'market square',
  mein: 'my',
  Mineralwasser: 'mineral water',
  mitkommen: 'to come along',
  mitmachen: 'to join in / take part',
  mitnehmen: 'to take along',
  möglich: 'possible',
  Nachricht: 'message / news',
  nächste: 'next',
  niemand: 'nobody / no one',
  normal: 'normal',
  Note: 'grade / mark',
  Nummer: 'number',
  offen: 'open',
  Ohrring: 'earring',
  Paket: 'package / parcel',
  passieren: 'to happen',
  Pferd: 'horse',
  Poster: 'poster',
  Quatsch: 'nonsense',
  Quiz: 'quiz',
  Rad: 'bicycle / wheel',
  Rätsel: 'puzzle / riddle',
  'recht haben': 'to be right',
  Regen: 'rain',
  reiten: 'to ride (a horse)',
  Ring: 'ring',
  schon: 'already',
  schwer: 'difficult / heavy',
  schwimmen: 'to swim',
  See: 'lake',
  'spazieren gehen': 'to go for a walk',
  Spielplatz: 'playground',
  Süßigkeiten: 'sweets / candy',
  sympathisch: 'likeable / nice',
  Taschengeld: 'pocket money / allowance',
  'Tennis spielen': 'to play tennis',
  Theater: 'theatre',
  Thema: 'topic / theme',
  Tier: 'animal',
  traurig: 'sad',
  'U-Bahn': 'underground / subway',
  üben: 'to practise',
  'und so weiter': 'and so on (etc.)',
  unser: 'our',
  verrückt: 'crazy',
  viel: 'much / a lot',
  'vorstellen (sich)': 'to introduce (oneself)',
  wahr: 'true',
  Wald: 'forest / woods',
  wandern: 'to hike',
  wecken: 'to wake (someone) up',
  'weh tun': 'to hurt',
  weit: 'far',
  'welch-': 'which',
  wenig: 'little / few',
  wiederholen: 'to repeat',
  'wie viel': 'how much',
  wirklich: 'really',
  wunderbar: 'wonderful',
  Wurst: 'sausage',
  'zum Geburtstag': "for one's birthday",
  'zum Beispiel': 'for example',
  zumachen: 'to close / shut',
  'zu sein': 'to be closed',
};

// --- part-of-speech inference ----------------------------------------------

const ADJECTIVES = new Set([
  'arbeitslos',
  'besetzt',
  'beste',
  'dick',
  'dumm',
  'geboren',
  'geschlossen',
  'herzlich',
  'hübsch',
  'jung',
  'kreativ',
  'leicht',
  'lieb',
  'möglich',
  'nächste',
  'normal',
  'offen',
  'praktisch',
  'schwer',
  'sympathisch',
  'traurig',
  'verrückt',
  'wahr',
  'weit',
  'wunderbar',
]);

const ADVERBS = new Set([
  'besonders',
  'deshalb',
  'genug',
  'hoffentlich',
  'lange',
  'lieber',
  'schon',
  'wenig',
  'wirklich',
]);

function inferPos(lemma, article) {
  if (article) return 'noun';
  const lower = lemma.toLowerCase();
  if (ADJECTIVES.has(lower)) return 'adj';
  if (ADVERBS.has(lower)) return 'adv';
  // verb: a (multi-word) lemma whose last token is an infinitive
  const last = lemma.split(/\s+/).pop();
  if (last.length > 3 && /(en|ln|rn)$/.test(last)) return 'verb';
  if (['sein', 'tun', 'haben', 'gehen'].includes(last)) return 'verb';
  return 'other';
}

// --- merge helpers ----------------------------------------------------------

function uniq(arr) {
  return [...new Set(arr)];
}

const SOURCE_ORDER = ['telc-a1.1', 'telc-a1.2', 'goethe'];
function orderSources(arr) {
  return SOURCE_ORDER.filter((s) => arr.includes(s));
}

// --- build ------------------------------------------------------------------

function build() {
  // Flatten all source entries, normalizing lemma and remembering origin tag.
  const rows = [];
  for (const { file, tag } of SOURCES) {
    const data = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
    for (const e of data) {
      const { lemma, pluralFromNote, singularOnly } = normalizeLemma(e.lemma);
      rows.push({
        tag,
        lemma,
        article: e.article ?? null,
        plural: singularOnly ? null : (e.plural ?? pluralFromNote ?? null),
        en: (e.en ?? '').trim(),
        examples: Array.isArray(e.examples) ? e.examples : [],
        categories: Array.isArray(e.categories) ? e.categories : [],
      });
    }
  }

  // Group by slug.
  const groups = new Map();
  for (const r of rows) {
    const id = slug(r.lemma);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }

  const changelog = [];
  const words = [];

  for (const [id, group] of groups) {
    // Canonical lemma: prefer Telc casing, in source order.
    const byOrder = [...group].sort(
      (a, b) => SOURCE_ORDER.indexOf(a.tag) - SOURCE_ORDER.indexOf(b.tag),
    );
    const lemma = byOrder[0].lemma;

    // Article: Goethe's r/e/s marker wins ties; else first non-null (Telc order).
    const goethe = group.find((r) => r.tag === 'goethe');
    let article =
      goethe && goethe.article
        ? goethe.article
        : (byOrder.find((r) => r.article)?.article ?? null);

    // Plural: prefer an explicit Telc full form, then Goethe.
    const plural = byOrder.find((r) => r.plural)?.plural ?? null;

    // English: first non-empty in Telc order, else baked Goethe translation.
    let en = byOrder.find((r) => r.en)?.en ?? '';
    if (!en && GOETHE_EN[lemma] !== undefined) en = GOETHE_EN[lemma];

    // Apply "only obvious" corrections.
    let corrected = false;
    if (CORRECTIONS[lemma] !== undefined && en !== CORRECTIONS[lemma]) {
      changelog.push({ lemma, from: en, to: CORRECTIONS[lemma] });
      en = CORRECTIONS[lemma];
      corrected = true;
    }

    if (!en) {
      throw new Error(
        `No English for "${lemma}" (id=${id}). Add it to GOETHE_EN.`,
      );
    }

    const sources = orderSources(uniq(group.map((r) => r.tag)));
    const examples = uniq(
      byOrder
        .flatMap((r) => r.examples)
        .map((s) => s.trim())
        .filter(Boolean),
    );

    const word = {
      id,
      lemma,
      article,
      plural,
      en,
      pos: inferPos(lemma, article),
      examples,
      sources,
    };
    if (corrected) word.corrected = true;
    words.push(word);
  }

  words.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  changelog.sort((a, b) =>
    a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0,
  );

  writeFileSync(
    join(ROOT, 'data', 'words.json'),
    JSON.stringify(words, null, 2) + '\n',
  );
  writeFileSync(
    join(ROOT, 'data', 'changelog.json'),
    JSON.stringify(changelog, null, 2) + '\n',
  );

  // Sanity summary.
  const dupes = words.length !== new Set(words.map((w) => w.id)).size;
  console.log(
    `words: ${words.length}  changelog: ${changelog.length}  dupe ids: ${dupes}`,
  );
  const posCounts = {};
  for (const w of words) posCounts[w.pos] = (posCounts[w.pos] || 0) + 1;
  console.log('pos:', posCounts);
}

build();
