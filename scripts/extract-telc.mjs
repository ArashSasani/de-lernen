#!/usr/bin/env node
/**
 * Extract vocabulary from Telc Einfach gut A1.1 / A1.2 PDFs.
 * Usage:
 *   node scripts/extract-telc.mjs --source a1.1
 *   node scripts/extract-telc.mjs --source a1.2
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { extractText } from './lib/pdf-text.mjs';
import { createFlagger } from './lib/flag.mjs';

const ROOT = new URL('../', import.meta.url).pathname;

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const srcArg = args[args.indexOf('--source') + 1];
if (!srcArg || !['a1.1', 'a1.2'].includes(srcArg)) {
  console.error('Usage: node scripts/extract-telc.mjs --source a1.1|a1.2');
  process.exit(1);
}

const isA11 = srcArg === 'a1.1';
const pdfFile = isA11
  ? 'Einfach_gut_A1.1_Wortschatzliste_Englisch.pdf'
  : 'Einfach_gut_A1.2_Wortschatzliste_Englisch.pdf';
const outName = isA11 ? 'telc-a1-1' : 'telc-a1-2';

const pdfPath = join(ROOT, 'data/sources/a1', pdfFile);
const outPath = join(ROOT, `data/sources/${outName}.json`);

// ─── Regexes / helpers ──────────────────────────────────────────────────────

const RE_HEADER = /Artikel\s+Deutsch\s+.*Plural\s+.*Englisch/;
const RE_SECTION = /Wortschatz\s+zu\s+Lektion\s+(\d+)/i;
const RE_FOOTER = /^\s*(©\s*telc|Einfach gut!|\d+\s*$)/;
const RE_PAGE_BREAK = /\x0c/;

// Pronouns appearing in German conjugation continuations
const RE_CONJ_PRONOUN = /\b(ich|du|er|sie|Sie|wir|ihr)\b/;

function countParens(str) {
  if (!str) return 0;
  let n = 0;
  for (const ch of str) {
    if (ch === '(') n++;
    else if (ch === ')') n--;
  }
  return n;
}

function parseArticle(raw) {
  switch (raw.trim()) {
    case 'der':
      return 'der';
    case 'die':
      return 'die';
    case 'das':
      return 'das';
    default:
      return null;
  }
}

// ─── Parse ──────────────────────────────────────────────────────────────────

function parse(text, sourceName) {
  const flag = createFlagger(outName);
  const entries = [];

  let colPl = 47;
  let colEn = 58;
  let colEx = 81;

  let current = null;
  let parenDepth = 0;
  let pageNum = 1;

  // EN content buffered when parenDepth=0 (pre-entry in PDF layout).
  // Flushed to the next entry that starts, accounting for open parens it contributes.
  let pendingEn = [];

  function flushPendingEn(target) {
    if (!pendingEn.length) return;
    for (const pe of pendingEn) {
      target.en = target.en ? target.en + ' ' + pe : pe;
      parenDepth = Math.max(0, parenDepth + countParens(pe));
    }
    pendingEn = [];
  }

  function pushCurrent() {
    if (!current) return;
    if (current.lemma) entries.push(current);
    current = null;
    // pendingEn intentionally NOT cleared — it may belong to the next entry
    parenDepth = 0;
  }

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(RE_PAGE_BREAK, '');

    if (RE_FOOTER.test(line)) {
      if (/^\s*\d+\s*$/.test(line.trim())) pageNum++;
      continue;
    }

    if (RE_HEADER.test(line)) {
      const pl = line.indexOf('Plural');
      const en = line.indexOf('Englisch');
      const ex = line.indexOf('Beispielsatz');
      if (pl > 0) colPl = pl;
      if (en > 0) colEn = en;
      if (ex > 0) colEx = ex;
      continue;
    }

    // Lektion/section headers aren't word rows — skip them.
    if (RE_SECTION.test(line)) {
      continue;
    }

    if (!line.trim()) continue;

    const art = (line.length > 1 ? line.slice(1, 14) : '').trim();
    const de = (line.length > 14 ? line.slice(14, colPl) : '').trim();
    const pl = (line.length > colPl ? line.slice(colPl, colEn) : '').trim();
    const en = (line.length > colEn ? line.slice(colEn, colEx) : '').trim();
    const ex = (line.length > colEx ? line.slice(colEx) : '').trim();

    if (!art && !de && !pl && !en && !ex) continue;

    const isContByRule = !art && (!de || de.startsWith('(') || parenDepth > 0);

    // Ambiguous: parenDepth > 0 but DE looks like a standalone new lemma, not a conjugation
    const isAmbiguousCont =
      isContByRule && de && !de.startsWith('(') && !RE_CONJ_PRONOUN.test(de);

    if (isAmbiguousCont) {
      flag({
        page: pageNum,
        rawLine: line.trim(),
        reason: `ambiguous continuation: de="${de}" parenDepth=${parenDepth}`,
      });
    }

    const isContinuation = isContByRule && !isAmbiguousCont;

    if (isContinuation) {
      if (!current) {
        flag({
          page: pageNum,
          rawLine: line.trim(),
          reason: 'continuation with no open entry',
        });
        continue;
      }

      if (de) {
        // DE continuation: flush pending EN first so it attaches to the right entry
        flushPendingEn(current);
        current.lemma += ' ' + de;
        parenDepth = Math.max(0, parenDepth + countParens(de));
      }

      if (en) {
        if (parenDepth > 0) {
          // Inside an open-paren block: flush pending, then append EN
          flushPendingEn(current);
          current.en = current.en ? current.en + ' ' + en : en;
          parenDepth = Math.max(0, parenDepth + countParens(en));
        } else {
          // parenDepth=0 — EN may belong to the next entry (PDF pre-entry quirk). Buffer it.
          pendingEn.push(en);
        }
      }

      if (ex) {
        if (current.examples.length > 0) {
          current.examples[current.examples.length - 1] += ' ' + ex;
        } else {
          current.examples.push(ex);
        }
      }
    } else {
      // New entry
      pushCurrent();

      if (!de) {
        if (en) {
          // EN content with no lemma on this line. Buffer for the next entry.
          pendingEn.push(en);
        }
        if (ex) {
          flag({
            page: pageNum,
            rawLine: line.trim(),
            reason: 'example before lemma (PDF layout)',
          });
        }
        continue;
      }

      current = {
        article: parseArticle(art),
        lemma: de,
        plural: pl || null,
        en: en || '',
        examples: ex ? [ex] : [],
        sources: [sourceName],
        categories: [],
      };
      parenDepth = Math.max(0, countParens(de) + countParens(en));
      // Flush any EN that arrived before this lemma
      flushPendingEn(current);
    }
  }

  pushCurrent();

  const flagCount = flag.save();
  return { entries, flagCount };
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Strip trailing parenthetical conjugation notes from a German lemma.
 * "heißen (ich heiße – du heißt – er heißt)" → "heißen"
 */
