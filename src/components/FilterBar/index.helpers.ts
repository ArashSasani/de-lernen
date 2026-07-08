import type { Box } from '@/types';
import type { PosFilter } from '@/types/filter';
import { FILTER, POS, BOXES } from '@/constants';

export const POS_CHIPS: { value: PosFilter; label: string }[] = [
  { value: FILTER.ALL, label: 'All' },
  { value: POS.NOUN, label: 'Noun' },
  { value: POS.VERB, label: 'Verb' },
  { value: POS.ADJ, label: 'Adj' },
  { value: POS.ADV, label: 'Adv' },
  { value: POS.OTHER, label: 'Other' },
];

export const BOX_CHIPS: Box[] = [...BOXES];
