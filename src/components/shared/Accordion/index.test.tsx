/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Accordion from './index';

// The accordion reuses FlyonUI's classes but owns its own state in React and
// animates with a 0fr->1fr grid row instead of a measured height. Those two
// choices are exactly what these assert: that `active`/`aria-expanded`/the
// grid row track open state, and that collapsed content stays mounted but
// `inert`, since the panels are full of links.

afterEach(cleanup);

const items = [
  { id: 'verben', label: 'Verben', content: <a href="/x">sein</a> },
  { id: 'satzbau', label: 'Satzbau', content: <a href="/y">Wortstellung</a> },
];

function setup(openIds: string[] = []) {
  const onToggle = jest.fn();
  const view = render(
    <Accordion items={items} openIds={openIds} onToggle={onToggle} />,
  );
  return { onToggle, ...view };
}

const panelOf = (id: string) =>
  document.getElementById(`accordion-content-${id}`)!;

describe('Accordion', () => {
  it('renders a toggle per item', () => {
    setup();
    expect(screen.getByRole('button', { name: /Verben/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Satzbau/ })).toBeTruthy();
  });

  it('reports the toggled id rather than changing state itself', () => {
    const { onToggle } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Verben/ }));
    expect(onToggle).toHaveBeenCalledWith('verben');
  });

  it('marks only the open item expanded', () => {
    setup(['satzbau']);
    expect(
      screen
        .getByRole('button', { name: /Verben/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      screen
        .getByRole('button', { name: /Satzbau/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('drives the grid row that animates open and closed', () => {
    setup(['verben']);
    expect(panelOf('verben').style.gridTemplateRows).toBe('1fr');
    expect(panelOf('satzbau').style.gridTemplateRows).toBe('0fr');
  });

  it('keeps collapsed content mounted but inert, so its links leave the tab order', () => {
    setup(['verben']);
    // Mounted: it has to be, to animate.
    expect(screen.getByText('Wortstellung')).toBeTruthy();
    expect(panelOf('satzbau').hasAttribute('inert')).toBe(true);
    expect(panelOf('verben').hasAttribute('inert')).toBe(false);
  });

  it('carries the FlyonUI active class the CSS variant keys off', () => {
    const { container } = setup(['verben']);
    const [first, second] = container.querySelectorAll('.accordion-item');
    expect(first.className).toContain('active');
    expect(second.className).not.toContain('active');
  });
});
