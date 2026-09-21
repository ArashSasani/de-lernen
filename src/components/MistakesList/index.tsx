'use client';

import { useState } from 'react';
import type { MistakeCorpus } from '@/types/mistakes';
import Accordion from '@/components/shared/Accordion';
import { relativeTime, sortByRecency, SOURCE_LABELS } from './index.helpers';

// Read-only: no delete, since records are immutable/union-by-id and
// pruning would need tombstones — deliberately deferred, not half-built.
export default function MistakesList({
  mistakes,
}: {
  mistakes: MistakeCorpus;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const sorted = sortByRecency(mistakes);

  return (
    <Accordion
      openIds={openIds}
      onToggle={(id) =>
        setOpenIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
      }
      items={[
        {
          id: 'mistakes',
          label: (
            <span className="text-sm font-medium">
              Learning memory ({mistakes.length})
            </span>
          ),
          content:
            sorted.length === 0 ? (
              <p className="text-base-content/60 px-5 pb-4 text-xs">
                Nothing recorded yet — notes appear here as practice mistakes
                are recorded.
              </p>
            ) : (
              <ul className="border-base-300 divide-base-300 flex flex-col divide-y border-t px-5 pb-1">
                {sorted.map((record) => (
                  <li key={record.id} className="py-3 text-xs">
                    <p className="text-base-content/90">{record.text}</p>
                    <p className="text-base-content/50 mt-1">
                      {SOURCE_LABELS[record.source]} ·{' '}
                      {relativeTime(record.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ),
        },
      ]}
    />
  );
}
