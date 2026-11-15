// Feedback's journeys (spec/modules/feedback/journeys/*.md), driven against this rebuild in a real browser at both widths.
// Each check throws when it fails; a failed start is a failure; the process exits 1 when any journey run fails.
// Faro's journeys read a fake database (fakeSupabase); here the builders' inbox is the app's own, read at /m/feedback/kept
// and seeded at /m/feedback/seed (only when the app is started with FARO_TEST=1), which stands in for the database.
// Usage: node modules/feedback/journeys.mjs [U41 U42 ...]   (FARO_WITHOUT and the port come from the environment)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PORT = Number(process.env.JOURNEY_PORT || 47110);
const BASE = `http://localhost:${PORT}`;
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

class CheckFailed extends Error {}
const check = (ok, words) => { if (!ok) throw new CheckFailed(words); };
const shown = async (scope, text, words) => check(await scope.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 }).then(() => true, () => false), words || `“${text}” is not shown`);
const reset = () => fetch(`${BASE}/api/reset`, { method: 'POST' });
const kept = async () => (await fetch(`${BASE}/m/feedback/kept`)).json();
const state = async () => (await fetch(`${BASE}/api/state`)).json();
const seed = (items) => fetch(`${BASE}/m/feedback/seed`, { method: 'POST', body: JSON.stringify({ items }) });
async function openMenu(p, phone, name) {
  if (!phone) return p.locator('nav.sidebar').getByRole('link', { name, exact: true }).first().click();
  const tab = p.locator('nav.tabbar > a', { hasText: name });
  if (await tab.count()) return tab.first().click();
  await p.locator('nav.tabbar details.more summary').click();
  return p.locator('nav.tabbar .more-sheet').getByRole('link', { name, exact: true }).first().click();
}
const menuWords = async (p, phone) => {
  if (!phone) return (await p.locator('nav.sidebar ul a').allInnerTexts()).map((x) => x.trim());
  await p.locator('nav.tabbar details.more summary').click();
  const out = [...(await p.locator('nav.tabbar > a').allInnerTexts()), ...(await p.locator('nav.tabbar .more-sheet a').allInnerTexts())].map((x) => x.trim());
  await p.locator('nav.tabbar details.more summary').click();
  return out;
};
const inView = async (loc) => { const b = await loc.boundingBox(); const vh = loc.page().viewportSize().height; return !!b && b.y >= 0 && b.y + b.height <= vh - 56; };
const drag = async (p, [x1, y1], [x2, y2]) => { await p.mouse.move(x1, y1); await p.mouse.down(); await p.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }); await p.mouse.move(x2, y2, { steps: 4 }); await p.mouse.up(); };
const settled = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); return p.screenshot(); };
// how much of the markup's picture differs from a real screenshot of the same screen, as a share of its pixels
async function pictureDiffers(p, live) {
  const shot = await p.locator('.markup-root .mk-shot').getAttribute('src');
  return p.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    const px = (i) => { const k = document.createElement('canvas'); k.width = x.width; k.height = x.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0, x.width, x.height); return g.getImageData(0, 0, x.width, x.height).data; };
    const A = px(x), B = px(y); let n = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 48) n++;
    return n / (A.length / 4);
  }, ['data:image/png;base64,' + live.toString('base64'), shot]);
}
// a markup of Home sent from the demo, as the person on this page (the shortcut; a box on the week's main action)
async function sendHomeMarkup(p, line) {
  await p.locator('main h1, main .hero').first().waitFor();
  await p.keyboard.press('Control+Shift+M');
  await p.locator('.markup-root').waitFor();
  await p.getByRole('button', { name: 'Box', exact: true }).click();
  const r = await p.evaluate(() => { const b = document.querySelector('main')?.getBoundingClientRect(); return [b.left + 20, b.top + 20, b.left + 200, b.top + 80]; });
  await drag(p, [r[0], r[1]], [r[2], r[3]]);
  await p.getByRole('button', { name: 'Next', exact: true }).click();
  const send = p.getByRole('dialog', { name: 'Send the markup' });
  await send.getByLabel('What should change?').fill(line);
  await send.getByRole('button', { name: 'Send', exact: true }).click();
  await shown(p.locator('main'), 'Sent. You’ll hear when it’s fixed.');
}
const toInboxList = async (inbox, phone) => { if (phone) await inbox.getByRole('button', { name: 'Back to the list' }).click(); };
const tabCount = async (inbox, name) => Number((await inbox.getByRole('tab', { name: new RegExp(`^${name}`) }).locator('.n').innerText()).trim());
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

