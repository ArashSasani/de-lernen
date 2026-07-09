'use client';

import type { Filter } from '@/types/filter';
import { POS_CHIPS, BOX_CHIPS, LEVEL_CHIPS } from './index.helpers';
import { FILTER } from '@/constants';

export default function FilterBar({
  filter,
  dueCount,
  onChange,
}: {
  filter: Filter;
  dueCount: number;
  onChange: (next: Filter) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Box / Due */}
      <FilterGroup label="Box">
        <Chip
          active={filter.box === FILTER.DUE}
          onClick={() => onChange({ ...filter, box: FILTER.DUE })}
        >
          Due ({dueCount})
        </Chip>
        <Chip
          active={filter.box === FILTER.ALL}
          onClick={() => onChange({ ...filter, box: FILTER.ALL })}
        >
          All cards
        </Chip>
        {BOX_CHIPS.map((b) => (
          <Chip
            key={b}
            active={filter.box === b}
            onClick={() => onChange({ ...filter, box: b })}
          >
            Box {b}
          </Chip>
        ))}
      </FilterGroup>

      {/* Part of speech */}
      <FilterGroup label="Type">
        {POS_CHIPS.map((p) => (
          <Chip
            key={p.value}
            active={filter.pos === p.value}
            onClick={() => onChange({ ...filter, pos: p.value })}
          >
            {p.label}
          </Chip>
        ))}
      </FilterGroup>

      {/* Level */}
      <FilterGroup label="Level">
        {LEVEL_CHIPS.map((l) => (
          <Chip
            key={l.value}
            active={filter.level === l.value}
            onClick={() => onChange({ ...filter, level: l.value })}
          >
            {l.label}
          </Chip>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wider text-slate-500 uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 transition-colors ${
        active
          ? 'bg-indigo-500 text-white'
          : 'bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
