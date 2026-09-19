import type { Level } from '@/types';

export interface LevelOption {
  value: Level;
  label: string;
}

// Hardcoded to a1/a2, not all of LEVELS — b1 vocabulary hasn't been migrated
// into the data pipeline yet, so there's nothing for a b1 learner ceiling to
// scope. Add 'b1' back here once b1 words exist.
export const LEARNER_LEVEL_OPTIONS: LevelOption[] = (['a1', 'a2'] as const).map(
  (level) => ({
    value: level,
    label: level.toUpperCase(),
  }),
);
