import { speakButtonClass } from './index.helpers';

describe('speakButtonClass', () => {
  it('returns pulse + indigo when speaking', () => {
    expect(speakButtonClass(true)).toContain('animate-pulse');
    expect(speakButtonClass(true)).toContain('text-indigo-400');
  });

  it('returns slate hover class when not speaking', () => {
    expect(speakButtonClass(false)).toContain('text-slate-400');
    expect(speakButtonClass(false)).toContain('hover:text-slate-200');
  });
});
