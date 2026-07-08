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
          <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-white/5">
            <div
              className="w-full rounded-md bg-indigo-500/70 transition-[height] duration-300"
              style={{ height: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-300">{n}</span>
          <span className="text-center text-[10px] text-slate-500">
            Box {box}
          </span>
          <span className="text-center text-[9px] leading-tight text-slate-600">
            {BOX_LABELS[box]}
          </span>
        </div>
      ))}
    </div>
  );
}
