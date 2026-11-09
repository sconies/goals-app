/* Spec scenarios for the consolidation's second release: one meaning for every status word, defined once
   (src/domain/vocabulary.ts) and used by the app, the exports, Help and the AI assistant.
   ONE-VOCABULARY: every word has a code, a label, a meaning, the rule that decides it and where it may appear; the
     legend, Help's status article, the export's definitions, the AI's tool descriptions and docs/glossary.md are made
     from it; no word it retired is said anywhere; and no word it defines is written anywhere else, src/mcp included,
     except the genuine non-status uses listed below, each with its reason.
   ONE-ATTENTION-RULE: Home, Watching, the map's toggle, the Goals filter, reviews and the AI pick exactly the same goals
     for Needs attention, on every day of the example workspace that matters. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { attentionFor, attentionList, needsAttention, splitAttention } from '../src/domain/attention';
import { workbook, toJson } from '../src/domain/export';
import { glossaryMarkdown, GLOSSARY_END, GLOSSARY_START } from '../src/domain/glossaryDoc';
import { groupWatched } from '../src/domain/home';
import { currentWeek } from '../src/domain/plan';
import { applyQuery, EMPTY_QUERY, parseQuery } from '../src/domain/query';
import { agendaOf, reviewSession } from '../src/domain/review';
import { summariseAll } from '../src/domain/summary';
import { ALL_TERMS, ATTENTION, FLAG, GAP, GROUPS, LABEL, MEANING, RESULT, STATUS, TREND, withCode, type Term } from '../src/domain/vocabulary';
import { goalTrend } from '../src/domain/trend';
import { storyOf } from '../src/domain/story';
import { summaryFacts } from '../src/domain/summaryFacts';
import { standingSentence } from '../src/domain/chartStory';
import { articleById, articleText } from '../src/help/guide';
import { callTool, TOOLS, type McpContext } from '../src/mcp/tools';
import type { Snapshot } from '../src/domain/types';

const V = (text: string) => `[ONE-VOCABULARY] ${text}`;
const A = (text: string) => `[ONE-ATTENTION-RULE] ${text}`;
const T = (text: string) => `[ONE-TREND] ${text}`;
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** Every .ts and .tsx file under a folder, tests left out. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(rel));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}
/** Code without its comments: what people can read is in strings and JSX text, never in a comment. */
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What the app, the AI assistant and the server say. Not What's new (a record of what was said at the time), nor the
    example's people (their own words, in src/data). Help's guide may use the words in its prose; where it defines them it
    reads the vocabulary, checked below. */
const SAID = ['src/screens', 'src/ui', 'src/app', 'src/domain', 'src/mcp', 'src/markup', 'server'].flatMap(sources).filter((f) => !f.endsWith(path.join('domain', 'vocabulary.ts')));
const GUIDE = 'src/help/guide.ts';

/**
 * The only places a word the vocabulary defines may be written by hand: genuine uses that aren't the status, flag or
 * result the word means. Each says why. Anything else fails: read the word from src/domain/vocabulary.ts.
 */
