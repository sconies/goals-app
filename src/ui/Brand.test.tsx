// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { BRAND, FaroLogo, FaroMark } from './Brand';

describe('Faro’s logo and mark', () => {
  it('are named “Faro” for screen readers, or hidden when the words beside them say it', () => {
    render(<><FaroLogo /><FaroMark size={16} label={null} /></>);
    expect(screen.getAllByRole('img', { name: 'Faro' })).toHaveLength(1);
    expect(document.querySelector('.faro-mark')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draw the ink in currentColor (so it turns light in dark mode) and keep the amber and teal', () => {
    const { container } = render(<FaroLogo />);
    const fills = [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['currentColor', BRAND.amber, BRAND.teal, 'currentColor']);
  });

  it('keep the wordmark’s proportions whatever the size', () => {
    const { container } = render(<FaroLogo size={42} />);
    const svg = container.querySelector('svg')!;
    expect(Number(svg.getAttribute('width')) / Number(svg.getAttribute('height'))).toBeCloseTo(472 / 210, 1);
  });
});
