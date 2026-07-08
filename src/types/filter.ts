import { FILTER, POS } from '@/constants';
import type { Box, Pos } from '@/types';

export type BoxFilter = (typeof FILTER)[keyof typeof FILTER] | Box;
export type PosFilter =
  | typeof FILTER.ALL
  | Extract<Pos, (typeof POS)[keyof typeof POS]>;

export interface Filter {
  box: BoxFilter;
  pos: PosFilter;
}
