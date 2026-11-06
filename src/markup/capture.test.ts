/* The picture uses the page's own fonts: the @font-face rules of a stylesheet (Google Fonts' spelling) are matched to
   the faces the page has loaded, whatever way each spells its unicode-range. */
import { fontFaces, normalRange } from './capture';

const GOOGLE = `/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v20/latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+1E00-1EFF;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v20/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}`;

describe('the page’s fonts, for the picture', () => {
  it('spells a unicode-range one way, so the stylesheet’s and the loaded face’s match', () => {
    expect(normalRange('U+0000-00FF, U+0131, U+0152-0153')).toBe(normalRange('U+0-FF, U+131, U+152-153'));
    expect(normalRange('')).toBe('0-1114111');
  });
  it('reads each @font-face rule: family, weight, style, range and the font file', () => {
    const faces = fontFaces(GOOGLE);
    expect(faces.map((f) => [f.family, f.weight, f.style, f.url])).toEqual([
      ['Inter', '400', 'normal', 'https://fonts.gstatic.com/s/inter/v20/latin-ext.woff2'],
      ['Inter', '600', 'normal', 'https://fonts.gstatic.com/s/inter/v20/latin.woff2'],
    ]);
    expect(faces[1]!.range).toBe(normalRange('U+0-FF, U+131, U+152-153'));
    expect(faces[1]!.rule).toMatch(/^@font-face \{[\s\S]*\}$/);
  });
});
