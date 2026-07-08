import type { GrammarCategory, GrammarTopic } from '@/types';
import type { CategoryGroup } from '@/lib/grammar';

export const ALLOWED_CATEGORIES: GrammarCategory[] = [
  'verben',
  'nomen-artikel',
  'pronomen',
  'satzbau',
  'praepositionen',
  'negation',
  'adverbien',
  'verben-kasus',
  'zahlen',
];

/**
 * Returns the groups with at least one topic, preserving fixed category order.
 */
export function activeGroups(groups: CategoryGroup[]): CategoryGroup[] {
  return groups.filter((g) => g.topics.length > 0);
}

/**
 * Converts a `\n\n`-separated explanation string into an array of paragraphs.
 */
export function splitParagraphs(explanation: string): string[] {
  return explanation
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Returns true if the topic's content contains the query (case-insensitive).
 * Searches title, summary, explanation, tips, examples, and table cells.
 */
export function matchesTopic(topic: GrammarTopic, query: string): boolean {
  const q = query.toLowerCase();
  const text = [
    topic.title,
    topic.summary,
    topic.explanation,
    ...topic.tips,
    ...topic.examples.map((e) => `${e.de} ${e.en}`),
    ...topic.tables.flatMap((t) => [
      t.caption ?? '',
      ...t.headers,
      ...t.rows.flat(),
    ]),
  ]
    .join(' ')
    .toLowerCase();
  return text.includes(q);
}

/**
 * Returns groups filtered to topics matching the query.
 * Returns all groups unchanged when query is empty.
 */
export function filterGroups(
  groups: CategoryGroup[],
  query: string,
): CategoryGroup[] {
  if (!query.trim()) return groups;
  return groups
    .map((g) => ({
      ...g,
      topics: g.topics.filter((t) => matchesTopic(t, query)),
    }))
    .filter((g) => g.topics.length > 0);
}
