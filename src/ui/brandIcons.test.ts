// @vitest-environment node
/* The committed icons are what the code draws (npm run icons rewrites them), and index.html links them. */
import fs from 'node:fs';
import path from 'node:path';
import { ICON_COLOURS, ICON_FILES, iconSvg, manifest } from './brandIcons';

const pub = (f: string) => path.join(__dirname, '..', '..', 'public', f);
/** A PNG's width and height, from its header. */
const pngSize = (f: string) => { const b = fs.readFileSync(pub(f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe('Faro’s icons', () => {
  it('are written from the mark (run npm run icons after changing brandIcons.ts or the paths)', () => {
    expect(fs.readFileSync(pub('favicon.svg'), 'utf8')).toBe(iconSvg('favicon'));
    expect(JSON.parse(fs.readFileSync(pub('manifest.webmanifest'), 'utf8'))).toEqual(manifest());
  });

  it('are a deep-teal tile with the F in white, bright amber and bright teal', () => {
    for (const kind of ['favicon', 'any', 'maskable', 'apple'] as const) {
      const svg = iconSvg(kind);
      for (const c of Object.values(ICON_COLOURS)) expect(svg, kind).toContain(c);
    }
  });

  it('come in every size the manifest and index.html ask for, as real PNGs', () => {
    for (const { file, size } of ICON_FILES) expect(pngSize(file), file).toEqual([size, size]);
    const m = manifest();
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`).sort()).toEqual(['192x192 any', '192x192 maskable', '512x512 any', '512x512 maskable']);
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
  });
});
