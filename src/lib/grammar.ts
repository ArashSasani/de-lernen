import grammarData from '../../data/grammar.json';
import type { GrammarCategory, GrammarTopic } from '@/types';

export const grammarTopics: GrammarTopic[] = grammarData as GrammarTopic[];

export interface CategoryGroup {
  category: GrammarCategory;
  label: string;
  topics: GrammarTopic[];
}

const CATEGORY_ORDER: { category: GrammarCategory; label: string }[] = [
  { category: 'verben', label: 'Verben' },
  { category: 'nomen-artikel', label: 'Nomen & Artikel' },
  { category: 'pronomen', label: 'Pronomen' },
  { category: 'satzbau', label: 'Satzbau' },
  { category: 'praepositionen', label: 'Präpositionen' },
  { category: 'negation', label: 'Negation' },
  { category: 'adverbien', label: 'Adverbien' },
  { category: 'verben-kasus', label: 'Verben mit Kasus' },
  { category: 'zahlen', label: 'Zahlen' },
  { category: 'adjektive', label: 'Adjektive' },
];

export function topicsByCategory(): CategoryGroup[] {
  return CATEGORY_ORDER.map(({ category, label }) => ({
    category,
    label,
    topics: grammarTopics.filter((t) => t.category === category),
  }));
}

export function grammarTopicById(id: string): GrammarTopic | undefined {
  return grammarTopics.find((t) => t.id === id);
}
