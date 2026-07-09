import type { Box, Level } from '@/types';
import type { LevelFilter, PosFilter } from '@/types/filter';
import { FILTER, POS, BOXES, LEVELS } from '@/constants';

export const POS_CHIPS: { value: PosFilter; label: string }[] = [
  { value: FILTER.ALL, label: 'All' },
  { value: POS.NOUN, label: 'Noun' },
  { value: POS.VERB, label: 'Verb' },
  { value: POS.ADJ, label: 'Adj' },
  { value: POS.ADV, label: 'Adv' },
  { value: POS.OTHER, label: 'Other' },
];

export const BOX_CHIPS: Box[] = [...BOXES];

// B1 has no extracted vocabulary yet, so its chip is hidden for now — add it
// back once a B1 source is built (see LEVELS in @/constants for the full set).
export const LEVEL_CHIPS: { value: LevelFilter; label: string }[] = [
  { value: FILTER.ALL, label: 'All' },
  ...LEVELS.filter((l): l is Exclude<Level, 'b1'> => l !== 'b1').map((l) => ({
    value: l,
    label: l.toUpperCase(),
  })),
];