const ALLOWED: { file: string; word: string; why: string }[] = [
  { file: 'src/domain/checkin.ts', word: 'On plan', why: 'NO_REASON: the why older check-ins stored when nothing needed explaining (“On plan.”). A stored value to recognise, never shown as the gap word.' },
  { file: 'src/domain/asks.ts', word: 'Question', why: 'The change log’s field names for an ask’s words, stored on every change since asks began; ChangeItem reads them back.' },
  { file: 'src/domain/asks.ts', word: 'Action', why: 'The change log’s field names for an ask’s words, stored on every change since asks began; ChangeItem reads them back.' },
  { file: 'src/ui/ChangeItem.tsx', word: 'Question', why: 'Reads the stored change-log field “Question” to show what was said.' },
  { file: 'src/ui/ChangeItem.tsx', word: 'Action', why: 'Reads the stored change-log field “Action” to show what was said.' },
  { file: 'src/screens/CheckInFlow.tsx', word: 'Done', why: 'The button that closes the “why better than the numbers” sheet: finished with this sheet, not a status.' },
  { file: 'src/screens/DataLayout.tsx', word: 'Done', why: 'The button that closes the column layout sheet, not a status.' },
  { file: 'src/screens/Watching.tsx', word: 'Done', why: 'The button that finishes changing what you watch, not a status.' },
  { file: 'src/ui/AiAssistants.tsx', word: 'Done', why: 'The button that closes the assistants sheet, not a status.' },
  { file: 'src/ui/ResearchBar.tsx', word: 'Done', why: 'A research session’s outcome as the tester reports it (Done, Stuck, Gave up), not a goal’s status.' },
  { file: 'src/screens/Home.tsx', word: 'Open', why: 'The verb on a button that opens a goal, not an ask’s state.' },
  { file: 'src/domain/columns.ts', word: 'Action', why: 'The one format’s Action column (what to do with a row: stop or delete a goal, mark someone as left), not an ask’s kind.' },
  { file: 'src/domain/tableLayout.ts', word: 'Action', why: 'The data tables leave the one format’s Action column out, by its header; not an ask’s kind.' },
];

/**
 * The labels the scan looks for: every one the vocabulary has, written as a label, in its own case. A word of several
 * ("No recent update") anywhere in the code's strings; a single word ("Done") as a whole string or a whole piece of JSX
 * text; a lower-case phrase ("behind plan") straight after a number or an expression, the way a gap would be built by
 * hand. Prose may still use a word in a sentence ("it’s behind plan", "counts as at risk"): that's using the word, not
 * writing the label.
 */
function labelPatterns(): { word: string; re: RegExp }[] {
  const words = [...new Set(ALL_TERMS.map(({ term }) => term.label))];
  return words.flatMap((word) => {
    if (/^[a-z]/.test(word)) return /\s/.test(word) ? [{ word, re: new RegExp(`(\\}|\\d) ${escape(word)}(?![\\w-])`, 'g') }] : [];
    return [{ word, re: /\s/.test(word) ? new RegExp(`(?<![\\w-])${escape(word)}(?![\\w-])`, 'g') : new RegExp(`(['"\`]\\s*${escape(word)}\\s*['"\`]|>\\s*${escape(word)}\\s*<)`, 'g') }];
  });
}