function cleanLemma(raw) {
  return raw.replace(/\s*\(.*$/, '').trim();
}

/**
 * Strip trailing conjugation notes from English.
 * "to be called (my name is – ...)" → "to be called"
 * "(to) you" and "(I am – ...)" are kept as-is (the latter because cleaning
 * would leave an empty string — the fallback preserves it for Phase 1b).
 */
function cleanEn(raw) {
  const cleaned = raw.replace(/\s*\([^)]*–[^)]*\)/g, '').trim();
  // Don't produce an empty string — keep raw if cleaning strips everything
  return cleaned || raw.trim();
}

// ─── Known PDF layout fixes ───────────────────────────────────────────────────
//
// pdftotext renders some wide table rows with the Beispielsatz column appearing
// before the Deutsch column in the text stream. These cases are deterministic for
// each PDF, so we fix them explicitly rather than guessing at parse time.

const FIXES_A11 = [
  // über: example was split across Tochter (prefix) and über (suffix)
  (m) => {
    const tochter = m.get('tochter');
    const ueber = m.get('über');
    if (tochter)
      tochter.examples = tochter.examples.filter(
        (x) => !x.startsWith('Der Zug'),
      );
    if (ueber) ueber.examples = ['Der Zug nach Basel fährt über Stuttgart.']; // fahrt→fährt
  },
  // natürlich: "Noch einmal..." was on Montag; "Natürlich." was on natürlich
  (m) => {
    const montag = m.get('montag');
    const nat = m.get('natürlich');
    if (montag)
      montag.examples = montag.examples.filter(
        (x) => !x.startsWith('Noch einmal'),
      );
    if (nat) nat.examples = ['Noch einmal langsam bitte! – Natürlich.'];
  },
  // nehmen: "Sie nehmen..." split across Freund (extra) and für (tail)
  (m) => {
    const freund = m.get('freund');
    const fuer = m.get('für');
    const nehmen = m.get('nehmen');
    if (freund) {
      // "Sie nehmen…" may have been appended onto the Freund example string
      freund.examples = freund.examples
        .map((x) => {
          const i = x.indexOf(' Sie nehmen');
          return i > 0 ? x.slice(0, i) : x;
        })
        .filter(Boolean);
    }
    if (fuer) fuer.examples = fuer.examples.filter((x) => x !== 'Euro.');
    if (nehmen) nehmen.examples = ['Sie nehmen die Wohnung für 750 Euro.'];
  },
  // bekommen: "Meine Blumen..." split across bei (prefix) and bekommen (tail)
  (m) => {
    const bei = m.get('bei');
    const bekomm = m.get('bekommen');
    if (bei)
      bei.examples = bei.examples.filter((x) => !x.startsWith('Meine Blumen'));
    if (bekomm) bekomm.examples = ['Meine Blumen bekommen jeden Tag Wasser.'];
  },
  // lassen: "Lass uns..." split across lang (prefix) and lassen (tail with soft-hyphen)
  (m) => {
    const lang = m.get('lang');
    const lassen = m.get('lassen');
    if (lang)
      lang.examples = lang.examples.filter((x) => !x.startsWith('Lass uns'));
    if (lassen)
      lassen.examples = ['Lass uns in einem anderen Geschäft schauen.'];
  },
  // erst: "Wir lernen..." split across Computerspiel (prefix) and erst (tail)
  (m) => {
    const cs = m.get('computerspiel');
    const erst = m.get('erst');
    if (cs)
      cs.examples = cs.examples.filter((x) => !x.startsWith('Wir lernen'));
    if (erst)
      erst.examples = ['Wir lernen erst Deutsch, dann gehen wir spazieren.'];
  },
  // liegen: "Die Wohnung..." split across liebsten (prefix) and liegen (tail)
  (m) => {
    const lieb = m.get('liebsten');
    const lieg = m.get('liegen');
    if (lieb)
      lieb.examples = lieb.examples.filter(
        (x) => !x.startsWith('Die Wohnung liegt'),
      );
    if (lieg) lieg.examples = ['Die Wohnung liegt direkt an der Hauptstraße.'];
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

const sourceName = isA11 ? 'telc-a1.1' : 'telc-a1.2';
console.log(`Extracting ${sourceName} from ${pdfFile} …`);

const text = extractText(pdfPath);
const { entries, flagCount } = parse(text, sourceName);

const cleaned = entries.map((e) => ({
  ...e,
  lemma: cleanLemma(e.lemma),
  en: cleanEn(e.en),
}));

// Deduplicate by lemma (case-insensitive): keep first
const seen = new Map();
for (const e of cleaned) {
  const key = e.lemma.toLowerCase();
  if (seen.has(key)) {
    const prev = seen.get(key);
    if (!prev.en && e.en) prev.en = e.en;
  } else {
    seen.set(key, e);
  }
}

// Apply known PDF layout fixes (A1.1 only)
if (isA11) {
  for (const fix of FIXES_A11) fix(seen);
}

const deduped = [...seen.values()];

writeFileSync(outPath, JSON.stringify(deduped, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${deduped.length} entries to ${outPath}`);
console.log(
  `  Flagged ${flagCount} rows → data/sources/${outName}_flagged.json`,
);
