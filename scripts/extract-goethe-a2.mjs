#!/usr/bin/env node
/**
 * Extract vocabulary from the Goethe-Zertifikat A2 Wortliste PDF (the official
 * "Prüfungsziele" publication — a different layout from the A1 Fit1 Wortliste,
 * so it gets its own parser rather than reusing extract-goethe.mjs).
 *
 * Layout: pages 8–31 hold the alphabetical wordlist as a 2-column-per-page
 * table, each column split into a lemma sub-column and an example sub-column.
 * Word-group pages (5–7) are not parsed here — see the flagged sidecar note
 * in the console summary if that coverage is wanted later.
 *
 * en is intentionally left empty — filled in Phase 1b (build-words.mjs).
 * Usage: node scripts/extract-goethe-a2.mjs
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { extractText } from './lib/pdf-text.mjs';
import { createFlagger } from './lib/flag.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const PDF_PATH = join(
  ROOT,
  'data/sources/a2/Goethe-Zertifikat_A2_Wortliste.pdf',
);
const OUT_PATH = join(ROOT, 'data/sources/a2/goethe-a2.json');

const ALPHA_FIRST = 8;
const ALPHA_LAST = 31;

const flag = createFlagger('goethe-a2', { level: 'a2' });

// ─── Row splitting ────────────────────────────────────────────────────────
//
// Each physical line renders 4 fields at roughly fixed columns:
//   lemma-left(25) example-left(45) lemma-right(97) example-right(121)
// pdftotext's proportional-font layout jitters those boundaries by a
// character or two, so a hard slice can land mid-word or mid-gap. We slice,
// then (a) extend a field forward if the boundary lands mid-word, and
// (b) re-split on any *internal* run of 2+ spaces left over from that
// extension — which recovers the true column break.

function sliceExtend(line, start, end) {
  let text = line.length > start ? line.slice(start, end) : '';
  let i = end;
  if (text && text[text.length - 1] !== ' ') {
    while (i < line.length && line[i] !== ' ') {
      text += line[i];
      i++;
    }
  }
  return [text, i];
}

function resplit(text) {
  const stripped = text.replace(/^ +/, '');
  const matches = [...stripped.matchAll(/ {2,}/g)];
  if (!matches.length) return [stripped.trim(), ''];
  const last = matches[matches.length - 1];
  return [
    stripped.slice(0, last.index).trim(),
    stripped.slice(last.index + last[0].length).trim(),
  ];
}

function norm(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function firstNonSpace(line, from) {
  let i = from;
  while (i < line.length && line[i] === ' ') i++;
  return i;
}

// A wrapped example that spills onto its own line can start close enough to
// the lemma column's boundary to get sliced in as if it were a lemma. Real
// lemma cells are always flush against the column start (col 25 / col 100);
// content that starts well past that start is example bleed, not a lemma.
const FLUSH_TOLERANCE = 3;

function parseRow(line) {
  let [t1, i] = sliceExtend(line, 25, 45);
  let [lemL, leftover] = resplit(t1);
  i = Math.max(i, 45);

  let [t2] = sliceExtend(line, i, 97);
  [, i] = sliceExtend(line, i, 97);
  t2 = leftover ? `${leftover} ${t2.replace(/^ +/, '')}` : t2;
  let [exL, leftover2] = resplit(t2);
  i = Math.max(i, 97);

  if (lemL && firstNonSpace(line, 25) - 25 > FLUSH_TOLERANCE) {
    exL = norm(`${lemL} ${exL}`);
    lemL = '';
  }

  const rightZoneStart = firstNonSpace(line, i);
  let [t3] = sliceExtend(line, i, 121);
  [, i] = sliceExtend(line, i, 121);
  t3 = leftover2 ? `${leftover2} ${t3.replace(/^ +/, '')}` : t3;
  let [lemR, leftover3] = resplit(t3);
  i = Math.max(i, 121);

  const t4 = line.length > i ? line.slice(i) : '';
  let exR = norm(leftover3 ? `${leftover3} ${t4.replace(/^ +/, '')}` : t4);

  if (lemR && rightZoneStart - 100 > FLUSH_TOLERANCE) {
    exR = norm(`${lemR} ${exR}`);
    lemR = '';
  }

  return [norm(lemL), norm(exL), norm(lemR), norm(exR)];
}

// ─── Boilerplate filtering ──────────────────────────────────────────────────

const RE_SKIP = new RegExp(
  [
    '^\\s*$', // blank
    '^\\s*[A-ZÄÖÜ]\\s*$', // single-letter section header (A, B, C, …)
    '^\\s*GOETHE-ZERTIFIKAT A2\\s*$',
    '^\\s*A2_Wortliste_03_200616\\s*$',
    '^\\s*(\\d+\\s+)?WORTLISTE(\\s+\\d+)?\\s*$',
    '^\\s*ALPHABETISCHER WORTSCHATZ\\s*$',
  ].join('|'),
);

// ─── Entry accumulation ─────────────────────────────────────────────────────
//
// A "row" only tells us column text; entries are built from a continuous
// per-stream accumulator (fed left-column-of-page then right-column-of-page,
// page by page, matching the alphabetical reading order). A lemma cell
// starts a new entry unless the entry-so-far is still "incomplete":
//   - ends with a trailing comma → more conjugation forms are coming
//   - is "<Artikel> <Stem>-" (a compound noun hyphen-wrapped across lines)

const HYPHEN_WRAP_RE = /^(der|die|das) [A-Za-zÄÖÜäöüß]+-$/;

function isIncomplete(joined) {
  return /,$/.test(joined) || HYPHEN_WRAP_RE.test(joined);
}

function appendExample(entry, text) {
  if (!text) return;
  const last = entry.examples[entry.examples.length - 1];
  if (last && /[.!?“"]$/.test(last)) {
    entry.examples.push(text);
  } else if (last) {
    entry.examples[entry.examples.length - 1] = `${last} ${text}`;
  } else {
    entry.examples.push(text);
  }
}

function applyGenericUmlaut(word) {
  const map = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };
  let lastIdx = -1;
  for (let i = 0; i < word.length; i++) {
    if (map[word[i]]) lastIdx = i;
  }
  if (lastIdx < 0) return word;
  return word.slice(0, lastIdx) + map[word[lastIdx]] + word.slice(lastIdx + 1);
}

function expandPlural(lemma, notation) {
  let n = notation.trim().replace(/[–—]/g, '-'); // normalise en/em dash to hyphen
  if (n.includes('/')) n = n.split('/')[0].trim(); // dual notation: use the first alternative
  if (n === '(Sg.)' || n === '(Pl.)' || n === '-') return null;
  if (/^-[a-zäöüß]+$/i.test(n)) return lemma + n.slice(1);
  // umlaut marker "¨" may appear before or after the hyphen: "¨-e" or "-¨e"
  if (/^-?¨-?[a-zäöüß]*$/i.test(n)) {
    const sfx = n.replace(/^-?¨-?/, '');
    return applyGenericUmlaut(lemma) + sfx;
  }
  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(n)) return n; // full irregular plural
  return undefined; // unrecognised
}

// Plural-notation cells sometimes have no gap before the example that
// follows on the same line ("Anmeldung,-en Wo bekomme ich…"). Split the
// notation at the first whitespace and treat the remainder as bled-in
// example text; a lone pairing "/" marker (as in "Chef, -s /") is dropped.
function splitNotationBleed(raw) {
  raw = raw.trim();
  const spIdx = raw.search(/\s/);
  let notation = spIdx >= 0 ? raw.slice(0, spIdx) : raw;
  let bleed = spIdx >= 0 ? raw.slice(spIdx + 1).trim() : '';
  notation = notation.replace(/\/$/, '');
  bleed = bleed.replace(/^\/\s*/, '').trim();
  return [notation, bleed];
}

