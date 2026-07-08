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
      {/* Desktop nav */}
      <div className="hidden items-center gap-4 md:flex">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon =
            item.href === '/study'
              ? AcademicCapIcon
              : item.href === '/read'
                ? BookOpenIcon
                : item.href === '/grammar'
                  ? TableCellsIcon
                  : PencilIcon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 text-xs transition-colors ${
                active
                  ? 'text-slate-200'
                  : 'text-indigo-400 hover:text-indigo-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Log out
        </button>
      </div>

      {/* Mobile nav — hamburger + slide-in drawer */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="p-1 text-slate-400 hover:text-slate-200 md:hidden"
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
        className={`fixed top-0 right-0 z-50 flex h-full w-64 flex-col border-l border-white/10 bg-slate-900 transition-transform duration-200 ease-in-out ${
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
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            de·lernen
          </span>
          <button
            onClick={close}
            aria-label="Close menu"
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon =
              item.href === '/study'
                ? AcademicCapIcon
                : item.href === '/read'
                  ? BookOpenIcon
                  : item.href === '/grammar'
                    ? TableCellsIcon
                    : PencilIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-indigo-500/10 font-medium text-indigo-400'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <button
            onClick={handleLogout}
            className="block w-full rounded-lg px-4 py-3 text-left text-sm text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