describe('one meaning for every status word', () => {
  it(V('every word has a code, a label, a short meaning, a one-line meaning, a longer one, the rule that decides it and where it may appear'), async () => {
    expect(ALL_TERMS.length).toBeGreaterThan(50);
    for (const { group, term } of ALL_TERMS) {
      const at = `${group}.${term.code}`;
      expect(term.code, at).toMatch(/^[a-z][a-z-]*$/);
      expect(term.label.length, at).toBeGreaterThan(1);
      expect(term.meaning.length, at).toBeGreaterThan(10);
      expect(term.long.length, at).toBeGreaterThanOrEqual(term.meaning.length - 40);
      expect(term.where.length, at).toBeGreaterThan(0);
      const [file, fn] = term.rule.split('#');
      const mod = await import(`../src/domain/${file}.ts`) as Record<string, unknown>;
      expect(typeof mod[fn!], `${at}: ${term.rule}`).toBe('function');
    }
  });

  it(V('one label, one meaning: a label two entries share is the same word for the same thing, and says so'), () => {
    const byLabel = new Map<string, string[]>();
    for (const { group, term } of ALL_TERMS) byLabel.set(term.label, [...(byLabel.get(term.label) ?? []), `${group}.${term.code}`]);
    const all = new Map(ALL_TERMS.map(({ group, term }) => [`${group}.${term.code}`, term]));
    for (const [label, ids] of byLabel) {
      if (ids.length < 2) continue;
      // Every entry but the first names the first (or one that does) as the one it shares its meaning with.
      const [first, ...rest] = ids;
      for (const id of rest) {
        let t: Term | undefined = all.get(id), hops = 0;
        while (t?.same && t.same !== first && hops++ < 4) t = all.get(t.same);
        expect(t?.same ?? all.get(id)?.same, `${label}: ${id} should say it’s the same as ${first}`).toBeDefined();
      }
    }
    // The words people were confused by say one thing each now.
    expect(byLabel.get('Overdue')).toEqual(['askStatus.overdue']);
    expect(byLabel.get('No recent update')).toEqual(['status.stale', 'flag.stale']);
    expect(RESULT.completed.label).toBe('Met');
    expect(RESULT.late.label).toBe('Met late');
    expect(RESULT.missed.label).toBe('Not met');
    expect(GROUPS.quarter.terms.missed.label).toBe(RESULT.missed.label);
    expect(FLAG.trend.label).toBe('Getting worse');
    expect(STATUS.none.label).toBe('No check-in yet');
  });

  it(V('no word the vocabulary retired is said anywhere: the app, the AI assistant, the server or Help'), () => {
    const retired = ALL_TERMS.flatMap(({ group, term }) => (term.retired ?? []).map((w) => ({ w, now: `${group}.${term.code} (“${term.label}”)` })));
    expect(retired.length).toBeGreaterThan(15);
    const found: string[] = [];
    for (const f of [...SAID, GUIDE]) {
      const text = withoutComments(read(f));
      // A retired phrase in any case; a retired single word ("Completed") in its own case, so the stored code ("completed") isn't one.
      for (const r of retired) if (new RegExp(`(?<![\\w-])${escape(r.w)}(?![\\w])`, /\s/.test(r.w) ? 'i' : '').test(text)) found.push(`${f}: “${r.w}” (say ${r.now})`);
    }
    expect(found).toEqual([]);
  });

  it(V('no word the vocabulary defines is written anywhere else, src/mcp included, apart from genuine non-status uses'), () => {
    const found: string[] = [];
    const used = new Set<string>();
    for (const f of SAID) {
      const text = withoutComments(read(f));
      for (const p of labelPatterns()) {
        if (!p.re.test(text)) { p.re.lastIndex = 0; continue; }
        p.re.lastIndex = 0;
        const ok = ALLOWED.find((a) => a.file === f && a.word === p.word);
        if (ok) { used.add(`${ok.file}|${ok.word}`); continue; }
        found.push(`${f}: “${p.word}”`);
      }
    }
    expect(found).toEqual([]);
    // Every exception is still needed, so none outlives its reason.
    expect(ALLOWED.filter((a) => !used.has(`${a.file}|${a.word}`)).map((a) => `${a.file}: ${a.word}`)).toEqual([]);
    for (const a of ALLOWED) expect(a.why.length, `${a.file}: ${a.word}`).toBeGreaterThan(15);
  });

  it(V('docs/glossary.md’s status words are generated from the vocabulary, and current (npm run glossary)'), () => {
    const md = read('docs/glossary.md');
    const at = md.indexOf(GLOSSARY_START), end = md.indexOf(GLOSSARY_END);
    expect(at, 'the generated section’s start marker').toBeGreaterThan(0);
    expect(md.slice(at, end + GLOSSARY_END.length)).toBe(glossaryMarkdown());
    // The consistency check now reads the AI assistant's words too.
    expect(md).not.toMatch(/or the AI assistant’s tool descriptions \(`src\/mcp`\)/);
  });

  it(V('Help’s status article, the export’s definitions and the AI’s tools read their words from the vocabulary'), () => {
    const status = articleText(articleById('status')!);
    for (const k of ['on', 'risk', 'off', 'stale', 'none', 'planned', 'done'] as const) expect(status, k).toContain(`${LABEL[k]}: ${STATUS[k].long}`);
    for (const k of ['completed', 'late', 'missed'] as const) expect(status, k).toContain(`${RESULT[k].label}: ${RESULT[k].long}`);
    const attention = articleText(articleById('needs-attention')!);
    expect(attention).toContain(ATTENTION.needs.long);
    for (const k of ['decision', 'no-path', 'missed-path', 'trend', 'greener', 'due'] as const) expect(attention, k).toContain(`${FLAG[k].label}: ${FLAG[k].long}`);
    // The workbook's README defines every word an export uses, in the vocabulary's words.
    const today = new Date('2026-11-05T12:00:00Z');
    const s = seed(today), cycle = s.cycles[0]!, week = currentWeek(cycle, today);
    const x = { ws: { id: 'w', name: 'Example' }, snapshot: s, cycle, week, today };
    const readme = workbook(x).find((t) => t.name === 'README')!.rows;
    for (const k of ['on', 'risk', 'off', 'stale', 'done'] as const) expect(readme.some((r) => r[1] === STATUS[k].label && r[2] === STATUS[k].long), k).toBe(true);
    for (const k of ['completed', 'late', 'missed'] as const) expect(readme.some((r) => r[1] === RESULT[k].label && r[2] === RESULT[k].long), k).toBe(true);
    // The JSON keeps the codes machines read, with the words people read beside them, and defines both.
    const j = toJson(x);
    expect(j.words.status!.off).toEqual({ label: STATUS.off.label, meaning: STATUS.off.meaning });
    expect(j.goals.every((g) => g.now.statusLabel === LABEL[g.now.status] || g.now.statusLabel === 'Stopped')).toBe(true);
    // The AI's tools say the words with their codes: "Off track (off)".
    const find = TOOLS.find((t) => t.name === 'find_goals')!;
    expect(JSON.stringify(find.inputSchema)).toContain(withCode(STATUS.off));
    const call = TOOLS.find((t) => t.name === 'post_check_in')!;
    expect(JSON.stringify(call.inputSchema)).toContain(withCode(STATUS.risk));
  });
});

