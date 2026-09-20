import { chipClass } from './index.helpers';

describe('chipClass', () => {
  it('applies the primary badge style when active', () => {
    expect(chipClass(true, false)).toContain('badge-primary');
  });

  it('applies the muted style when inactive', () => {
    const cls = chipClass(false, false);
    expect(cls).not.toContain('badge-primary');
    expect(cls).toContain('badge-secondary');
  });

  it('applies the disabled style when disabled', () => {
    expect(chipClass(false, true)).toContain('cursor-not-allowed');
  });
});
