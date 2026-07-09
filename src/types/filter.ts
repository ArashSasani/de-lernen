import { FILTER, POS } from '@/constants';
import type { Box, Level, Pos } from '@/types';

export type BoxFilter = (typeof FILTER)[keyof typeof FILTER] | Box;
export type PosFilter =
  | typeof FILTER.ALL
  | Extract<Pos, (typeof POS)[keyof typeof POS]>;
export type LevelFilter = typeof FILTER.ALL | Level;

export interface Filter {
  box: BoxFilter;
  pos: PosFilter;
  level: LevelFilter;
}
