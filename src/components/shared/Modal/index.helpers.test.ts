/**
 * @jest-environment jsdom
 */
import { focusableElements } from './index.helpers';

describe('focusableElements', () => {
  it('finds links, buttons, and inputs', () => {
    document.body.innerHTML = `
      <div id="root">
        <a href="/x">link</a>
        <button>btn</button>
        <button disabled>disabled btn</button>
        <input />
        <input disabled />
        <div tabindex="0">focusable div</div>
        <div tabindex="-1">not focusable div</div>
        <span>not focusable</span>
      </div>
    `;
    const root = document.getElementById('root')!;
    const found = focusableElements(root);
    expect(found).toHaveLength(4);
    expect(found.map((el) => el.tagName)).toEqual([
      'A',
      'BUTTON',
      'INPUT',
      'DIV',
    ]);
  });

  it('returns an empty array when nothing is focusable', () => {
    document.body.innerHTML = '<div id="root"><span>text</span></div>';
    const root = document.getElementById('root')!;
    expect(focusableElements(root)).toEqual([]);
  });
});
