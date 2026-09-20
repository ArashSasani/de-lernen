import type { ReactNode } from 'react';

export interface AccordionItem {
  /** Stable key, and what `openIds`/`onToggle` refer to. */
  id: string;
  /** Rendered inside the toggle button, left of the chevron. */
  label: ReactNode;
  content: ReactNode;
}
