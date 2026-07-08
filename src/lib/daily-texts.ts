import dailyData from '../../data/daily-texts.json';
import type { DailyText } from '@/types';

export const dailyTexts: DailyText[] = dailyData as DailyText[];

export function dailyTextById(id: string): DailyText | undefined {
  return dailyTexts.find((t) => t.id === id);
}
