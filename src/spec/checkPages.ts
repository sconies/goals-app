/* The fit-and-finish (F) and review-note (N) checks in words (drill 11: F6, F7, F8, F17, N5 and the rest had no steps
   in the kit, only a link to Faro's eval file). Each check is a script that opens pages and collects failures; its page
   here is read from that script: what its header comment says it checks, the pages it opens (width, height, as whom,
   where), and each failure it can report, in its own words and in the order the script reports them, under the
   section comment it sits in. A failure's `${…}` is what the script measured, written as {…}. Pure: the caller reads
   the files. */
import { read, type Repo } from './sources';

export interface CheckDoc {
  id: string;
  file: string;
  title: string;
  about: string;
  opens: string[];
  fails: { section: string | null; text: string }[];
}

/** The end of the call that opens at `i` (the index of its `(`), counting brackets and skipping strings. */
function closing(src: string, i: number): number {
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k]!;
    if (c === '\'' || c === '"' || c === '`') {
      for (k++; k < src.length && src[k] !== c; k++) {
        if (src[k] === '\\') k++;
        else if (c === '`' && src[k] === '$' && src[k + 1] === '{') { const e = closing(src, k + 1); k = e; }
      }
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') { depth--; if (depth === 0) return k; }
  }
  return src.length;
}

/** The arguments of a call, split at its top-level commas. */
function args(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let k = 0; k < inner.length; k++) {
    const c = inner[k]!;
    if (c === '\'' || c === '"' || c === '`') { const q = c; for (k++; k < inner.length && inner[k] !== q; k++) { if (inner[k] === '\\') k++; else if (q === '`' && inner[k] === '$' && inner[k + 1] === '{') k = closing(inner, k + 1); } continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(inner.slice(start, k).trim()); start = k + 1; }
  }
  out.push(inner.slice(start).trim());
  return out.filter(Boolean);
}

