'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bars3Icon,
  XMarkIcon,
  BookOpenIcon,
  PencilIcon,
  AcademicCapIcon,
  TableCellsIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { clearToken } from '@/lib/sync';
import { NAV_ITEMS, isActivePath } from './index.helpers';

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const close = () => setOpen(false);

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
    close();
  };

  return (
    <>
      {/* Desktop nav — only at lg+: narrower pages (study/dictation/read/settings)
          keep their content in a max-w-xl column, so this row has to fit
          alongside a page title within that same ~672px, not the full viewport.
          Settings renders icon-only here (its label is the longest of the set)
          to leave room; every other item keeps its label. */}
      <div className="hidden items-center gap-2.5 lg:flex">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon =
            item.href === '/study'
              ? AcademicCapIcon
              : item.href === '/read'
                ? BookOpenIcon
                : item.href === '/grammar'
                  ? TableCellsIcon
                  : item.href === '/settings'
                    ? Cog6ToothIcon
                    : PencilIcon;
          const iconOnly = item.href === '/settings';
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={iconOnly ? item.label : undefined}
              title={iconOnly ? item.label : undefined}
              className={`flex shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors ${
                active ? '' : 'text-primary hover:text-primary/80'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {!iconOnly && item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="text-base-content/60 hover:text-base-content/80 shrink-0 text-xs whitespace-nowrap"
        >
          Log out
        </button>
      </div>

      {/* Mobile/tablet nav — hamburger + slide-in drawer, up to lg */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="btn btn-circle btn-text btn-sm !text-base-content/70 lg:hidden"
      >
        <Bars3Icon className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          aria-hidden="true"
          onClick={close}
        />
      )}

      <div
        className={`bg-base-100 border-base-300 fixed top-0 right-0 z-50 flex h-full w-64 flex-col border-l transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="border-base-300 flex items-center justify-between border-b px-5 py-5">
          <span className="text-base-content/60 text-xs font-medium tracking-wide uppercase">
            de·lernen
          </span>
          <button
            onClick={close}
            aria-label="Close menu"
            className="btn btn-circle btn-text btn-sm !text-base-content/70"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon =
              item.href === '/study'
                ? AcademicCapIcon
                : item.href === '/read'
                  ? BookOpenIcon
                  : item.href === '/grammar'
                    ? TableCellsIcon
                    : item.href === '/settings'
                      ? Cog6ToothIcon
                      : PencilIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-base-content/60 hover:bg-base-content/5 hover:text-base-content'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-base-300 border-t px-3 py-4">
          <button
            onClick={handleLogout}
            className="text-base-content/60 hover:bg-base-content/5 hover:text-base-content block w-full rounded-lg px-4 py-3 text-left text-sm transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
