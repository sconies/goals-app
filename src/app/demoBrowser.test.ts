// @vitest-environment jsdom
/* Start over clears everything the demo keeps in the browser (demo review, 8 Nov, item 1). */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_LOCAL, DEMO_SESSION, forgetDemoBrowser, KEPT } from './demoBrowser';
import { checkInDraftKey, goalDraftKey } from './drafts';

const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const f = path.join(dir, e.name);
  return e.isDirectory() ? files(f) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [f] : [];
});

describe('what the demo keeps in the browser', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('Start over forgets drafts, seen state and walkthroughs, and keeps the viewer and appearance', () => {
    localStorage.setItem('goals-app-draft:' + checkInDraftKey('platform-org', 'g1', 45), '{"value":"7"}');
    localStorage.setItem('goals-app-draft:' + checkInDraftKey('platform-org', 'g1', 45) + ':step', 'account');
    localStorage.setItem('goals-app-draft:' + goalDraftKey('platform-org', null), '{"title":"x"}');
    localStorage.setItem('goals-whats-new-seen', 'n1');
    localStorage.setItem('goals-seen:platform-org:rhea:g1', '{}');
    localStorage.setItem('goals-map:platform-org', '{}');
    sessionStorage.setItem('goals-tour', '{"id":"checkin","step":1}');
    localStorage.setItem('goals-app-viewer:platform-org', 'rhea');
    localStorage.setItem('goals-theme', 'dark');
    forgetDemoBrowser();
    expect(Object.keys(localStorage).sort()).toEqual(['goals-app-viewer:platform-org', 'goals-theme']);
    expect(sessionStorage.length).toBe(0);
  });

  it('knows every key the app keeps: each is either cleared by Start over or kept on purpose', () => {
    const src = path.join(__dirname, '..');
    const keys = new Set<string>();
    for (const f of files(src)) {
      if (f.endsWith('demoBrowser.ts')) continue;
      const text = fs.readFileSync(f, 'utf8');
      // Only literals used as storage keys: a string passed to getItem/setItem, or a const the file names *KEY* / PREFIX.
      for (const m of text.matchAll(/(?:Item\(|KEY\s*=\s*|PREFIX\s*=\s*|KEYS\s*=\s*\{[^}]*?)['`]((?:goals|faro)-[a-z0-9-]+:?)/g)) keys.add(m[1]!);
      for (const m of text.matchAll(/(?:RAISED|TOKEN|KEPT|SKEY|NKEY)\s*=\s*'((?:goals|faro)-[a-z0-9-]+)'/g)) keys.add(m[1]!);
      for (const m of text.matchAll(/`((?:goals|faro)-[a-z0-9-]+:)\$\{/g)) keys.add(m[1]!);
    }
    expect(keys.size).toBeGreaterThan(10);
    const known = (k: string) => [...DEMO_LOCAL, ...DEMO_SESSION].some((x) => k === x || k.startsWith(x)) || KEPT.some((x) => k.startsWith(x));
    expect([...keys].filter((k) => !known(k))).toEqual([]);
  });
});