/* ---------- one trend ---------- */

describe('one trend rule', () => {
  for (const today of [new Date('2026-10-30T12:00:00Z'), new Date('2026-11-05T12:00:00Z')]) {
    it(T(`the flag, the story, the summary bar and the chart say Getting worse of the same goals (${today.toISOString().slice(0, 10)})`), () => {
      const s = seed(today), cycle = s.cycles[0]!, week = currentWeek(cycle, today);
      let worse = 0;
      for (const g of s.goals) {
        const att = attentionFor(g, s, cycle, today);
        const flagged = att.flags.some((f) => f.kind === 'trend');
        const t = goalTrend(g, cycle, s.checkIns);
        expect(flagged, g.id).toBe(t.word === 'worse' && att.status.status !== 'done');
        const story = storyOf(g, s, cycle, week, today);
        expect(story.flags.includes('trend'), g.id).toBe(flagged);
        if (flagged) expect(story.warnings.some((w) => w.startsWith(FLAG.trend.label))).toBe(true);
        // The summary bar's trend says the same word, from the same rule, for the gap it shows.
        const fact = summaryFacts(g, cycle, s.checkIns, week).facts.find((f) => f.key === 'trend');
        if (fact?.direction === 'worsening') { expect(flagged, `${g.id}: the bar says worse`).toBe(true); worse++; }
        if (fact?.detail && !/^Flat at/.test(fact.detail) && fact.direction) expect(fact.detail.startsWith(TREND[fact.direction === 'worsening' ? 'worse' : fact.direction === 'recovering' ? 'better' : 'flat'].label), g.id).toBe(true);
      }
      expect(worse, 'some goal is getting worse').toBeGreaterThan(0);
    });
  }
  it(T('the chart’s words come from the same rule: further behind at each check-in is getting worse, closer each time getting better'), () => {
    const g = { kind: 'metric', unit: 'h', decimals: 0, plan: { start: 0, target: 100, shape: 'straight' } } as unknown as Parameters<typeof standingSentence>[0];
    expect(standingSentence(g, [{ week: 10, value: 18 }, { week: 11, value: 18 }, { week: 12, value: 18 }], 52)).toMatch(new RegExp(`${GAP.behind.label} and ${TREND.worse.label.toLowerCase()}`));
    expect(standingSentence(g, [{ week: 10, value: 10 }, { week: 11, value: 16 }, { week: 12, value: 22 }], 52)).toMatch(new RegExp(`${GAP.behind.label} and ${TREND.better.label.toLowerCase()}`));
  });
});

