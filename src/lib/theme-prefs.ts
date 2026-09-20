'use client';

import { THEME_COLOR, THEME_STORAGE_KEY } from '@/constants';

export type ThemeName = 'delernen-dark' | 'delernen-light';

// Per-device pref (localStorage), never synced to KV/IndexedDB.
export function getTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'delernen-light'
      ? 'delernen-light'
      : 'delernen-dark';
  } catch {
    return 'delernen-dark';
  }
}

export function setTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  document.documentElement.setAttribute('data-theme', theme);
  // Keep the PWA/OS chrome (iOS status bar, Android task switcher) in sync
  // with the *chosen* theme — it must not be keyed off prefers-color-scheme,
  // since the theme here is a manual pref that can disagree with the OS.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      theme === 'delernen-light' ? THEME_COLOR.light : THEME_COLOR.dark,
    );
}
