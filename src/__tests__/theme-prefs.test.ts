/**
 * @jest-environment jsdom
 */
import { getTheme, setTheme } from '@/lib/theme-prefs';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('getTheme / setTheme', () => {
  it('defaults to dark', () => {
    expect(getTheme()).toBe('delernen-dark');
  });

  it('round-trips the light theme and sets it on <html>', () => {
    setTheme('delernen-light');
    expect(getTheme()).toBe('delernen-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'delernen-light',
    );
  });

  it('falls back to dark on a corrupted value', () => {
    localStorage.setItem('theme', 'not-a-theme');
    expect(getTheme()).toBe('delernen-dark');
  });
});
