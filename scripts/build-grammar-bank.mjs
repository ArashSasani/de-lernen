// scripts/build-grammar-bank.mjs
// M2 — Grammar practice, offline-first (deterministic hard gate, re-runnable).
//
// Reads the agent-authored source:
//   data/sources/grammar-bank.src.json
//     [{ id, topicId, level, difficulty, prompt, choices, correctIndex, explanation }]
// and emits the immutable runtime bank:
//   data/grammar-bank.json   (array of QuizQuestion, sorted by topicId then id)
//
// No network, no LLM. Items are authored once during a build session (grounded in each
// topic's grammar.json title/explanation/tables/examples); this stage only validates format
// and coverage, then freezes the result. Running it repeatedly is idempotent.
//
// The script is a hard validation gate: it exits non-zero if any item is malformed, if any
// id/prompt collides, or if any quizzable topic has fewer than MIN_ITEMS_PER_TOPIC items.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const grammarTopics = JSON.parse(
  readFileSync(join(DATA, 'grammar.json'), 'utf8'),
);
const topicIds = new Set(grammarTopics.map((t) => t.id));

// Reference-only topics excluded from quizzes.
const NO_QUIZ_TOPICS = new Set(['nomen-grossschreibung']);
const quizzableTopicIds = [...topicIds].filter((id) => !NO_QUIZ_TOPICS.has(id));

const LEVELS = new Set(['a1', 'a2', 'b1']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const MIN_ITEMS_PER_TOPIC = 8;

const src = JSON.parse(
  readFileSync(join(DATA, 'sources', 'grammar-bank.src.json'), 'utf8'),
);

const problems = [];
const seenIds = new Set();
const promptsByTopic = new Map();
const items = [];

for (const [i, item] of src.entries()) {
  const label = item?.id ? `[${item.id}]` : `[index ${i}]`;
  const {
    id,
    topicId,
    level,
    difficulty,
    prompt,
    choices,
    correctIndex,
    explanation,
  } = item ?? {};

  if (!id || typeof id !== 'string') {
    problems.push(`${label} missing/invalid id.`);
    continue;
  }
  if (seenIds.has(id)) {
    problems.push(`Duplicate id "${id}".`);
    continue;
  }
  seenIds.add(id);

  if (!topicId || !topicIds.has(topicId)) {
    problems.push(`${label} unknown topicId "${topicId}".`);
    continue;
  }
  if (NO_QUIZ_TOPICS.has(topicId)) {
    problems.push(
      `${label} topicId "${topicId}" is reference-only, not quizzable.`,
    );
    continue;
  }
  if (!LEVELS.has(level)) {
    problems.push(`${label} invalid level "${level}".`);
    continue;
  }
  if (!DIFFICULTIES.has(difficulty)) {
    problems.push(`${label} invalid difficulty "${difficulty}".`);
    continue;
  }
  if (!Array.isArray(choices) || choices.length < 3 || choices.length > 4) {
    problems.push(`${label} choices must have 3-4 entries.`);
    continue;
  }
  const nonEmpty = choices.every(
    (c) => typeof c === 'string' && c.trim().length > 0,
  );
  if (!nonEmpty) {
    problems.push(`${label} choices must all be non-empty strings.`);
    continue;
  }
  if (new Set(choices).size !== choices.length) {
    problems.push(`${label} choices must be unique.`);
    continue;
  }
  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= choices.length
  ) {
    problems.push(`${label} correctIndex out of range.`);
    continue;
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    problems.push(`${label} missing prompt.`);
    continue;
  }
  if (
    !explanation ||
    typeof explanation !== 'string' ||
    explanation.trim().length === 0
  ) {
    problems.push(`${label} missing explanation.`);
    continue;
  }

  const seenPrompts = promptsByTopic.get(topicId) ?? new Set();
  if (seenPrompts.has(prompt)) {
    problems.push(
      `${label} duplicate prompt within topic "${topicId}": "${prompt}"`,
    );
    continue;
  }
  seenPrompts.add(prompt);
  promptsByTopic.set(topicId, seenPrompts);

  items.push({
    id,
    topicId,
    level,
    difficulty,
    prompt,
    choices,
    correctIndex,
    explanation,
  });
}

for (const topicId of quizzableTopicIds) {
  const count = items.filter((it) => it.topicId === topicId).length;
  if (count < MIN_ITEMS_PER_TOPIC) {
    problems.push(
      `Topic "${topicId}" has only ${count} item(s), needs >= ${MIN_ITEMS_PER_TOPIC}.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

items.sort((a, b) => {
  if (a.topicId !== b.topicId) return a.topicId < b.topicId ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
});

writeFileSync(
  join(DATA, 'grammar-bank.json'),
  JSON.stringify(items, null, 2) + '\n',
);

// Coverage summary.
const byTopic = new Map();
const byLevel = {};
const byDifficulty = {};
for (const it of items) {
  byTopic.set(it.topicId, (byTopic.get(it.topicId) ?? 0) + 1);
  byLevel[it.level] = (byLevel[it.level] ?? 0) + 1;
  byDifficulty[it.difficulty] = (byDifficulty[it.difficulty] ?? 0) + 1;
}

console.log(
  `grammar-bank: ${items.length} items across ${byTopic.size}/${quizzableTopicIds.length} quizzable topics`,
);
console.log(
  `by level: ${Object.entries(byLevel)
    .map(([l, n]) => `${l}=${n}`)
    .join('  ')}`,
);
console.log(
  `by difficulty: ${Object.entries(byDifficulty)
    .map(([d, n]) => `${d}=${n}`)
    .join('  ')}`,
);
