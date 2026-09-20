'use client';

import type { Box } from '@/types';
import { BOX_LABELS } from '@/lib/leitner';
import { statBars } from './index.helpers';

export default function LeitnerStats({
  counts,
}: {
  counts: Record<Box, number>;
}) {
  const bars = statBars(counts);

  return (
    <div className="flex items-start gap-2">
      {bars.map(({ box, n, pct }) => (
        <div key={box} className="flex flex-1 flex-col items-center gap-1">
          <div className="bg-base-content/5 flex h-20 w-full items-end overflow-hidden rounded-md">
            <div
              className="bg-primary/70 w-full rounded-md transition-[height] duration-300"
              style={{ height: `${pct}%` }}
            />
          </div>
          <span className="text-base-content/80 text-xs">{n}</span>
          <span className="text-base-content/50 text-center text-[10px]">
            Box {box}
          </span>
          <span className="text-base-content/40 text-center text-[9px] leading-tight">
            {BOX_LABELS[box]}
          </span>
        </div>
      ))}
    </div>
  );
}
