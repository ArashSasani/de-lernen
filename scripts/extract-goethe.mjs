#!/usr/bin/env node
/**
 * Extract vocabulary from the Goethe-Zertifikat A1 Fit-in-Deutsch-1 Wortliste PDF.
 * Produces data/sources/<level>/goethe-<level>.json.
 * en is intentionally left empty — filled in Phase 1b (build-words.mjs).
 * Usage: node scripts/extract-goethe.mjs [--level a1]
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { extractText } from './lib/pdf-text.mjs';
import { createFlagger } from './lib/flag.mjs';

const ROOT = new URL('../', import.meta.url).pathname;

const args = process.argv.slice(2);
const level = args.includes('--level')
  ? args[args.indexOf('--level') + 1]
  : 'a1';
if (!['a1', 'a2', 'b1'].includes(level)) {
  console.error('--level must be a1, a2, or b1');
  process.exit(1);
}
const outName = `goethe-${level}`;

const PDF_PATH = join(
  ROOT,
  `data/sources/${level}/Goethe-Zertifikat_A1_Fit1_Wortliste.pdf`,
);
const OUT_PATH = join(ROOT, `data/sources/${level}/${outName}.json`);

const ALPHA_FIRST = 9;
const ALPHA_LAST = 21;
const WG_FIRST = 6;
const WG_LAST = 8;

const flag = createFlagger(outName, { level });

// ─── Plural expansion ────────────────────────────────────────────────────────

function applyUmlaut(word, umChar) {
  // umChar may be the umlaut form (ä/ü/ö) or the base form (a/u/o).
  // Normalise to the base vowel so we know what to search for.
  const TO_BASE = { ä: 'a', ü: 'u', ö: 'o', Ä: 'A', Ü: 'U', Ö: 'O' };
  const TO_UMLAUT = { a: 'ä', u: 'ü', o: 'ö', A: 'Ä', U: 'Ü', O: 'Ö' };
  const base = TO_BASE[umChar] ?? umChar; // 'a', 'u', or 'o' (or already base)
  const lower = base.toLowerCase();
  const upper = lower.toUpperCase();
  // Replace the LAST occurrence of the base vowel (e.g. "Anfang" → inner 'a')
  let lastIdx = -1;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === lower || word[i] === upper) lastIdx = i;
  }
  if (lastIdx < 0) return word;
  const rep = TO_UMLAUT[word[lastIdx]] ?? word[lastIdx];
  return word.slice(0, lastIdx) + rep + word.slice(lastIdx + 1);
}

function expandPlural(lemma, notation) {
  if (!notation) return null;
  const raw = notation.trim();
  // Handle (Sg.) and (Pl.) BEFORE stripping parens
  if (raw === '(Sg.)') return null;
  if (raw === '(Pl.)') return lemma;
  if (raw === '-') return lemma;
  // Strip alternative forms in parens: "-s (-thek, -en)" → "-s"
  let n = raw.replace(/\s*\([^)]+\)\s*$/, '').trim();
  if (!n || n === '-') return n === '-' ? lemma : null;
  // Simple suffix: -n  -en  -s  -e  -nen  or bare letters (variant without dash)
  if (/^-[a-zäöüß]+$/i.test(n)) return lemma + n.slice(1);
  if (/^[a-zäöüß]+$/i.test(n) && n.length <= 4) return lemma + n;
  // Full-word plural (e.g. "Themen" for "Thema")
  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(n)) return n;
  // Umlaut + optional suffix: 'ä, -e'  'Ä, -'  'Ä, -e'
  // Also handles bare suffix without dash: 'ä, er'  'ü, er'
  const umM = n.match(/^([äüöÄÜÖ]),\s*(-?[a-zäöüß]*)$/i);
  if (umM) {
    const umlauted = applyUmlaut(lemma, umM[1]);
    const sfxPart = umM[2] || '';
    const sfx = sfxPart.startsWith('-') ? sfxPart.slice(1) : sfxPart;
    return umlauted + sfx;
  }
  // Word-group style: 'ä-'  'ü-' = umlaut only
  const udM = n.match(/^([äüöÄÜÖ])-$/i);
  if (udM) return applyUmlaut(lemma, udM[1]);

  // Adjective/determiner inflection patterns like "-e, -s" or "-er, -e, -s"
  // These are not noun plurals — signal null without flagging via a sentinel
  if (/^(-[a-z]+,\s*){1,}-[a-z]+$/.test(n)) return 'NO_PLURAL';

  return null; // unrecognised
}

// ─── Article parsing ─────────────────────────────────────────────────────────

function parseArticle(ch) {
  return { r: 'der', e: 'die', s: 'das' }[ch] ?? null;
}

// ─── Word-groups section (pages 6-8) ─────────────────────────────────────────

const CATEGORY_MAP = {
  Anglizismen: 'anglizismen',
  'Anweisungssprache zur Prüfung': 'anweisungssprache',
  Berufe: 'berufe',
  Familienmitglieder: 'familie',
  Farben: 'farben',
  Feiertage: 'feiertage',
  Himmelsrichtungen: 'himmelsrichtungen',
  Jahreszeiten: 'jahreszeiten',
  'Länder und Nationalitäten': 'länder',
  'Maße und Gewichte': 'maße',
  Monatsnamen: 'monate',
  'Schulen und Schulfächer': 'schule',
  Tageszeiten: 'tageszeiten',
  Uhrzeit: 'uhrzeit',
  Wochentage: 'wochentage',
  Währungen: 'währungen',
  Zahlen: 'zahlen',
  Zeitangaben: 'zeitangaben',
};

/**
 * Parse a raw entry token from word groups.
 * Returns array of {lemma, article} objects (may be >1 for r/s dual forms).
 */
