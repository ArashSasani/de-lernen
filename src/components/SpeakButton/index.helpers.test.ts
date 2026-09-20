import { speakButtonClass } from './index.helpers';

describe('speakButtonClass', () => {
  it('returns pulse + primary accent when speaking', () => {
    expect(speakButtonClass(true)).toContain('animate-pulse');
    expect(speakButtonClass(true)).toContain('text-primary');
  });

  it('returns muted hover class when not speaking', () => {
    expect(speakButtonClass(false)).toContain('base-content/60');
    expect(speakButtonClass(false)).toContain('hover:');
    expect(speakButtonClass(false)).toContain('base-content');
  });
});