const J = {
  // U41: mark up a screen on a phone and a desktop: draw, add a note, check the picture, say what should change, send
  async U41(p, { phone }) {
    await p.goto(`${BASE}/goals/ns-lead?as=rhea`);
    check(await p.locator('.goal-bar').isVisible(), 'the goal’s summary bar does not show');
    const live = await settled(p);
    if (phone) {
      await openMenu(p, phone, 'Feedback');
      await p.getByRole('button', { name: 'Send feedback' }).click();
      const sheet = p.getByRole('dialog', { name: 'How is the app working for you?' });
      check(await inView(sheet.getByRole('button', { name: 'Mark up the last screen' })), 'Mark up the last screen is not in view');
      await sheet.getByRole('button', { name: 'Mark up the last screen' }).click();
      await p.locator('.markup-root').waitFor();
    } else {
      await p.keyboard.press('Control+Shift+M');
      await p.locator('.markup-root').waitFor();
      await p.keyboard.press('Escape');
      check(await p.locator('.markup-root').waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false), 'Escape did not cancel the markup');
      check(await p.locator('.goal-bar').isVisible(), 'Escape did not leave the page as it was');
      await p.keyboard.press('Control+Shift+M');
      await p.locator('.markup-root').waitFor();
    }
    const differs = await pictureDiffers(p, live);
    check(differs < 0.003, `the picture differs from the screen in ${(differs * 100).toFixed(2)}% of its pixels`);
    const sheetGone = (await p.getByRole('dialog', { name: 'How is the app working for you?' }).count()) === 0;
    const before = await p.evaluate(() => [window.scrollY, document.querySelector('main')?.scrollTop ?? 0]);
    const cell = await p.evaluate(() => { const r = document.querySelector('.sc > div:last-child')?.getBoundingClientRect(); return r ? [r.left, r.top, r.right, r.bottom] : null; });
    check(cell, 'no scorecard to mark');
    await p.getByRole('button', { name: 'Box', exact: true }).click();
    await drag(p, [cell[0] - 4, cell[1] - 4], [cell[2] + 4, cell[3] + 4]);
    await p.getByRole('button', { name: 'Pen', exact: true }).click();
    const vp = p.viewportSize();
    await drag(p, [vp.width * 0.2, vp.height * 0.6], [vp.width * 0.5, vp.height * 0.62]);
    await p.mouse.wheel(0, 400);
    const after = await p.evaluate(() => [window.scrollY, document.querySelector('main')?.scrollTop ?? 0]);
    check(sheetGone && before.join() === after.join(), `the page moved under the drawing (${before} → ${after}) or the sheet is in the picture`);
    await p.getByRole('button', { name: 'Undo', exact: true }).click();
    await p.locator('.mk-surface').focus();
    await p.keyboard.press('n');
    for (let i = 0; i < 3; i++) await p.keyboard.press('Shift+ArrowDown');
    await p.keyboard.press('Enter');
    await p.getByLabel('Note 1').fill('Hard to tell which way is better');
    await p.keyboard.press('Enter');
    await shown(p.locator('.markup-root'), 'Note added', 'the note was not announced');
    await p.getByRole('button', { name: 'Next', exact: true }).click();
    const send = p.getByRole('dialog', { name: 'Send the markup' });
    check(await send.locator('.mk-preview img').isVisible(), 'the picture to be sent is not shown');
    await send.getByRole('button', { name: 'Send', exact: true }).click();
    check(await send.getByRole('alert').filter({ hasText: 'Say what should change first' }).isVisible(), 'an empty line says nothing');
    await send.getByLabel('What should change?').fill('Say whether it will hit the target in words I can scan');
    await send.getByRole('button', { name: 'It’s OK' }).click();
    const ticked = await send.getByLabel(/Include my last 20 steps on this visit/).isChecked();
    const help = await send.getByRole('link', { name: /What’s sent/ }).getAttribute('href');
    await send.getByRole('button', { name: 'Send', exact: true }).click();
    await shown(p.locator('main'), 'Sent. You’ll hear when it’s fixed.', 'no word that it was sent');
    check(await p.locator('.markup-root').count() === 0, 'the markup stayed open');
    check(await p.locator('.goal-bar').first().isVisible() && ticked && /\/help\/feedback$/.test(help || ''), `after sending: steps ticked ${ticked}, help link ${help}`);
    const k = (await kept()).markups.pop();
    const ok = !!k && k.line === 'Say whether it will hit the target in words I can scan' && k.mood === 'meh' && k.route === '/goals/:goalId' && k.goalId === 'ns-lead' && k.strokes.length === 2 && k.strokes[0].kind === 'box' && k.strokes[1].kind === 'note' && k.strokes[1].text === 'Hard to tell which way is better'
      && k.parts[0].some((x) => x[0] === 'Goal page' && x.includes('Scorecard')) && k.steps.length > 0 && k.steps.length <= 20 && ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'].every((x) => k.pics.includes(x)) && k.context.viewport.w === vp.width && k.personId === 'rhea' && k.demo === true;
    check(ok, `the markup kept was ${JSON.stringify(k && { line: k.line, mood: k.mood, route: k.route, strokes: k.strokes.map((s) => s.kind), parts: k.parts, steps: k.steps.length, pics: k.pics })}`);
  },

  // U42: anyone opens the inbox; an admin triages a markup (in hand, Undo, issue, fixed) and a piece of feedback; a member reads only
  async U42(p, { phone, browser, vp }) {
    await seed([{ kind: 'feedback', id: 'fb_acme1', mood: 'bad', text: 'The reason box is too small on a phone', path: '/check-in', pageName: 'Check-in', personId: 'mateo-acme', personName: 'Mateo Silva', workspaceId: 'acme', workspaceName: 'Acme', demo: false, at: daysAgo(2) }]);
    await p.goto(`${BASE}/?as=amara`);
    await sendHomeMarkup(p, 'The week strip should say which week it is');
    await p.goto(`${BASE}/feedback`);
    const inbox = p.locator('#inbox');
    await inbox.locator('.ibx-row').first().waitFor();
    check(!(await inbox.locator('input[type=email], input[type=password]').count()) && !(await inbox.getByText('Sign in').count()), 'the inbox asks to sign in or for a token');
    const row = inbox.locator('.ibx-row').first();
    check(await row.locator('.mk-status').innerText() === 'New' && (await row.innerText()).includes('The week strip should say which week it is') && (await row.innerText()).includes('the demo'), 'the markup is not listed as New, with its line and where it came from');
    await inbox.getByRole('button', { name: 'Connect Claude' }).click();
    const connect = inbox.locator('.connect');
    await shown(connect, 'any token from it reads the demo’s markups too');
    const atTop = await inbox.evaluate((el) => { const c = el.querySelector('.connect'); const l = el.querySelector('.ibx-list'); return !!c && !!l && !!(c.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); });
    const setUp = (await connect.getByLabel('Claude Code command', { exact: true }).inputValue()).includes('/api/mcp --header "Authorization: Bearer gk_');
    const pics = await connect.getByText('Pictures for Claude: ready').isVisible();
    check(atTop && setUp && pics, `Connect Claude at the top ${atTop}, set-up ${setUp}, pictures ${pics}`);
    await inbox.getByRole('button', { name: 'Connect Claude' }).click();
    await row.locator('.ibx-open').click();
    let detail = inbox.getByRole('article', { name: /^Markup: / });
    check(await detail.locator('.mk-layers img').first().isVisible(), 'the markup’s picture does not show');
    const drawn = await detail.locator('.mk-ink-layer').count();
    await detail.getByLabel('Show the drawing').click();
    const hidden = await detail.locator('.mk-ink-layer').count();
    await detail.getByRole('button', { name: 'Mark in hand' }).click();
    check(await inbox.getByRole('article', { name: /^Feedback: / }).waitFor({ timeout: 4000 }).then(() => true, () => false), 'the next item (the feedback) does not open');
    await shown(inbox, 'Marked in hand: “The week strip', 'the inbox does not say what was just done');
    await inbox.getByRole('button', { name: 'Undo' }).click();
    detail = inbox.getByRole('article', { name: /^Markup: / });
    await shown(detail.locator('.mk-status-line'), 'New', 'Undo did not put the markup back to New');
    let db = await kept();
    check(db.markups[0].status === 'new' && db.markups[0].history.length === 2, `after Undo the markup is ${db.markups[0].status}, ${db.markups[0].history.length} changes saved`);
    await detail.getByRole('button', { name: 'Mark in hand' }).click();
    await inbox.getByRole('article', { name: /^Feedback: / }).waitFor();
    await toInboxList(inbox, phone);
    await inbox.getByRole('tab', { name: /^In hand/ }).click();
    await inbox.locator('.ibx-row .ibx-open').first().click();
    detail = inbox.getByRole('article', { name: /^Markup: / });
    await shown(detail.locator('.mk-status-line'), 'In hand', 'not marked in hand');
    await shown(detail, 'Marked in hand by Amara Nwosu', 'the markup does not say who marked it');
    await p.context().route('https://github.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>GitHub</title>' }));
    const [tab] = await Promise.all([p.context().waitForEvent('page'), detail.getByRole('button', { name: 'Open GitHub issue' }).click()]);
    await tab.waitForLoadState().catch(() => {});
    const issue = new URL(tab.url()); await tab.close();
    const m0 = (await kept()).markups[0];
    const link = issue.origin + issue.pathname === 'https://github.com/sconies/goals-app/issues/new' && /The week strip/.test(issue.searchParams.get('title') || '') && (issue.searchParams.get('body') || '').includes(`/feedback?markup=${m0.id}`);
    check(drawn === 1 && hidden === 0 && link, `drawing layer ${drawn} then ${hidden}; issue link ${tab.url().slice(0, 160)}`);
    await detail.getByLabel('Paste issue link').fill('https://github.com/sconies/goals-app/issues/101');
    await detail.getByRole('button', { name: 'Keep the link' }).click();
    await shown(inbox.getByRole('article', { name: /^Markup: / }), 'sconies/goals-app/issues/101', 'the issue link is not shown');
    detail = inbox.getByRole('article', { name: /^Markup: / });
    await detail.getByRole('button', { name: 'Mark fixed' }).click();
    await detail.locator('.mk-form').getByRole('button', { name: 'Mark fixed' }).click();
    await shown(inbox, 'Nothing is in hand.', 'the fixed markup is still in hand');
    db = await kept();
    const m = db.markups[0];
    const shared = m.demo === true && ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'].every((x) => m.pics.includes(x)) && m.route === '/';
    check(shared && db.pictureReads.includes(`${m.id}/screen.png`) && m.status === 'fixed' && m.fixed_in && m.issue_url === 'https://github.com/sconies/goals-app/issues/101' && m.status_by === 'Amara Nwosu', `stored ${JSON.stringify({ shared, status: m.status, fixed: m.fixed_in, issue: m.issue_url, by: m.status_by })}`);
    // feedback: in the same inbox, with the same states
    await p.goto(`${BASE}/feedback`);
    await inbox.getByRole('tab', { name: /^New/ }).click();
    const fbRow = inbox.locator('.ibx-row').filter({ has: p.locator('.fb-item') }).first();
    const fbText = await fbRow.innerText();
    check(await fbRow.locator('.mk-status').innerText() === 'New' && fbText.includes('The reason box is too small on a phone') && fbText.includes('Feedback') && fbText.includes('Mateo Silva, Acme'), `the feedback is not listed as New, with its words and who sent it: ${fbText.replace(/\n/g, ' | ')}`);
    await fbRow.locator('.ibx-open').click();
    await inbox.getByRole('article', { name: /^Feedback: / }).getByRole('button', { name: 'Mark in hand' }).click();
    await shown(inbox, 'Nothing new.', 'the inbox does not say there is nothing new');
    const fp = (await kept()).feedback.find((x) => x.id === 'fb_acme1');
    check(fp.status === 'in-hand' && fp.status_by === 'Amara Nwosu' && fp.history.length === 1, `feedback stored ${JSON.stringify(fp)}`);
    // Rhea, not an admin, reads it from its guessed address
    const q = await (await browser.newContext({ viewport: vp })).newPage();
    q.setDefaultTimeout(8000);
    await q.goto(`${BASE}/inbox?as=rhea`);
    check(await q.waitForURL(/\/feedback$/, { timeout: 4000 }).then(() => true, () => false), `/inbox did not lead to /feedback: ${q.url()}`);
    const qi = q.locator('#inbox');
    await qi.getByRole('tab', { name: /^In hand/ }).click(); // here the one inbox has been worked: the feedback is in hand
    await qi.locator('.ibx-row').first().waitFor();
    await qi.locator('.ibx-row .ibx-open').first().click();
    await shown(qi, 'Only an admin can change the status of feedback.', 'a member is not told who changes a status');
    const buttons = await qi.getByRole('button', { name: /Mark in hand|Mark fixed|Won’t fix|Mark new again/ }).count();
    check(buttons === 0, `a member is offered ${buttons} ways to change a status`);
    await q.context().close();
  },

  // U47: someone else, in another browser, says why a markup from the demo won't be fixed and sees who said so
  async U47(p, { phone, browser, vp }) {
    const sender = await (await browser.newContext({ viewport: vp })).newPage();
    await sender.goto(`${BASE}/?as=rhea`);
    await sendHomeMarkup(sender, 'Say which week the strip is showing');
    await sender.context().close();
    await p.goto(`${BASE}/feedback?as=grace`);
    const inbox = p.locator('#inbox');
    const row = inbox.locator('.ibx-row').filter({ has: p.locator('.mk-item') }).first();
    await row.waitFor();
    check(!(await inbox.locator('input[type=email], input[type=password]').count()), 'the inbox asks for a sign-in or a token');
    const rowText = await row.innerText();
    check(rowText.includes('Say which week the strip is showing') && rowText.includes('the demo') && await row.locator('.mk-status').innerText() === 'New', `the markup from the demo is not listed as New: ${rowText.replace(/\n/g, ' | ')}`);
    await row.locator('.ibx-open').click();
    let detail = inbox.getByRole('article', { name: /^Markup: / });
    check(await detail.locator('.mk-layers img').first().isVisible(), 'no picture');
    await detail.getByRole('button', { name: 'Won’t fix' }).click();
    check(await detail.locator('.mk-form').getByRole('button', { name: 'Won’t fix' }).isDisabled() && (await kept()).markups[0].history.length === 0, 'a markup can be marked won’t fix with no reason');
    await detail.getByLabel('Why it won’t be fixed').fill('The strip already says the week on wider screens.');
    await detail.locator('.mk-form').getByRole('button', { name: 'Won’t fix' }).click();
    await inbox.locator('.ibx-tabs').waitFor();
    if (phone && await inbox.getByRole('button', { name: 'Back to the list' }).isVisible().catch(() => false)) await toInboxList(inbox, phone);
    await inbox.getByRole('tab', { name: /^Closed/ }).click();
    await inbox.locator('.ibx-row .ibx-open').first().click();
    detail = inbox.getByRole('article', { name: /^Markup: / });
    await shown(detail.locator('.mk-status-line'), 'Won’t fix', 'not marked won’t fix');
    await shown(detail, 'Marked won’t fix by Grace');
    const pic = await detail.locator('.mk-layers img').first().evaluate((img) => img.complete && img.naturalWidth > 0);
    check(pic, 'the picture is not shown');
    const db = await kept(); const m = db.markups[0];
    check(m.status === 'wont-fix' && /^Grace/.test(m.status_by || '') && db.pictureReads.includes(`${m.id}/screen.png`), `stored ${JSON.stringify({ status: m.status, by: m.status_by })}`);
  },

  // U52: an inbox of 75 worked down to nothing new
  async U52(p, { phone }) {
    const people = ['Jun Park', 'Ines Duarte', 'Tomas Berg', 'Leila Haddad', 'Sam Okafor'];
    const items = [];
    for (let i = 0; i < 6; i++) items.push({ kind: 'markup', id: `mk_ws${i}`, line: `The week strip ${['is cramped', 'has no year', 'hides today', 'needs labels', 'scrolls badly', 'is too pale'][i]}`, route: '/', address: '/', pageName: 'Home', parts: [[['Home', 'Week strip']]], personName: people[i % 5], workspaceName: 'Acme', at: daysAgo(0, i + 1) });
    for (let i = 0; i < 3; i++) items.push({ kind: 'markup', id: `mk_sc${i}`, line: `The scorecard ${['crowds the bar', 'needs a target', 'rounds oddly'][i]}`, route: '/goals/:goalId', address: '/goals/ns-lead', pageName: 'Lead time for changes', parts: [[['Goal page', 'Scorecard']]], personName: people[(i + 1) % 5], workspaceName: 'Acme', at: daysAgo(9, i) });
    for (let i = 0; i < 36; i++) items.push({ kind: 'markup', id: `mk_el${i}`, line: `Change number ${i + 1} on this page`, route: `/place-${i}`, address: `/place-${i}`, pageName: `Place ${i}`, parts: [[['Place', `Part ${i}`]]], personName: people[i % 5], workspaceName: 'Acme', at: daysAgo(2 + (i % 18), i) });
    for (let i = 0; i < 30; i++) items.push({ kind: 'feedback', id: `fb_${i}`, mood: ['good', 'meh', 'bad'][i % 3], text: `Feedback note ${i + 1}`, path: '/goals', pageName: 'Goals', personName: people[i % 5], workspaceName: 'Acme', at: daysAgo(3 + (i % 17), i) });
    await seed(items);
    await p.goto(`${BASE}/feedback?as=grace`);
    const inbox = p.locator('#inbox');
    const rows = inbox.locator('.ibx-row');
    await rows.first().waitFor();
    check(await inView(rows.first()), 'no inbox row is in view');
    check(await tabCount(inbox, 'New') === 75 && await rows.count() === 25 && await inbox.getByText('1–25 of 68').isVisible() && await rows.first().getByText('6 on this part').isVisible(), `New ${await tabCount(inbox, 'New')}, ${await rows.count()} rows on the page`);
    await inbox.getByRole('searchbox', { name: 'Find feedback' }).fill('week strip');
    await inbox.getByRole('searchbox', { name: 'Find feedback' }).press('Enter');
    await shown(inbox.locator('.count-line'), '1 item matches.');
    await rows.locator('.ibx-open').first().click();
    const detail = inbox.getByRole('article', { name: /^Markup: / });
    await shown(detail, '6 on this part.', 'the folded row does not say it holds 6');
    await detail.getByRole('button', { name: 'Mark in hand (all 6)' }).click();
    await shown(inbox, 'No item matches “week strip”.');
    const found = await rows.count();
    await inbox.getByRole('button', { name: 'Clear the search' }).click();
    await p.waitForURL((u) => !/q=/.test(u.search));
    let fbNew, kinds, kindLink;
    if (phone) {
      await inbox.getByRole('button', { name: 'Filters' }).click();
      const dlg = p.getByRole('dialog', { name: 'Filter feedback' });
      await dlg.getByLabel('Kind').selectOption('feedback');
      await dlg.getByRole('button', { name: /^Show \d+ items?$/ }).click();
      await p.waitForURL(/kind=feedback/);
    } else {
      await inbox.locator('.ibx-kind').getByLabel('Kind').selectOption('feedback');
      await p.waitForURL(/kind=feedback/);
    }
    fbNew = await tabCount(inbox, 'New'); kinds = await inbox.locator('.ibx-row .mk-item').count(); kindLink = /[?&]kind=feedback/.test(p.url());
    if (phone) { await inbox.getByRole('button', { name: 'Filters' }).click(); await p.getByRole('dialog', { name: 'Filter feedback' }).getByLabel('Kind').selectOption('all'); }
    else { await inbox.locator('.ibx-kind').getByLabel('Kind').selectOption('all'); await p.waitForURL((u) => !/kind=/.test(u.search)); await inbox.getByRole('button', { name: 'Filters' }).click(); }
    const dlg = p.getByRole('dialog', { name: 'Filter feedback' });
    await dlg.getByLabel('From').fill('Jun Park');
    await dlg.getByRole('button', { name: /^Show \d+ items?$/ }).click();
    await shown(inbox.locator('.filter-line'), 'Filtered by: From Jun Park', 'the person filter is not said in words');
    const jun = (await rows.allInnerTexts()).every((x) => x.includes('Jun Park')) && /[?&]who=Jun/.test(p.url());
    await inbox.getByRole('button', { name: 'Remove the filter From' }).click();
    check(await inbox.locator('.filter-line').waitFor({ state: 'detached', timeout: 4000 }).then(() => true, () => false), 'the filter line stays');
    const six = (await kept()).markups.filter((m) => /week strip/.test(m.line) && m.status === 'in-hand').length;
    check(found === 0 && six === 6 && kinds === 0 && fbNew === 30 && jun && kindLink, `search left ${found}; ${six} of 6 in hand; feedback filter left ${kinds} markups and counts ${fbNew} (in the address: ${kindLink}); person filter ${jun}`);
    // one at a time
    const before = await tabCount(inbox, 'New');
    if (phone) {
      await rows.locator('.ibx-open').first().click();
      await inbox.getByRole('button', { name: 'Next' }).click();
      await shown(inbox, '2 of', 'Next did not go on to the second item');
      await inbox.locator('.ibx-detail').getByRole('button', { name: 'Mark in hand' }).click();
      await shown(inbox, '2 of', 'handling an item did not open the next one');
      await inbox.getByRole('button', { name: 'Back to the list' }).click();
    } else {
      await p.locator('main h1').click();
      await p.keyboard.press('j');
      await p.waitForURL(/open=/);
      const first = await inbox.locator('.ibx-row[aria-current]').getAttribute('data-row');
      await p.keyboard.press('i');
      await p.waitForURL(/done=1/);
      await p.keyboard.press('w');
      await inbox.locator('.ibx-detail').getByLabel('Why it won’t be fixed').fill('Seen it: already on the list.');
      await inbox.locator('.ibx-detail .mk-form').getByRole('button', { name: 'Won’t fix' }).click();
      await p.waitForLoadState();
      const second = await inbox.locator('.ibx-row[aria-current]').getAttribute('data-row').catch(() => null);
      check(first && first !== second, 'J did not move to a row, or handling did not open the next');
    }
    const after = await tabCount(inbox, 'New');
    check(after === before - (phone ? 1 : 2), `one at a time: New went from ${before} to ${after}`);
    // a page at a time
    for (let rounds = 0; rounds < 6 && await tabCount(inbox, 'New') > 0; rounds++) {
      await inbox.getByLabel('Select this page').check();
      await inbox.getByRole('button', { name: 'Won’t fix…' }).click();
      await inbox.locator('.ibx-bulk').getByLabel('Why it won’t be fixed').fill('Closed in the triage of 8 November.');
      await inbox.locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Won’t fix \d+$/ }).click();
      await p.waitForLoadState();
    }
    await shown(inbox, 'Nothing new.', 'the inbox does not say there is nothing new');
    await inbox.getByRole('tab', { name: /^In hand/ }).click();
    await inbox.getByLabel('Select this page').check();
    await inbox.getByRole('button', { name: 'Mark fixed…' }).click();
    await inbox.locator('.ibx-bulk .mk-form').getByRole('button', { name: /^Mark \d+ fixed$/ }).click();
    await shown(inbox, 'Nothing is in hand.', 'the batch was not marked fixed');
    const closed = await tabCount(inbox, 'Closed');
    check(closed === 75, `Closed holds ${closed}`);
    const db = await kept(); const all = [...db.markups, ...db.feedback];
    check(all.length === 75 && all.every((x) => (x.status === 'fixed' || x.status === 'wont-fix') && /^Grace/.test(x.status_by || '')), 'not all closed by Grace');
  },

  // U40 (its Feedback part): feedback sent from the demo says where it goes
  async U40(p, { phone }) {
    await p.goto(`${BASE}/?as=chen`);
    await openMenu(p, phone, 'Feedback');
    await p.getByRole('button', { name: 'Send feedback' }).click();
    const sheet = p.getByRole('dialog', { name: 'How is the app working for you?' });
    await sheet.getByRole('button', { name: 'It gets in the way' }).click();
    await sheet.getByRole('textbox').fill('The causes didn’t fit my week.');
    await sheet.getByRole('button', { name: 'Send', exact: true }).click();
    await shown(p.locator('main'), 'It goes to the people building this app', 'demo feedback does not say where it goes');
    const fb = (await kept()).feedback.pop();
    check(fb && fb.mood === 'bad' && fb.personId === 'chen' && fb.status === 'new', `kept ${JSON.stringify(fb)}`);
  },

  // U51 and U53 (their Feedback parts): old inbox links lead to Feedback, beside Help
  async U51(p) {
    await p.goto(`${BASE}/workspace?inbox=1&markup=mk_old`);
    check(/\/feedback\?markup=mk_old$/.test(p.url()), `the inbox’s old link went to ${p.url()}`);
  },
  async U53(p, { phone }) {
    await p.goto(`${BASE}/workspace/inbox`);
    check(new URL(p.url()).pathname === '/feedback', `went to ${p.url()}`);
    check(await p.getByRole('heading', { level: 1, name: 'Feedback' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'the inbox’s old address does not open Feedback');
    if (!phone) {
      check(await p.locator('nav.sidebar').getByRole('link', { name: 'Feedback' }).isVisible(), 'Feedback is not in the sidebar');
      const words = await menuWords(p, phone);
      check(words.indexOf('Feedback') === words.indexOf('Help') + 1, `Feedback does not follow Help: ${words.join(', ')}`);
    }
  },

  // U165 (its Feedback part): off, no row, no key, /feedback says so; back on, all of it returns
  async U165(p, { phone }) {
    await p.goto(`${BASE}/workspace/features?as=amara`);
    await p.getByRole('switch', { name: 'Feedback' }).click();
    await shown(p.locator('main'), 'Feedback is off in');
    await p.goto(`${BASE}/`);
    const menu = await menuWords(p, phone);
    check(!menu.includes('Feedback'), `the menu still has Feedback: ${menu.join(', ')}`);
    check(menu.slice(-3).join() === 'Workspace,Settings,Help', `the menu’s last group is ${menu.slice(-3).join(', ')}`);
    if (!phone) {
      await p.keyboard.press('Control+Shift+M');
      await p.waitForTimeout(800);
      check(!(await p.locator('.markup-root').count()), 'Ctrl+Shift+M opened a markup with Feedback off');
    }
    await p.goto(`${BASE}/feedback`);
    await shown(p.locator('main'), 'Page not found');
    await shown(p.locator('main'), 'Feedback is switched off in', '/feedback does not say Feedback is switched off');
    const s = await state();
    check(s.changes.some((c) => c.entity === 'workspace' && c.summary === 'Switched off Feedback'), 'switching Feedback off was not logged');
    await p.goto(`${BASE}/workspace/features`);
    await p.getByRole('switch', { name: 'Feedback' }).click();
    await shown(p.locator('main'), 'Feedback is on in');
    await p.goto(`${BASE}/feedback`);
    check(await p.getByRole('heading', { level: 1, name: 'Feedback' }).isVisible(), 'the page did not come back');
    if (!phone) { await p.keyboard.press('Control+Shift+M'); check(await p.locator('.markup-root').waitFor({ timeout: 4000 }).then(() => true, () => false), 'the key did not come back'); }
  },
};

async function main() {
  const only = process.argv.slice(2);
  const server = spawn(process.execPath, [path.join(here, '../../app/server.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, FARO_TEST: '1' } });
  const up = await new Promise((r) => { server.stdout.once('data', () => r(true)); server.once('exit', () => r(false)); setTimeout(() => r(false), 15000); });
  if (!up) { console.log('FAIL the app did not start'); process.exit(1); }
  const browser = await chromium.launch();
  let failed = 0, ran = 0;
  try {
    for (const [id, run] of Object.entries(J)) {
      if (only.length && !only.includes(id)) continue;
      for (const [width, vp] of Object.entries(WIDTHS)) {
        await reset();
        const context = await browser.newContext({ viewport: vp });
        const p = await context.newPage();
        p.setDefaultTimeout(8000);
        const errors = [];
        p.on('pageerror', (e) => errors.push(e.message));
        if (process.env.DEBUG) p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('  nav', f.url()); });
        ran++;
        try { await run(p, { phone: width === 'phone', browser, vp }); check(!errors.length, `errors on the page: ${errors.join('; ')}`); console.log(`PASS ${id} ${width}`); }
        catch (e) { failed++; console.log(`FAIL ${id} ${width}: ${e instanceof CheckFailed ? e.message : e.message.split("\n")[0]} (at ${p.url()})`); if (process.env.DEBUG) console.log(e.stack); }
        await context.close();
      }
    }
  } finally { await browser.close(); server.kill(); }
  if (!ran) { console.log('FAIL no journey ran'); process.exit(1); }
  console.log(failed ? `${failed} journey runs failed.` : 'Every journey run passed.');
  process.exit(failed ? 1 : 0);
}
main();