function parseWgToken(raw) {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return [];

  // Continuation marker
  if (t.startsWith('/ ') || t === '/') return [];

  // Dual article: "r/s Comic, -s"
  const dualM = t.match(/^([res])\/([res])\s+(.+)$/);
  if (dualM) {
    return [
      ...parseWgToken(`${dualM[1]} ${dualM[3]}`),
      ...parseWgToken(`${dualM[2]} ${dualM[3]}`),
    ];
  }

  // slash-separated pair on one line: "r Lehrer, - / e Lehrerin, -nen"
  // Split carefully — only split on ' / ' not inside paren
  const parts = t.split(/\s+\/\s+/);
  if (parts.length > 1) return parts.flatMap(parseWgToken);

  // Parse article + lemma (ignore plural notation here — just need lemma for category mapping)
  const artM = t.match(/^([res])\s+(.+)$/);
  let lemma = t;
  if (artM) lemma = artM[2];
  // Strip plural notation suffix: everything after first comma
  const commaIdx = lemma.indexOf(',');
  if (commaIdx >= 0) lemma = lemma.slice(0, commaIdx).trim();
  // Strip (Sg.) / (Pl.)
  lemma = lemma.replace(/\s*\((Sg|Pl)\.\)$/, '').trim();
  if (!lemma) return [];
  return [{ lemma }];
}

function parseWordGroups() {
  const text = extractText(PDF_PATH, { from: WG_FIRST, to: WG_LAST });
  const lines = text.split('\n').map((l) => l.replace(/\x0c/g, ''));

  // Pages 6-7: 2-column layout, split at col 43
  const SPLIT2 = 43;
  // Page 8: 3-column layout, splits at cols 7, 34, 51
  const P8_A = 7,
    P8_B = 34,
    P8_C = 51;

  const wordCats = new Map(); // lowerLemma → Set<category>

  function addCat(lemma, cat) {
    if (!lemma || !cat) return;
    const key = lemma.toLowerCase();
    if (!wordCats.has(key)) wordCats.set(key, new Set());
    wordCats.get(key).add(cat);
  }

  function processToken(raw, cat) {
    if (!raw || !cat) return;
    const t = raw.trim();
    if (!t) return;
    // Skip numbers, measurements, time format examples, skip-prefixes
    if (/^\d/.test(t)) return;
    if (/^\d+:\d+/.test(t)) return; // time format "7:03 Uhr = ..."
    if (/^(auf |der\/die |Angabe|z\. B\.)/i.test(t)) return;
    // Skip school subjects (no article, slash-separated)
    if (cat === 'schule' && !/^[res]\s/.test(t) && !/^[A-ZÄÖÜ]/.test(t)) return;
    // Skip category-name-only lines (they're headers, not entries)
    if (CATEGORY_MAP[t]) return;

    const parts = t.split(/\s*\/\s*/);
    for (const part of parts) {
      const entries = parseWgToken(part.trim());
      for (const e of entries) addCat(e.lemma, cat);
    }
  }

  function catFromHeader(str) {
    const s = str.trim();
    for (const [cn, cs] of Object.entries(CATEGORY_MAP)) {
      if (s === cn || s.startsWith(cn + ' ') || s.startsWith(cn + '\t'))
        return cs;
    }
    return null;
  }

  let inWg = false;
  let catLeft = null;
  let catRight = null;
  // Page 8 state
  let page8 = false;
  let catA = null; // col 7
  let catB = null; // col 34
  let catC = null; // col 51

  for (const line of lines) {
    const stripped = line.trimEnd();
    const trimmed = stripped.trimStart();
    if (!trimmed || /^\s*\d+\s*$/.test(trimmed) || trimmed === 'INVENTARE')
      continue;

    // Page 8 mode: activated by "Zeit" at col 0
    if (!page8 && stripped.match(/^Zeit\s+Feiertage/)) {
      page8 = inWg = true;
      catA = catFromHeader(stripped.slice(P8_A, P8_B));
      catB = catFromHeader(stripped.slice(P8_B, P8_C));
      catC = catFromHeader(stripped.slice(P8_C));
      continue;
    }

    if (page8) {
      // Seite footer ends page 8
      if (/^Seite\s+\d+/i.test(trimmed)) {
        page8 = false;
        continue;
      }

      const a = stripped.length > P8_A ? stripped.slice(P8_A, P8_B).trim() : '';
      const b = stripped.length > P8_B ? stripped.slice(P8_B, P8_C).trim() : '';
      const c = stripped.length > P8_C ? stripped.slice(P8_C).trim() : '';

      // Update sub-category headers
      const newA = a ? catFromHeader(a) : null;
      const newC = c ? catFromHeader(c) : null;
      if (newA) {
        catA = newA;
      }
      if (newC) {
        catC = newC;
      }

      // Process data cells (skip if they're pure category headers)
      if (a && !newA) processToken(a, catA);
      if (b) processToken(b, catB); // always months
      if (c && !newC) processToken(c, catC);
      continue;
    }

    const indent = stripped.length - trimmed.length;

    // Pages 6-7: detect category section headers at low indent
    if (indent < 5) {
      const cat = catFromHeader(trimmed);
      if (cat) {
        inWg = true;
        catLeft = cat;
        // Right-column category on same line
        const rest = trimmed.replace(/^\S.*?\s{3,}/, '').trim();
        catRight = catFromHeader(rest);
        continue;
      }
      if (!inWg) continue;
    }

    if (!inWg) continue;

    // Continuation starting with "/"
    if (trimmed.startsWith('/')) {
      processToken(trimmed.slice(1).trim(), catLeft);
      continue;
    }

    const leftRaw =
      stripped.length > SPLIT2
        ? stripped.slice(0, SPLIT2).trimEnd()
        : stripped.trimEnd();
    const rightRaw =
      stripped.length > SPLIT2 ? stripped.slice(SPLIT2).trimStart() : '';

    if (leftRaw.trim()) processToken(leftRaw.trim(), catLeft);
    if (rightRaw.trim()) processToken(rightRaw.trim(), catRight || catLeft);
  }

  return wordCats;
}

