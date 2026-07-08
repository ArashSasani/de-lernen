import { choiceStyle } from './index.helpers';

describe('choiceStyle', () => {
  it('returns neutral style when not yet answered', () => {
    const style = choiceStyle(false, 0, null, 2);
    expect(style).toContain('slate-300');
    expect(style).toContain('hover:bg-white');
  });

  it('highlights the correct choice in green after answering', () => {
    expect(choiceStyle(true, 2, 1, 2)).toContain('emerald');
  });

  it('highlights the wrong selection in red', () => {
    expect(choiceStyle(true, 1, 1, 2)).toContain('rose');
  });

  it('dims unselected wrong choices', () => {
    expect(choiceStyle(true, 0, 1, 2)).toContain('slate-500');
  });

  it('when selected === correct, only the correct (green) style applies', () => {
    const style = choiceStyle(true, 2, 2, 2);
    expect(style).toContain('emerald');
    expect(style).not.toContain('rose');
  });
});
