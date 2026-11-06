/* Taking the picture: the visible part of the screen as a still image, and where each named part (data-part) was.
   The picture library loads only when a markup starts, so the app's own bundle doesn't grow. Nothing is hidden: the
   picture is what's on screen, and the sender sees exactly what will be sent before they send it.

   The picture is drawn from a copy of the page, which keeps each element's measured size. It must use the fonts the
   page uses, or text reflows inside those sizes and lines run into each other. The app's font (Inter) comes from
   another site's stylesheet that the picture library can't read, so the font faces the page has loaded are put into
   the copy here, as data. */
import type { PartBox, Rect } from './model';

export interface Capture { image: HTMLCanvasElement; width: number; height: number; scale: number; parts: PartBox[] }

/** What a markup never includes: its own layer, messages and open sheets (the Send feedback sheet it was started from). */
const SKIP = '.markup-root, .toasts, .sheet-wrap, [data-markup-skip]';

/** The named parts on screen now, each with its path of names (outermost first) and its box. */
export function screenParts(root: ParentNode = document): PartBox[] {
  const out: PartBox[] = [];
  const W = window.innerWidth, H = window.innerHeight;
  for (const el of root.querySelectorAll<HTMLElement>('[data-part]')) {
    if (el.closest(SKIP)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.right <= 0 || r.top >= H || r.left >= W) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    const path: string[] = [];
    for (let x: HTMLElement | null = el; x; x = x.parentElement?.closest<HTMLElement>('[data-part]') ?? null) path.unshift(x.dataset.part!);
    const rect: Rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    out.push({ path, rect });
  }
  return out;
}

/** A unicode-range in one spelling, so "U+0-FF" and "U+0000-00FF" match. */
export function normalRange(range: string): string {
  return (range || 'U+0-10FFFF').toUpperCase().split(',').map((r) => {
    const [a, b] = r.trim().replace(/^U\+/, '').split('-');
    const lo = parseInt(a ?? '0', 16), hi = parseInt(b ?? a ?? '0', 16);
    return `${lo}-${hi}`;
  }).join(',');
}

/** The @font-face rules in some CSS: family, weight, style, unicode-range and the first url() of each. */
export function fontFaces(css: string): { family: string; weight: string; style: string; range: string; url: string; rule: string }[] {
  const out = [];
  for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const body = m[1]!;
    const get = (k: string) => new RegExp(`${k}\\s*:\\s*([^;]+)`, 'i').exec(body)?.[1]?.trim() ?? '';
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(get('src'))?.[1] ?? '';
    if (!url) continue;
    out.push({ family: get('font-family').replace(/^['"]|['"]$/g, ''), weight: get('font-weight') || '400', style: get('font-style') || 'normal', range: normalRange(get('unicode-range')), url, rule: m[0] });
  }
  return out;
}

const asDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

let fontCssOnce: Promise<string> | null = null;
/**
 * The font faces the page has loaded, as @font-face rules with the font files inlined: what the picture's copy of the
 * page uses. Read from every stylesheet: those the page can read directly, and others (Google Fonts) fetched again,
 * which they allow. Only faces actually in use are inlined (Inter's Latin, four weights), not every subset.
 */
export function pageFontCss(): Promise<string> {
  return (fontCssOnce ??= (async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/^['"]|['"]$/g, '')}|${f.weight}|${f.style}|${normalRange(f.unicodeRange)}`);
    const rules: { face: ReturnType<typeof fontFaces>[number]; base: string }[] = [];
    for (const sheet of [...document.styleSheets]) {
      const base = sheet.href ?? location.href;
      let css = '';
      try { css = [...sheet.cssRules].filter((r) => r instanceof CSSFontFaceRule).map((r) => r.cssText).join('\n'); } catch {
        if (sheet.href) css = await fetch(sheet.href).then((r) => (r.ok ? r.text() : ''), () => '');
      }
      for (const face of fontFaces(css)) if (loaded.includes(`${face.family}|${face.weight}|${face.style}|${face.range}`)) rules.push({ face, base });
    }
    const inlined = await Promise.all(rules.map(async ({ face, base }) => {
      try {
        const res = await fetch(new URL(face.url, base).href);
        if (!res.ok) return '';
        return face.rule.replace(/src\s*:[^;]+;?/i, `src: url(${await asDataUrl(await res.blob())});`);
      } catch { return ''; }
    }));
    return inlined.filter(Boolean).join('\n');
  })());
}

/** The visible screen, at up to twice its CSS size (a phone's picture stays sharp without growing huge), in the page's own fonts. */
export async function captureScreen(): Promise<Capture> {
  const width = window.innerWidth, height = window.innerHeight;
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const parts = screenParts();
  const [{ domToCanvas }, cssText] = await Promise.all([import('modern-screenshot'), pageFontCss().catch(() => '')]);
  const body = document.body;
  const bg = getComputedStyle(body).backgroundColor;
  const image = await domToCanvas(body, {
    width, height, scale,
    backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : getComputedStyle(document.documentElement).backgroundColor || '#ffffff',
    // The page as scrolled: the window's scroll as a shift of the page, and each scrolled panel as it is.
    style: { margin: '0', marginTop: `${-window.scrollY}px`, marginLeft: `${-window.scrollX}px`, height: `${body.scrollHeight}px` },
    features: { restoreScrollPosition: true },
    filter: (n) => !(n instanceof Element && n.matches(SKIP)),
    // The page's fonts, inlined (an empty string would mean "no fonts at all", so leave the library to its own then).
    ...(cssText ? { font: { cssText } } : {}),
    timeout: 8000,
  });
  return { image, width, height, scale, parts };
}
