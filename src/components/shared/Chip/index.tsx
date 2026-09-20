'use client';

import { chipClass } from './index.helpers';

export default function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={chipClass(active, disabled)}
    >
      {children}
    </button>
  );
}
