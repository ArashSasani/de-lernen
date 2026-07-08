import { isActivePath, NAV_ITEMS } from './index.helpers';

describe('isActivePath', () => {
  it('returns true when pathname matches href exactly', () => {
    expect(isActivePath('/study', '/study')).toBe(true);
    expect(isActivePath('/read', '/read')).toBe(true);
    expect(isActivePath('/dictation', '/dictation')).toBe(true);
  });

  it('returns false when pathname does not match href', () => {
    expect(isActivePath('/study', '/read')).toBe(false);
    expect(isActivePath('/read', '/dictation')).toBe(false);
    expect(isActivePath('/', '/study')).toBe(false);
  });
});

describe('NAV_ITEMS', () => {
  it('contains the three main routes', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toContain('/study');
    expect(hrefs).toContain('/read');
    expect(hrefs).toContain('/dictation');
  });
});