/* ---------- one Needs attention ---------- */

/** The days the example is pinned to across the evals and journeys, and two more: early in the year, and the year's end. */
const DAYS = ['2026-01-15', '2026-06-18', '2026-10-30', '2026-11-05', '2026-12-24'].map((d) => new Date(d + 'T12:00:00Z'));

function context(s: Snapshot, today: Date): McpContext {
  const cycle = s.cycles[0]!;
  return {
    ws: { id: 'platform-org', name: 'Example' }, snapshot: s, cycle, week: currentWeek(cycle, today), today,
    actor: s.people.find((p) => p.admin)!, now: today.toISOString(), newId: (p) => p + Math.random(),
    save: async () => undefined, issueToken: async () => '',
  };
}

describe('one Needs attention', () => {
  for (const today of DAYS) {
    it(A(`Home, Watching, the map, the Goals filter, reviews and the AI pick exactly the same goals (${today.toISOString().slice(0, 10)})`), async () => {
      const s = seed(today);
      const cycle = s.cycles[0]!;
      const week = currentWeek(cycle, today);
      const sorted = (ids: string[]) => [...ids].sort();
      // The rule itself, over every goal.
      const rule = sorted(s.goals.map((g) => attentionFor(g, s, cycle, today)).filter(needsAttention).map((a) => a.goal.id));
      // Home: your goals that need attention (here, as if you owned them all).
      const home = sorted(splitAttention(attentionList(s, cycle, today, { goals: s.goals })).needs.map((a) => a.goal.id));
      // Watching: the Needs attention group, watching every goal.
      const watching = sorted(groupWatched(s.goals.map((g) => attentionFor(g, s, cycle, today))).needs.map((a) => a.goal.id));
      // The Goals filter, and the map's toggle, which is that filter (attention=1).
      const sums = summariseAll(s.goals, s, cycle, today, week);
      const filter = sorted(applyQuery(sums, { ...EMPTY_QUERY, attention: true }, { goals: s.goals, cycle, week }).map((x) => x.goal.id));
      const mapLink = sorted(applyQuery(sums, parseQuery(new URLSearchParams('attention=1')), { goals: s.goals, cycle, week }).map((x) => x.goal.id));
      // Reviews: what's new on each review's agenda (to discuss, not being handled), before anything is marked reviewed.
      const reviewed = sorted([...new Set(s.reviews.flatMap((r) => agendaOf({ ...reviewSession(r, s, cycle, today, week), covered: new Set() }).discuss.filter((a) => !a.handled).map((a) => a.goal.id)))]);
      const inReviews = sorted(rule.filter((id) => s.reviews.some((r) => reviewSession(r, s, cycle, today, week).items.some((a) => a.goal.id === id))));
      // The AI assistant: find_goals with the same filter.
      const ai = await callTool('find_goals', { needs_attention: true }, context(s, today));
      const aiIds = sorted(((ai.data as { goals: { id: string }[] }).goals).map((g) => g.id));
      expect(rule.length, 'something needs attention on this day').toBeGreaterThan(0);
      expect(home).toEqual(rule);
      expect(watching).toEqual(rule);
      expect(filter).toEqual(rule);
      expect(mapLink).toEqual(rule);
      expect(reviewed).toEqual(inReviews);
      expect(aiIds).toEqual(rule);
    });
  }

  it(A('the map’s “Only what needs attention” is the Goals filter itself, not a status filter of its own'), () => {
    const screen = withoutComments(read('src/screens/GoalsScreen.tsx'));
    expect(screen).toContain('attention={query.attention}');
    expect(screen).not.toMatch(/\['off', 'risk', 'stale'\]/);
  });

  it(A('a link or saved view from before still opens the goals it meant: needs=no-recovery is No path to green'), () => {
    const q = parseQuery(new URLSearchParams('needs=no-recovery,missed-date'));
    expect(q.attention).toBe(true);
    expect(q.needs).toEqual(['no-path', 'missed-path']);
    expect(MEANING.stale).toBe(STATUS.stale.meaning);
  });
});
