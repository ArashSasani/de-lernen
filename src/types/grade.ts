import { GRADE } from '@/constants';

export type Grade = (typeof GRADE)[keyof typeof GRADE];