// ─── Alphabetical section (pages 9-21) ───────────────────────────────────────
//
// Page 9:  entries at col 16, examples at col ~38, continuations at col 38+.
// Pages 10-21: entries at col 0, examples at col ~22, continuations at col 20-24.
//
// Continuation rule: indent >= 20 AND no article/lemma at col 0-15.
// Entry rule: indent < 20 (entries on pages 10+ are always at col 0).

const CONT_INDENT = 20; // minimum indent for a continuation line

function cleanExample(ex) {
  return ex.replace(/\s*\(vergl\. Grammatik\)\s*/g, '').replace(/\s+$/, '');
}

function parseAlphabetical() {
  const text = extractText(PDF_PATH, { from: ALPHA_FIRST, to: ALPHA_LAST });
  const lines = text.split('\n').map((l) => l.replace(/\x0c/g, ''));

  const entries = [];
  let current = null;

  function pushCurrent() {
    if (current?.lemma) entries.push(current);
    current = null;
  }

  function appendExample(text) {
    const cleaned = cleanExample(text);
    if (!cleaned) return;
    if (current.examples.length > 0) {
      current.examples[current.examples.length - 1] += ' ' + cleaned;
    } else {
      current.examples.push(cleaned);
    }
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const raw = line.trimEnd();
    const trimmed = raw.trimStart();
    if (!trimmed || trimmed === 'INVENTARE') continue;
    if (/^\s*(Seite\s+)?\d+\s*$/.test(trimmed)) continue;

    const indent = raw.length - trimmed.length;

    // Single-letter section header: "A", "B", …
    if (/^[A-ZÄÖÜ]$/.test(trimmed)) continue;

    // Cross-references like "(s Fahrrad)" — skip
    if (/^\([res]\s+\S/.test(trimmed)) continue;

    // Page-9 column labels
    if (
      trimmed.startsWith('Alphabetische') ||
      trimmed.startsWith('Wortliste')
    ) {
      const m = trimmed.match(/^Wortliste\s+(\S.*?)(?:\s{2,}(.+))?$/);
      if (m) {
        pushCurrent();
        current = makeEntry(m[1].trim(), m[2]?.trim() || '');
      }
      continue;
    }

    // Continuation: indent >= CONT_INDENT
    if (indent >= CONT_INDENT) {
      if (current) appendExample(trimmed);
      continue;
    }

    // New entry line.
    // Attempt 1: split on first 2+ space gap (handles most entries).
    // Attempt 2: for pages-10+ entries where lemma ends at col 22 with 1-space gap,
    //            split at col 22 of the original raw line.
    let rawBlock, exampleRaw;
    const exSepM = trimmed.match(/^(.+?)\s{2,}(.+)$/);
    if (exSepM) {
      rawBlock = exSepM[1].trimEnd();
      exampleRaw = exSepM[2].trimStart();
    } else if (indent === 0 && raw.length > 22) {
      // Pages-10+ with 1-space gap: split at col 22
      rawBlock = raw.slice(0, 22).trim();
      exampleRaw = raw.slice(22).trim();
    } else {
      rawBlock = trimmed;
      exampleRaw = '';
    }

    pushCurrent();
    current = makeEntry(rawBlock, exampleRaw);
  }

  pushCurrent();
  return entries;
}

/**
 * Build an entry object from the lemma block and optional example string.
 * Handles:
 *   "r Anfang, ä, -e"
 *   "e Achtung (Sg.)"
 *   "abfahren"
 *   "r, e, s beste"   → multiple articles, strip to "beste"
 */
function makeEntry(rawBlock, exampleRaw) {
  let block = rawBlock.trim();

  // Skip empty or cross-reference blocks
  if (!block || /^\(/.test(block)) return null;

  // "der, die, das" — the definite article listed with all forms
  if (/^(der|die|das)(,\s*(der|die|das))+$/.test(block)) {
    return {
      article: null,
      lemma: block,
      plural: null,
      en: '',
      examples: exampleRaw ? [cleanExample(exampleRaw)].filter(Boolean) : [],
      sources: ['goethe'],
      categories: [],
    };
  }

  // "r, e, s X" multi-article form
  block = block.replace(/^[res](, [res])+\s+/, '');

  // "r/e X" or "r/s X" dual-article form (alphabetical section)
  // → keep as single entry with article=null
  block = block.replace(/^[res]\/[res]\s+/, '');

  // Parse optional article marker
  const artM = block.match(/^([res])\s+(.+)$/);
  let articleChar = null;
  let rest = block;
  if (artM) {
    articleChar = artM[1];
    rest = artM[2];
  }

  // Separate lemma and plural notation
  let lemma, pluralNotation;
  const spM = rest.match(/^(.*?)\s*\((Sg|Pl)\.\)$/);
  if (spM) {
    lemma = spM[1].trim();
    pluralNotation = `(${spM[2]}.)`;
  } else {
    // Strip parenthetical alternative from plural notation:
    // "e Disco, -s (-thek, -en)" → notation = "-s"
    rest = rest.replace(/,\s*\(-thek.*?\)/, '').trim();
    const ci = rest.indexOf(',');
    if (ci >= 0) {
      lemma = rest.slice(0, ci).trim();
      pluralNotation = rest.slice(ci + 1).trim();
    } else {
      lemma = rest.trim();
      pluralNotation = null;
    }
  }

  if (!lemma) return null;

  const article = parseArticle(articleChar);
  const rawPlural = pluralNotation ? expandPlural(lemma, pluralNotation) : null;
  // 'NO_PLURAL' sentinel means "recognised as non-noun inflection, no plural needed"
  const plural = rawPlural === 'NO_PLURAL' ? null : rawPlural;

  if (
    pluralNotation !== null &&
    pluralNotation !== '(Sg.)' &&
    pluralNotation !== '(Pl.)' &&
    pluralNotation !== '-' &&
    rawPlural === null
  ) {
    flag({
      page: 0,
      rawLine: rawBlock,
      reason: `unrecognised plural notation "${pluralNotation}"`,
    });
  }

  const cleanedEx = exampleRaw ? cleanExample(exampleRaw) : '';
  return {
    article,
    lemma,
    plural,
    en: '',
    examples: cleanedEx ? [cleanedEx] : [],
    sources: ['goethe'],
    categories: [],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('Extracting goethe-a1 …');

const wordCats = parseWordGroups();
const alphaEntries = parseAlphabetical().filter(Boolean);

// Merge categories
for (const e of alphaEntries) {
  const cats = wordCats.get(e.lemma.toLowerCase());
  if (cats) e.categories = [...cats].sort();
}

// Deduplicate by lower-lemma (same word appearing in multiple alpha entries is rare)
const seen = new Map();
for (const e of alphaEntries) {
  const key = e.lemma.toLowerCase();
  if (seen.has(key)) {
    const prev = seen.get(key);
    // Merge categories
    prev.categories = [
      ...new Set([...prev.categories, ...e.categories]),
    ].sort();
    // Merge examples
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
  `  Flagged ${flagCount} rows → data/sources/${level}/${outName}_flagged.json`,
);
