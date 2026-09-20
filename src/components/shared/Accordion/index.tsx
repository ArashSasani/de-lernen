'use client';

import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { AccordionItem } from '@/types/accordion';

/**
 * Collapsible category list, styled with FlyonUI's accordion classes but with
 * React owning which items are open.
 *
 * FlyonUI ships a JS accordion plugin, and we deliberately don't use it: it
 * keeps open/close state in the DOM (an `active` class it adds itself), so
 * every React-side need — deep-linking a category, expanding everything while
 * a search is active, resetting on navigation — turns into imperative
 * `autoInit()`/`HSAccordion.show()` calls that fight the render cycle. Only
 * `.accordion-toggle` and `.accordion-bordered` carry any CSS of their own
 * (`.accordion-content` is a pure JS hook with no styles), and the
 * `accordion-item-active:` variant just keys off `.accordion-item.active` —
 * all of which work exactly the same when we set `active` ourselves.
 *
 * The open/close height animation is the one thing the plugin did that CSS
 * alone can't do with `height: auto`; a `0fr → 1fr` grid row gets the same
 * effect with no measurement and no JS.
 */
export default function Accordion({
  items,
  openIds,
  onToggle,
  className = '',
  toggleClassName = '',
}: {
  items: AccordionItem[];
  openIds: readonly string[];
  onToggle: (id: string) => void;
  className?: string;
  toggleClassName?: string;
}) {
  return (
    <div className={`accordion accordion-bordered flex flex-col ${className}`}>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        const toggleId = `accordion-toggle-${item.id}`;
        const contentId = `accordion-content-${item.id}`;
        return (
          <div
            key={item.id}
            className={`accordion-item ${open ? 'active' : ''}`}
          >
            <button
              id={toggleId}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-controls={contentId}
              aria-expanded={open}
              className={`accordion-toggle flex items-center justify-between gap-2 transition-colors ${toggleClassName}`}
            >
              {item.label}
              <ChevronDownIcon
                className="accordion-item-active:rotate-180 text-base-content/60 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-in-out"
                aria-hidden="true"
              />
            </button>
            {/* Collapsed content stays mounted so it can animate, so it also
                needs `inert` to stay out of the tab order and the a11y tree —
                these panels are full of links and buttons. */}
            <div
              id={contentId}
              role="region"
              aria-labelledby={toggleId}
              inert={!open}
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
