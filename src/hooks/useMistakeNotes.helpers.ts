import { MAX_NOTES_PER_SESSION } from '@/constants';

// Pure budget decision: a session-wide cap, and one attempt per topic per
// session regardless of outcome — checked and reserved *before* any fetch
// so two fast misses on the same topic can't double-spend the budget.
export function canAuthorNote(
  attemptedTopics: ReadonlySet<string>,
  authoredCount: number,
  topicId: string,
): boolean {
  if (authoredCount >= MAX_NOTES_PER_SESSION) return false;
  if (attemptedTopics.has(topicId)) return false;
  return true;
}