/** A string literal's words, its `${…}` written as {…}; null when the argument isn't one literal. */
function words(lit: string): string | null {
  const m = /^(['"`])([\s\S]*)\1$/.exec(lit.trim());
  if (!m) return null;
  let s = m[2]!;
  if (m[1] === '`') {
    let out = '';
    for (let k = 0; k < s.length; k++) {
      if (s[k] === '$' && s[k + 1] === '{') { const e = closing(s, k + 1); out += `{${s.slice(k + 2, e).trim()}}`; k = e; } else out += s[k];
    }
    s = out;
  }
  return s.replace(/\\(['"`])/g, '$1').replace(/\s+/g, ' ').trim();
}

/** The call's opening bracket before `at` (scanning back from a `)` at `at`), or -1. Strings are not skipped. */
function opening(src: string, at: number): number {
  let depth = 0;
  for (let k = at; k >= 0; k--) {
    const c = src[k]!;
    if (c === ')' || c === '}' || c === ']') depth++;
    else if (c === '(' || c === '{' || c === '[') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

/** A literal's value (a number, a string, true or false, or an array of them); undefined when it is anything else. */
function literal(x: string): unknown {
  const t = x.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true' || t === 'false') return t === 'true';
  if (/^(['"`])[^'"`$]*\1$/.test(t)) return t.slice(1, -1);
  if (t.startsWith('[') && closing(t, 0) === t.length - 1) {
    const xs = args(t.slice(1, -1)).map(literal);
    return xs.every((v) => v !== undefined) ? xs : undefined;
  }
  return undefined;
}

/** The loops around `at` that bind names to the items of a literal list: `for (const w of [390, 1440])`. */
function loopsAround(src: string, at: number, consts: Map<string, unknown>): { names: string[]; items: unknown[] }[] {
  const out: { names: string[]; items: unknown[] }[] = [];
  for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let)\s+(\[[^\]]*\]|\w+)\s+of\s+/g)) {
    if (m.index! > at) break;
    const head = closing(src, src.indexOf('(', m.index!));
    let bodyEnd = src.indexOf(';', head);
    const brace = /^\s*\{/.exec(src.slice(head + 1));
    if (brace) bodyEnd = closing(src, head + 1 + brace[0].length - 1);
    if (at < head || at > bodyEnd) continue;
    const list = src.slice(m.index! + m[0].length, head).trim();
    const items = consts.has(list) ? consts.get(list) : literal(list);
    if (!Array.isArray(items)) continue;
    const names = m[1]!.startsWith('[') ? args(m[1]!.slice(1, -1)) : [m[1]!];
    out.push({ names, items });
  }
  return out;
}

/** Every way the names in a call can be bound by the loops around it, as name to value. */
function bindings(loops: { names: string[]; items: unknown[] }[]): Map<string, unknown>[] {
  let out: Map<string, unknown>[] = [new Map()];
  for (const l of loops) {
    out = out.flatMap((b) => l.items.map((item) => {
      const next = new Map(b);
      l.names.forEach((n, i) => next.set(n, l.names.length > 1 && Array.isArray(item) ? item[i] : item));
      return next;
    }));
  }
  return out;
}

/** The helpers a script reports through (`const check = (ok, msg) => { if (!ok) fails.push(msg); }`): which argument is
    the failure, and which (if any) the condition that must hold. */
function reporters(src: string): Map<string, { msg: number; ok: number | null }> {
  const out = new Map<string, { msg: number; ok: number | null }>();
  for (const m of src.matchAll(/const (\w+) = \(([^)]*)\) => \{?\s*(?:if \(!(\w+)\) )?fails\.push\((\w+)\)/g)) {
    const params = m[2]!.split(',').map((x) => x.trim());
    const msg = params.indexOf(m[4]!);
    if (msg >= 0) out.set(m[1]!, { msg, ok: m[3] ? params.indexOf(m[3]) : null });
  }
  return out;
}

/** The limits a failure's condition holds to that its words don't already say: `foot.f.h > 64`, `near(d.w, 240)`. */
function limits(cond: string, text: string): string[] {
  const said = new Set(text.replace(/\{[^}]*\}/g, '').match(/\d+(\.\d+)?/g) ?? []);
  const operand = String.raw`[\w.$]+(?:\([^()]*\))?(?:\[[^\]]*\])?`;
  const found = cond.match(new RegExp(String.raw`${operand}(?:\s*[-+*/]\s*${operand})*\s*(?:[<>]=?|[!=]==?)\s*-?\d+(?:\.\d+)?\b|!?\bnear\([^()]*,\s*\d+(?:\.\d+)?\)`, 'g')) ?? [];
  return [...new Set(found.map((x) => x.replace(/\s+/g, ' ').trim()))].filter((x) => !said.has(x.match(/(\d+(?:\.\d+)?)\)?$/)?.[1] ?? ''));
}

/** A simple comparison of a bound number (`w < 800`), worked out; undefined when it is anything else. */
function compare(x: string, b: Map<string, unknown>): boolean | undefined {
  const m = /^(\w+)\s*(<=?|>=?)\s*(\d+)$/.exec(x.trim());
  const v = m ? b.get(m[1]!) : undefined;
  if (!m || typeof v !== 'number') return undefined;
  const n = Number(m[3]);
  return m[2] === '<' ? v < n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : v >= n;
}

/** One check's page facts, read from its script. */
export function checkDoc(r: Repo, id: string, file: string, title: string): CheckDoc {
  const src = read(r, file);
  const head = /^\/\*([\s\S]*?)\*\//.exec(src)?.[1] ?? '';
  const about = head.replace(/^\s*[FN]\d+:\s*/, '').replace(/run\(\{[^)]*\}\) returns a list of failures\.?/, '').replace(/\s+/g, ' ').trim();
  const opens = new Set<string>();
  // A value kept in a constant (const MAP = '/goals?view=map') is written as the value; a name a loop binds
  // (for (const [w, h] of [[390, 844], [1440, 900]])) as each value it takes, so every place the loop opens is listed.
  const consts = new Map<string, unknown>([...src.matchAll(/^const ([A-Za-z_]\w*) = ([^;\n]+);/gm)].flatMap((m) => { const v = literal(m[2]!); return v === undefined ? [] : [[m[1]!, v] as [string, unknown]]; }));
  const value = (x: string, b: Map<string, unknown>): unknown => {
    const t = x.trim();
    if (b.has(t)) return b.get(t);
    if (consts.has(t)) return consts.get(t);
    // An address written with its parts (`/goals/${id}`): each part a loop or a constant gives, else {part}.
    if (t.startsWith('`')) return words(t)?.replace(/\{(\w+)\}/g, (all, n: string) => (b.has(n) ? String(b.get(n)) : consts.has(n) ? String(consts.get(n)) : all));
    return literal(t);
  };
  const shown = (v: unknown, x: string) => (v === undefined ? `{${x.trim()}}` : String(v));
  // The harness's open(width, height, who, address, touch), or the script's own open, its arguments read by their names.
  const own = /(?:function open|const open = async)\s*\(([^)]*)\)/.exec(src)?.[1]?.split(',').map((x) => x.replace(/=.*/, '').trim());
  const slot = (names: string[], usual: number) => (own ? own.findIndex((x) => names.includes(x)) : usual);
  const at = { w: slot(['w', 'width'], 0), h: slot(['h', 'height'], 1), who: slot(['who'], 2), where: slot(['path', 'route', 'where', 'address'], 3), touch: slot(['touch'], 4) };
  for (const m of src.matchAll(/(?<![\w.])open\(/g)) {
    if (/function\s+$/.test(src.slice(Math.max(0, m.index! - 12), m.index!))) continue;
    const open = m.index! + m[0].length - 1;
    const a = args(src.slice(open + 1, closing(src, open)));
    if (a.length < (own ? 3 : 4)) continue;
    for (const b of bindings(loopsAround(src, m.index!, consts))) {
      const v = (i: number) => (i >= 0 && a[i] ? value(a[i]!, b) : undefined);
      const touch = at.touch >= 0 && a[at.touch] ? v(at.touch) ?? compare(a[at.touch]!, b) : undefined;
      const where = at.where >= 0 && a[at.where] ? `, at \`${shown(v(at.where), a[at.where]!)}\`` : '';
      opens.add(`${shown(v(at.w), a[at.w] ?? 'w')} × ${shown(v(at.h), a[at.h] ?? 'h')}, as ${shown(v(at.who), a[at.who] ?? 'who')}${where}${touch === true ? ', on a touch screen' : touch === undefined && at.touch >= 0 && a[at.touch] ? `, on a touch screen when \`${a[at.touch]}\`` : ''}`);
    }
  }
  // A page opened through the script's own helper, its settings named (N9: at(browser, url, { w, h, who: 'amara', route })).
  for (const m of src.matchAll(/(?<![\w.])(\w+)\([^()]*?\{(?=[^{}]*\bwho\b)(?=[^{}]*\broute\b)/g)) {
    if (/function\s+$/.test(src.slice(Math.max(0, m.index! - 12), m.index!))) continue;
    const brace = m.index! + m[0].length - 1;
    const props = new Map(args(src.slice(brace + 1, closing(src, brace))).map((x) => { const i = x.indexOf(':'); return i < 0 ? [x.trim(), x.trim()] : [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
    if (!props.has('w') || !props.has('route')) continue;
    for (const b of bindings(loopsAround(src, m.index!, consts))) {
      const v = (k: string) => (props.has(k) ? value(props.get(k)!, b) : undefined);
      opens.add(`${shown(v('w'), props.get('w')!)} × ${shown(v('h'), props.get('h') ?? 'h')}, as ${shown(v('who'), props.get('who')!)}, at \`${shown(v('route'), props.get('route')!)}\`${v('touch') === true ? ', on a touch screen' : ''}${props.has('ws') && v('ws') !== 'platform-org' ? `, in the ${shown(v('ws'), props.get('ws')!)} workspace` : ''}`);
    }
  }
  // A check that opens its own browser (N12): its window, the address it loads, then the pages it moves to inside the app.
  const ctx = /newContext\(\{\s*viewport:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/.exec(src);
  if (ctx && !opens.size) {
    const loads = [...src.matchAll(/\.goto\(/g)].map((m) => words(args(src.slice(m.index! + 6, closing(src, m.index! + 5)))[0] ?? '')).filter((x): x is string => !!x).map((x) => x.replace(/^\{[^}]*\}/, ''));
    const movers = [...src.matchAll(/const (\w+) = async \(\w+[^)]*\) => \{/g)].filter((m) => src.slice(m.index!, closing(src, src.indexOf('{', m.index! + m[0].length - 1))).includes('pushState')).map((m) => m[1]!);
    const moves = movers.flatMap((n) => [...src.matchAll(new RegExp(`\\b${n}\\(`, 'g'))].map((m) => words(args(src.slice(m.index! + n.length + 1, closing(src, m.index! + n.length)))[0] ?? '')).filter((x): x is string => !!x && x.startsWith('/')));
    for (const x of loads) opens.add(`${ctx[1]} × ${ctx[2]}, at \`${x}\`${moves.length ? `, then inside the app (as a link moves) at ${[...new Set(moves)].map((y) => `\`${y}\``).join(', ')}` : ''}`);
  }
  const fails: CheckDoc['fails'] = [];
  const sections = [...src.matchAll(/\/\/\s*-{3,}\s*(.+?)\s*-{3,}/g)].map((m) => ({ at: m.index!, name: m[1]!.trim() })).filter((x) => /[a-z]/i.test(x.name));
  const sectionAt = (at: number) => [...sections].reverse().find((x) => x.at < at)?.name ?? null;
  const via = reporters(src);
  // An array of failures made in the page and handed back (P19: `const f = []; … f.push(…); return f;`, then
  // `fails.push(...out)`) reports through its own push.
  const handed = /fails\.push\(\.\.\./.test(src) ? [...src.matchAll(/const (\w+) = \[\];/g)].map((m) => m[1]!).filter((n) => n !== 'fails' && new RegExp(`return ${n};`).test(src)) : [];
  const callers = ['fails\\.push', ...handed.map((n) => `${n}\\.push`), ...via.keys()].join('|');
  for (const m of src.matchAll(new RegExp(`(?<![\\w.])(${callers})\\(`, 'g'))) {
    const open = m.index! + m[0].length - 1;
    const end = closing(src, open);
    const a = args(src.slice(open + 1, end));
    const how = via.get(m[1]!);
    const text = how ? (a[how.msg] != null ? words(a[how.msg]!) : null) : a.length ? words(a[a.length - 1]!) : null;
    if (!text) continue;
    // The condition it reports on: the helper's own, or the `if (…)` just before the push.
    let cond = '';
    if (how?.ok != null && a[how.ok]) cond = a[how.ok]!;
    else {
      const before = src.slice(0, m.index!).replace(/\s+$/, '');
      if (before.endsWith(')')) { const o = opening(before, before.length - 1); if (o > 0 && /\b(?:else\s+)?if\s*$/.test(before.slice(0, o))) cond = before.slice(o + 1, -1); }
    }
    const held = limits(cond, text);
    const full = held.length ? `${text} (its test: ${held.map((x) => `\`${x}\``).join(', ')})` : text;
    if (!fails.some((f) => f.text === full)) fails.push({ section: sectionAt(m.index!), text: full });
  }
  return { id, file, title, about, opens: [...opens], fails };
}

/** A check's page: what it checks, where, and every failure it can report. */
export function checkPage(c: CheckDoc, up: string, owner: string): string {
  const out = [
    `<!-- Generated by npm run spec from ${c.file}. Edit the code, not this file. -->`, '',
    `# ${c.id}: ${c.title}`, '',
    `A check of ${owner}: not a journey with steps a person takes, but a script that opens pages and reports what is wrong (Faro’s \`${c.file}\`). ${c.fails.length ? 'A rebuild proves the same by hand or with its own script: every failure below must not happen. Each is in the script’s words; {…} is what it measured, and a limit its words don’t give is added after it, in the script’s test (“its test: …”).' : 'A rebuild proves the same by hand or with its own script: what its header says must hold.'}`, '',
    ...(c.about ? ['## What it checks', '', c.about, ''] : []),
    '## Where it looks', '',
    ...(c.opens.length
      ? [...c.opens.map((o) => `- ${o}`), '', 'A width of 390 is a phone, 1440 (or 1280) a desktop; the address is in the demo on Thursday 5 November 2026 unless it names another day. {…} is a value the script works out as it runs.', '']
      : ['The pages it opens are worked out as it runs: its header above says where.', '']),
  ];
  if (c.fails.length) {
    out.push('## What it reports as wrong', '');
    let last: string | null | undefined;
    for (const f of c.fails) {
      if (f.section !== last) { if (f.section) out.push('', `**${f.section}**`, ''); last = f.section; }
      out.push(`- ${f.text}`);
    }
  }
  out.push('', `[How to read the journeys](${up}core/journeys.md#how-to-read-a-journeys-steps).`, '');
  return out.join('\n');
}
