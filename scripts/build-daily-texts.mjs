// scripts/build-daily-texts.mjs
// Phase 1c — Daily reading corpus (deterministic annotate + validate, re-runnable).
//
// Reads the agent-authored source:
//   data/sources/daily-texts.src.json
//     [{ id, title, topic, level, text, used: [{ wordId, surface }] }]
// and emits the immutable runtime corpus:
//   data/daily-texts.json   (array of DailyText, sorted by id)
//
// No network, no LLM. The texts themselves are authored once during a build
// session (like the Phase 1a AI cleanup); this stage only resolves each used
// word against words.json and turns the recorded `surface` forms into exact
// character spans for highlighting. Running it repeatedly is idempotent.
//
// Matching is boundary-aware (Unicode letters) so a surface like "im" is not
// matched inside "immer", and every occurrence of a surface is highlighted.
//
// The script is a hard validation gate: it exits non-zero if any used wordId is
// missing from words.json or any recorded surface is not found in its text.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const words = JSON.parse(readFileSync(join(DATA, 'words.json'), 'utf8'));
const wordIds = new Set(words.map((w) => w.id));

const LEVELS = new Set(['a1', 'a2', 'b1']);

const src = JSON.parse(
  readFileSync(join(DATA, 'sources', 'daily-texts.src.json'), 'utf8'),
);

const problems = [];

// Escape a string for use inside a RegExp.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find every whole-token occurrence of `surface` in `text`. A token boundary is
// any position not flanked by a Unicode letter, so inflected words and
// multi-word surfaces ("zu Hause") match but substrings of longer words do not.
function findOccurrences(text, surface) {
  const re = new RegExp(`(?<!\\p{L})${escapeRegExp(surface)}(?!\\p{L})`, 'gu');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + surface.length });
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
  return out;
}

const seenIds = new Set();
const texts = [];

for (const entry of src) {
  const { id, title, topic, level, text, used } = entry;
  if (!id || !title || !topic || !text || !Array.isArray(used)) {
    problems.push(`Entry "${id ?? '?'}" is missing required fields.`);
    continue;
  }
  if (!LEVELS.has(level)) {
    problems.push(`[${id}] missing or invalid level "${level}".`);
    continue;
  }
  if (seenIds.has(id)) problems.push(`Duplicate text id "${id}".`);
  seenIds.add(id);

  const spans = [];
  const ids = new Set();

  for (const u of used) {
    if (!wordIds.has(u.wordId)) {
      problems.push(`[${id}] unknown wordId "${u.wordId}".`);
      continue;
    }
    const occ = findOccurrences(text, u.surface);
    if (occ.length === 0) {
      problems.push(
        `[${id}] surface "${u.surface}" (wordId ${u.wordId}) not found in text.`,
      );
      continue;
    }
    ids.add(u.wordId);
    for (const o of occ) spans.push({ ...o, wordId: u.wordId });
  }

  // Sort by position; drop spans that overlap an already-kept span so render
  // segmentation stays simple and unambiguous.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let lastEnd = -1;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      kept.push(s);
      lastEnd = s.end;
    }
  }

  texts.push({
    id,
    title,
    topic,
    level,
    text,
    wordIds: [...ids].sort(),
    spans: kept,
  });
}

texts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

writeFileSync(
  join(DATA, 'daily-texts.json'),
  JSON.stringify(texts, null, 2) + '\n',
);

// Coverage summary.
const covered = new Set();
for (const t of texts) for (const id of t.wordIds) covered.add(id);
const totalSpans = texts.reduce((n, t) => n + t.spans.length, 0);
const avgTargets = (
  texts.reduce((n, t) => n + t.wordIds.length, 0) / (texts.length || 1)
).toFixed(1);
const topics = new Set(texts.map((t) => t.topic));
const byLevel = texts.reduce((acc, t) => {
  acc[t.level] = (acc[t.level] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `daily-texts: ${texts.length}  topics: ${topics.size}  ` +
    `spans: ${totalSpans}  avg targets/text: ${avgTargets}`,
);
console.log(
  `by level: ${Object.entries(byLevel)
    .map(([l, n]) => `${l}=${n}`)
    .join('  ')}`,
);
console.log(
  `vocab coverage: ${covered.size}/${wordIds.size} word ids appear in ≥1 text`,
);
