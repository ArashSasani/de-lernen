import {
  activeGroups,
  splitParagraphs,
  matchesTopic,
  filterGroups,
  ALLOWED_CATEGORIES,
} from './page.helpers';
import type { CategoryGroup } from '@/lib/grammar';
import type { GrammarCategory, GrammarTopic } from '@/types';
import { grammarTopics } from '@/lib/grammar';

function makeGroup(
  category: GrammarCategory,
  label: string,
  count: number,
): CategoryGroup {
  const topics: GrammarTopic[] = Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i}`,
    category,
    title: `Title ${i}`,
    summary: `Summary ${i}`,
    explanation: `Explanation ${i}`,
    tables: [],
    examples: [],
    tips: [],
  }));
  return { category, label, topics };
}

describe('activeGroups', () => {
  it('filters out empty categories', () => {
    const groups: CategoryGroup[] = [
      makeGroup('verben', 'Verben', 2),
      makeGroup('nomen-artikel', 'Nomen & Artikel', 0),
      makeGroup('pronomen', 'Pronomen', 1),
    ];
    const result = activeGroups(groups);
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.category)).toEqual(['verben', 'pronomen']);
  });

  it('returns all groups when all have topics', () => {
    const groups: CategoryGroup[] = ALLOWED_CATEGORIES.map((c) =>
      makeGroup(c, c, 1),
    );
    expect(activeGroups(groups)).toHaveLength(ALLOWED_CATEGORIES.length);
  });

  it('returns empty array when all categories are empty', () => {
    const groups: CategoryGroup[] = ALLOWED_CATEGORIES.map((c) =>
      makeGroup(c, c, 0),
    );
    expect(activeGroups(groups)).toHaveLength(0);
  });
});

describe('splitParagraphs', () => {
  it('splits on double newlines', () => {
    const result = splitParagraphs('First paragraph.\n\nSecond paragraph.');
    expect(result).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('trims whitespace from paragraphs', () => {
    const result = splitParagraphs('  Hello  \n\n  World  ');
    expect(result).toEqual(['Hello', 'World']);
  });

  it('handles single paragraph with no splits', () => {
    const result = splitParagraphs('Just one paragraph.');
    expect(result).toEqual(['Just one paragraph.']);
  });

  it('filters empty paragraphs', () => {
    const result = splitParagraphs('First\n\n\n\nSecond');
    expect(result).toEqual(['First', 'Second']);
  });
});

describe('matchesTopic', () => {
  const base: import('@/types').GrammarTopic = {
    id: 'test',
    category: 'verben',
    title: 'Dativ',
    summary: 'Uses mir, dir, ihm',
    explanation: 'The dative case marks the indirect object.',
    tables: [
      {
        caption: 'Pronouns',
        headers: ['Person', 'Dativ'],
        rows: [['ich', 'mir']],
      },
    ],
    examples: [{ de: 'Ich gebe ihr das Buch.', en: 'I give her the book.' }],
    tips: ['seit takes the dative'],
  };

  it('matches title', () => expect(matchesTopic(base, 'dativ')).toBe(true));
  it('matches summary', () => expect(matchesTopic(base, 'mir')).toBe(true));
  it('matches table cell', () =>
    expect(matchesTopic(base, 'Pronouns')).toBe(true));
  it('matches example German', () =>
    expect(matchesTopic(base, 'gebe')).toBe(true));
  it('matches example English', () =>
    expect(matchesTopic(base, 'give her')).toBe(true));
  it('matches tip', () => expect(matchesTopic(base, 'seit')).toBe(true));
  it('is case-insensitive', () =>
    expect(matchesTopic(base, 'DATIV')).toBe(true));
  it('returns false for no match', () =>
    expect(matchesTopic(base, 'xyz123')).toBe(false));
});

describe('filterGroups', () => {
  it('returns all groups unchanged when query is empty', () => {
    const groups = [makeGroup('verben', 'Verben', 2)];
    expect(filterGroups(groups, '')).toBe(groups);
    expect(filterGroups(groups, '   ')).toBe(groups);
  });

  it('removes topics that do not match and empty groups', () => {
    const groups = [
      {
        category: 'verben' as import('@/types').GrammarCategory,
        label: 'Verben',
        topics: [
          {
            id: 't1',
            category: 'verben' as import('@/types').GrammarCategory,
            title: 'seit',
            summary: '',
            explanation: '',
            tables: [],
            examples: [],
            tips: [],
          },
          {
            id: 't2',
            category: 'verben' as import('@/types').GrammarCategory,
            title: 'Imperativ',
            summary: '',
            explanation: '',
            tables: [],
            examples: [],
            tips: [],
          },
        ],
      },
    ];
    const result = filterGroups(groups, 'seit');
    expect(result).toHaveLength(1);
    expect(result[0].topics).toHaveLength(1);
    expect(result[0].topics[0].id).toBe('t1');
  });

  it('removes groups with no matching topics', () => {
    const groups = [
      makeGroup('verben', 'Verben', 1),
      makeGroup('pronomen', 'Pronomen', 1),
    ];
    const result = filterGroups(groups, 'xyznonexistent');
    expect(result).toHaveLength(0);
  });
});

describe('grammar data integrity', () => {
  it('every topic id is unique', () => {
    const ids = grammarTopics.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every topic category is in the allowed set', () => {
    const allowed = new Set<string>(ALLOWED_CATEGORIES);
    for (const topic of grammarTopics) {
      expect(allowed.has(topic.category)).toBe(true);
    }
  });
});