function makeEntry(rawLemma, examples) {
  let raw = rawLemma.trim();

  // Hyphen-wrapped compound noun: "die Lebens- mittel (Pl.)" → "die Lebensmittel (Pl.)"
  const wrapM = raw.match(/^(der|die|das) ([A-Za-zÄÖÜäöüß]+)-\s+(.*)$/);
  if (wrapM) raw = `${wrapM[1]} ${wrapM[2]}${wrapM[3]}`;

  // Dual-article nouns: "der/das Blog, -s", "der/die Auszubildende, -n"
  const artM = raw.match(/^(der|die|das)((?:\/(?:der|die|das))+)?\s+(.*)$/);
  if (artM) {
    const article = artM[2] ? null : artM[1];
    let rest = artM[3].trim();
    let lemma, notation, bleed;
    const sgPl = rest.match(/^(.*?)\s*\((Sg|Pl)\.\)$/);
    if (sgPl) {
      lemma = sgPl[1].trim();
      notation = `(${sgPl[2]}.)`;
      bleed = '';
    } else {
      const ci = rest.indexOf(',');
      if (ci >= 0) {
        lemma = rest.slice(0, ci).trim();
        [notation, bleed] = splitNotationBleed(rest.slice(ci + 1));
      } else {
        lemma = rest;
        notation = null;
        bleed = '';
      }
    }
    if (bleed) {
      const [first, ...rest] = examples;
      examples =
        first && !/[.!?“"]$/.test(bleed)
          ? [`${bleed} ${first}`, ...rest]
          : [bleed, ...examples];
    }
    let plural = null;
    if (notation) {
      const expanded = expandPlural(lemma, notation);
      if (expanded === undefined) {
        flag({
          page: 0,
          rawLine: rawLemma,
          reason: `unrecognised plural notation "${notation}"`,
        });
      } else {
        plural = expanded;
      }
    }
    return {
      article,
      lemma,
      plural,
      en: '',
      examples,
      sources: ['goethe'],
      categories: [],
    };
  }

  // "Achtung (Sg.)" — Sg./Pl.-only noun with no article marker in the source
  const sgPlNoArt = raw.match(/^(.*?)\s*\((Sg|Pl)\.\)$/);
  if (sgPlNoArt) {
    return {
      article: null,
      lemma: sgPlNoArt[1].trim(),
      plural: null,
      en: '',
      examples,
      sources: ['goethe'],
      categories: [],
    };
  }

  // Verb: comma-separated conjugation forms — keep the infinitive (first segment)
  if (raw.includes(',')) {
    const lemma = raw.slice(0, raw.indexOf(',')).trim();
    if (/^\(|\//.test(lemma)) {
      flag({
        page: 0,
        rawLine: rawLemma,
        reason: `irregular verb-form lemma "${lemma}"`,
      });
    }
    return {
      article: null,
      lemma,
      plural: null,
      en: '',
      examples,
      sources: ['goethe'],
      categories: [],
    };
  }

  // Simple word (adjective/adverb/particle/stem)
  if (!raw || /[()]/.test(raw)) {
    flag({ page: 0, rawLine: rawLemma, reason: `unparsed lemma "${raw}"` });
  }
  return {
    article: null,
    lemma: raw,
    plural: null,
    en: '',
    examples,
    sources: ['goethe'],
    categories: [],
  };
}

// ─── Stream processing ──────────────────────────────────────────────────────

const entries = [];
let active = { lemmaParts: [], examples: [] };

function flushActive() {
  if (active.lemmaParts.length === 0) return;
  const raw = active.lemmaParts.join(' ');
  const word = makeEntry(raw, active.examples);
  if (word.lemma) entries.push(word);
  active = { lemmaParts: [], examples: [] };
}

// Section-header letters ("A", "B", …) and lone dash tokens can land in the
// lemma slot when they share a physical row with real content in the other
// column, or when a dash-led dialogue continuation starts a hair early. Ditch
// them from the lemma slot and fold any lone-dash text back into the example.
function sanitizeCell(lem, ex) {
  if (/^[A-ZÄÖÜ]$/.test(lem) && !ex) return ['', ex];
  if (/^[-–—]$/.test(lem)) return ['', ex ? `${lem} ${ex}` : lem];
  if (lem === 'ALPHABETISCHER WORTSCHATZ') return ['', ex];
  return [lem, ex];
}

function feed(lemCell, exCell) {
  [lemCell, exCell] = sanitizeCell(lemCell, exCell);
  if (lemCell) {
    const joinedSoFar = active.lemmaParts.join(' ');
    const wasIncomplete =
      active.lemmaParts.length > 0 && isIncomplete(joinedSoFar);
    if (!wasIncomplete) flushActive();
    active.lemmaParts.push(lemCell);
  }
  if (exCell) appendExample(active, exCell);
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('Extracting goethe-a2 …');

const text = extractText(PDF_PATH, { from: ALPHA_FIRST, to: ALPHA_LAST });
const pages = text.split('\f');

for (const page of pages) {
  const lines = page.split('\n').filter((l) => !RE_SKIP.test(l));
  const rows = lines.map(parseRow);
  // left column top-to-bottom, then right column top-to-bottom
  for (const [lemL, exL] of rows) feed(lemL, exL);
  for (const [, , lemR, exR] of rows) feed(lemR, exR);
}
flushActive();

// Deduplicate by lower-lemma
const seen = new Map();
for (const e of entries) {
  const key = e.lemma.toLowerCase();
  if (seen.has(key)) {
    const prev = seen.get(key);
    if (e.examples.length && !prev.examples.length) prev.examples = e.examples;
  } else {
    seen.set(key, e);
  }
}
const deduped = [...seen.values()];

const flagCount = flag.save();
writeFileSync(OUT_PATH, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${deduped.length} entries to ${OUT_PATH}`);
console.log(
  `  Flagged ${flagCount} rows → data/sources/a2/goethe-a2_flagged.json`,
);
