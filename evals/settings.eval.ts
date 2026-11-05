/* Spec scenarios for Settings (review notes, 5 Nov): light, dark or the system's choice, and an accent colour, each
   readable. The colours are read from the stylesheet that sets them, and the first-paint script from index.html, so
   these check what ships. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCENTS, THEMES } from '../src/app/appearance';

const R = (text: string) => `[SETTINGS] ${text}`;
const root = join(__dirname, '..');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8') + readFileSync(join(root, 'src/styles/notes/shell-settings.css'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** The custom properties set by the first rule whose selector is exactly `sel`. */
function vars(sel: string): Record<string, string> {
  const at = css.indexOf(sel + ' {');
  if (at < 0) throw new Error('no rule for ' + sel);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
}
const PAGE = { light: vars(':root'), dark: vars(':root[data-theme="dark"]') };

describe('Settings: how the app looks, readable whatever you choose', () => {
  it(R('three themes (system, light, dark) and three or four accents'), () => {
    expect(THEMES.map(([k]) => k)).toEqual(['system', 'light', 'dark']);
    expect(ACCENTS.length).toBeGreaterThanOrEqual(3);
    expect(ACCENTS.length).toBeLessThanOrEqual(4);
    expect(ACCENTS[0]![0]).toBe('cobalt');
  });

  for (const [accent, label] of ACCENTS) {
    for (const mode of ['light', 'dark'] as const) {
      it(R(`${label} in ${mode}: its text passes 4.5:1 on every page and panel colour, and text on its fill passes too`), () => {
        const page = PAGE[mode];
        const a = accent === 'cobalt' ? (mode === 'light' ? vars(':root') : vars(':root[data-theme="dark"]')) : vars(mode === 'light' ? `:root[data-accent="${accent}"]` : `:root[data-accent="${accent}"][data-theme="dark"]`);
        for (const bg of [page['--bg'], page['--surface'], page['--surface-2'], page['--surface-3'], a['--accent-soft'], a['--accent-wash']]) {
          expect(contrast(a['--accent-text']!, bg!), `${a['--accent-text']} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(a['--accent-fg']!, a['--accent']!)).toBeGreaterThanOrEqual(4.5);
        if (a['--primary']) expect(contrast(a['--primary-fg']!, a['--primary']!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it(R('a dark device on System gets the same accent colours as choosing Dark'), () => {
    for (const [accent] of ACCENTS.filter(([k]) => k !== 'cobalt')) {
      expect(vars(`:root[data-accent="${accent}"]:not([data-theme="light"])`)).toEqual(vars(`:root[data-accent="${accent}"][data-theme="dark"]`));
    }
  });

  it(R('the theme and accent are put on the page before it is drawn, with the same names Settings saves'), () => {
    const head = html.slice(0, html.indexOf('</head>'));
    const script = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1] ?? '';
    expect(script).toContain("localStorage.getItem('goals-theme')");
    expect(script).toContain("localStorage.getItem('goals-accent')");
    for (const [k] of ACCENTS.filter(([x]) => x !== 'cobalt')) expect(script).toContain(`'${k}'`);
    // It runs before the stylesheet and the app's code, and a blocked storage can't stop the page.
    expect(head.indexOf('<script>')).toBeLessThan(head.indexOf('<link rel="stylesheet"'));
    expect(script).toMatch(/^try\{[\s\S]*\}catch\(e\)\{\}$/);
    // The loading screen itself follows a dark choice.
    expect(head).toContain(':root[data-theme="dark"] body { background: #0E1116; }');
  });
});
