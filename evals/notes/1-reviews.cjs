/* N1: Lane's review notes (5 Nov), reviews. run({ open, url, browser }) returns a list of failures.
   The Reviews list says where each session stands; a review's agenda is one line per goal with nothing cut off; once a
   session is held, the review's own page leads with what was said (the old /summary page redirects there). */
const STATE = /^(Not started|In progress · \d+ of \d+ reviewed|Held (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2})$/;
const n = (x) => (x == null ? 'none' : Math.round(x));

/** Every agenda row on the page: what it shows, and anything in it that is clipped, clamped or squeezed. */
const agendaReport = (p) => p.evaluate(() => {
  const rows = [...document.querySelectorAll('.agenda-row')].filter((r) => r.getClientRects().length);
  const out = { rows: rows.length, clipped: [], clamped: [], squeezed: [], outside: [], shape: 0, words: 0, extra: [], nums: 0, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  for (const r of rows) {
    const rb = r.getBoundingClientRect();
    const title = r.querySelector('.agenda-title');
    for (const e of [r, ...r.querySelectorAll('*')]) {
      if (e.closest('svg')) continue;
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && cs.display !== 'inline') out.clipped.push(`${e.className} "${e.textContent.trim().slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
      if ((cs.webkitLineClamp && cs.webkitLineClamp !== 'none') || cs.textOverflow === 'ellipsis') out.clamped.push(String(e.className));
      const b = e.getBoundingClientRect();
      if (b.width && (b.right > rb.right + 1 || b.left < rb.left - 1)) out.outside.push(String(e.className));
    }
    // The name has the room: a line of its own on a narrow list, and never a sliver beside the status on a wide one.
    const narrow = r.parentElement.parentElement.getBoundingClientRect().width < 620;
    const nb = r.querySelector('.agenda-name').getBoundingClientRect();
    if (narrow ? nb.width < rb.width - 40 : nb.width < rb.width * 0.3) out.squeezed.push(`${title.textContent.slice(0, 24)} ${Math.round(nb.width)}/${Math.round(rb.width)}`);
    if (r.querySelector('.agenda-status svg.status-shape')) out.shape++;
    if (/^(On track|At risk|Off track|No recent update|Done|Not started)$/.test(r.querySelector('.agenda-status').innerText.trim())) out.words++;
    if (r.querySelector('.agenda-num')?.textContent.trim()) out.nums++;
    // Nothing but status, name and level, number and gap: no reasons, owners or check-in sentences.
    const kids = [...r.children].map((c) => c.className);
    if (kids.join(',') !== 'agenda-status tone-' + r.dataset.tone + ',agenda-name,agenda-now' || /\.\s|days ago|Checked in|No check-in/.test(r.innerText)) out.extra.push(kids.join(','));
  }
  return out;
});

module.exports = {
  id: 'N1',
  area: 'reviews',
  title: 'Review notes, reviews',
  reqs: ['REVIEW-LIST-STATE', 'REVIEW-AGENDA', 'REVIEW-DECIDE'],
  async run({ open, url }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };

    // ---------- The Reviews list: state as shape and word, session date, last held, open actions, people ----------
    for (const [w, h] of [[390, 844], [768, 1024], [1280, 800]]) {
      const [c, p] = await open(w, h, 'amara', '/reviews', w < 800);
      await p.locator('.rv-line').first().waitFor();
      const rows = await p.evaluate(() => [...document.querySelectorAll('.rv-line')].map((r) => {
        const rb = r.getBoundingClientRect();
        return {
          name: r.querySelector('.rv-name')?.textContent,
          shape: !!r.querySelector('.session-state svg.session-shape'),
          state: r.querySelector('.session-state')?.innerText.trim(),
          facts: Object.fromEntries([...r.querySelectorAll('.rv-fact')].map((f) => [f.querySelector('.rv-fact-k').textContent, f.querySelector('.rv-fact-v').textContent])),
          people: r.querySelector('.rv-names')?.textContent ?? '',
          cut: [...r.querySelectorAll('*')].filter((e) => !e.closest('svg') && (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline' || e.getBoundingClientRect().right > rb.right + 1)).length,
        };
      }));
      fail(rows.length === 6, `List: ${rows.length} reviews listed at ${w}`);
      for (const r of rows) {
        fail(r.shape && STATE.test(r.state || ''), `List ${w}: ${r.name} state is "${r.state}" (shape ${r.shape})`);
        fail(/^(Mon|Tue|Wed|Thu|Fri) \d{1,2} [A-Z][a-z]{2}$/.test(r.facts.Session || r.facts['Outstanding from'] || r.facts.Next || ''), `List ${w}: ${r.name} has no session date (${JSON.stringify(r.facts)})`);
        fail(/^\d+$/.test(r.facts['Open actions'] || ''), `List ${w}: ${r.name} has no open-actions count`);
        fail(r.cut === 0, `List ${w}: ${r.name} has ${r.cut} clipped parts`);
      }
      const weekly = rows.find((r) => r.name === 'Platform leadership weekly');
      fail(!!weekly && weekly.facts['Last held'] === 'Thu 29 Oct', `List ${w}: weekly last held "${weekly?.facts['Last held']}", expected Thu 29 Oct (last week's session)`);
      fail(!!weekly && /Amara/.test(weekly.people) && /Jun/.test(weekly.people), `List ${w}: weekly's people are "${weekly?.people}"`);
      await c.close();
    }

    // ---------- The agenda: one line per goal, nothing cut off, at every width ----------
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [915, 832], [1024, 768], [1280, 800], [1440, 900], [2560, 1300]]) {
      const [c, p] = await open(w, h, 'amara', '/reviews/weekly', w <= 1024);
      await p.locator('.agenda-row').first().waitFor();
      // Open the healthy group too, so its rows are measured.
      await p.locator('.healthy-group summary').click();
      await p.waitForTimeout(150);
      const m = await agendaReport(p);
      fail(m.rows >= 10, `Agenda ${w}: only ${m.rows} rows`);
      fail(!m.clipped.length && !m.clamped.length && !m.outside.length, `Agenda ${w}: clipped ${m.clipped.slice(0, 2).join('; ')} clamped ${m.clamped.slice(0, 2).join(',')} outside ${m.outside.slice(0, 2).join(',')}`);
      fail(!m.squeezed.length, `Agenda ${w}: names squeezed: ${m.squeezed.slice(0, 2).join('; ')}`);
      fail(m.shape === m.rows && m.words === m.rows && m.nums === m.rows, `Agenda ${w}: ${m.shape} shapes, ${m.words} words, ${m.nums} numbers on ${m.rows} rows`);
      fail(!m.extra.length, `Agenda ${w}: rows carry more than status, name, number and gap (${m.extra[0]})`);
      fail(m.sideways <= 1, `Agenda ${w}: ${m.sideways}px sideways scroll`);
      if (w === 1280 || w === 915) {
        // Wide enough for one line: status, name, number and gap share a top line.
        const line = await p.evaluate(() => { const r = document.querySelector('.agenda-row'); const t = (s) => r.querySelector(s).getBoundingClientRect().top; return Math.max(t('.agenda-status'), t('.agenda-name'), t('.agenda-now')) - Math.min(t('.agenda-status'), t('.agenda-name'), t('.agenda-now')); });
        fail(line <= 4, `Agenda ${w}: a row's status, name and number are not on one line (${n(line)}px apart)`);
      }
      await c.close();
    }

    // ---------- The review page: a terse line, the healthy group folded with one action ----------
    {
      const [c, p] = await open(1280, 800, 'amara', '/reviews/weekly');
      await p.locator('.hero').waitFor();
      const m = await p.evaluate(() => ({
        line: document.querySelector('.hero .review-line')?.textContent ?? '',
        hero: document.querySelector('.hero-body').innerText,
        open: document.querySelector('.healthy-group details').open,
        buttons: [...document.querySelectorAll('.healthy-group button, .healthy-group a')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()),
        hints: [...document.querySelectorAll('.healthy-group .hint')].filter((e) => e.getClientRects().length).length,
      }));
      fail(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · /.test(m.line) && m.line.length <= 60 && !/\.\s|\.$/.test(m.line), `Hero: the line under the name is "${m.line}"`);
      fail(!/Worst and stalest|You can start early/.test(m.hero), 'Hero: the explanatory paragraph is still there');
      fail(!m.open && m.hints === 0, `Healthy group: open ${m.open}, ${m.hints} explanatory lines`);
      fail(m.buttons.length === 1 && /^Mark \d+ goals? reviewed$/.test(m.buttons[0]), `Healthy group: actions in view are ${m.buttons.join(' / ')}`);
      await c.close();
    }

    // ---------- The walk's close (×) returns to the agenda ----------
    {
      const [c, p] = await open(390, 844, 'amara', '/reviews/weekly', true);
      await p.getByRole('button', { name: /^Start review/ }).click();
      await p.locator('.reviewbar').waitFor();
      await p.getByRole('button', { name: 'Close the review' }).click();
      await p.waitForURL(/\/reviews\/weekly(\?|$)/);
      fail(await p.locator('.agenda-row').first().waitFor({ timeout: 3000 }).then(() => true, () => false), `Close (×): ${p.url()} shows no agenda`);
      await c.close();
    }

    // ---------- A whole session: say things, finish, the held review leading with what was said, and the list after ----------
    // The real reviews here have 12 to 56 goals, so the session is walked on a small one set up for it: the off-track merge
    // queue (to discuss) and the on-track review-time goal (to mark reviewed), held on Thursdays like the leadership weekly.
    const small = async (p) => { await p.evaluate(() => window.__goalsStore.commit('platform-org', { reviews: [{ id: 'small', name: 'Merge queue check', everyWeeks: 1, weekday: 3, scope: { goals: ['lead-mq', 'lead-review'], trees: [], levels: [] }, people: ['amara', 'daniel'], createdBy: 'amara', createdAt: '2026-11-04T09:00:00.000Z' }], changes: [] })); await p.goto(url('/reviews/small')); await p.waitForTimeout(400); };
    {
      const [c, p] = await open(1280, 900, 'amara', '/reviews');
      await small(p);
      await p.getByRole('button', { name: /^Start review/ }).click();
      await p.locator('.decide').waitFor();
      await p.locator('.decide').getByRole('button', { name: 'Add a note' }).click();
      await p.getByPlaceholder('What the review said').fill('The vendor’s fix slipped to their next release.');
      await p.getByRole('button', { name: 'Save note' }).click();
      await p.locator('.said').getByText('The vendor’s fix slipped').waitFor();
      // The merge queue is off track: the walk asks what happens next before it moves on (deep review P2).
      fail(await p.getByRole('heading', { name: 'What happens next, who, by when?' }).isVisible() && !(await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).count()), 'Decide: an off-track goal can be marked reviewed without a decision');
      await p.locator('.decide').getByRole('button', { name: 'Add the next step' }).click();
      await p.getByPlaceholder('What needs doing').fill('Agree the batching workaround with Web');
      // Who is found by searching, never picked from a list of everyone.
      const dlg = p.getByRole('dialog');
      fail(!(await dlg.locator('.person-pick .optlist').count()), 'Decide: the person search lists people before anything is typed');
      await dlg.getByRole('searchbox', { name: /^Who/ }).fill('Diego');
      await dlg.getByRole('radio', { name: /Diego Ramírez/ }).click();
      await p.getByRole('button', { name: 'Save the next step' }).click();
      fail(await dlg.getByRole('alert').filter({ hasText: 'Choose the week' }).isVisible().catch(() => false), 'Decide: a next step for a goal behind saved with no date');
      await dlg.getByLabel(/^By/).selectOption({ index: 2 });
      await p.getByRole('button', { name: 'Save the next step' }).click();
      await p.locator('.said').getByText('Agree the batching workaround').waitFor();
      await p.locator('.decide .quiet-links').getByRole('button', { name: /^Ask / }).click();
      await p.getByPlaceholder(/What would it take/).fill('Can the web monorepo move before week 49?');
      await p.getByRole('button', { name: 'Save question' }).click();
      await p.locator('.said').getByText('Can the web monorepo').waitFor();
      // The healthy goal is still to mark, so the walk returns to the agenda, whose one action finishes it.
      await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).click();
      await p.waitForURL(/\/reviews\/small(\?|$)/);
      const mid = await p.locator('.review-line').innerText();
      fail(/1 of 2 reviewed/.test(mid), `Mid-session: the review says "${mid}"`);
      // The list says it's in progress, with how many reviewed.
      await p.goto(url('/reviews'));
      const st = await p.locator('.rv-line', { hasText: 'Merge queue check' }).locator('.session-state').innerText();
      fail(st.trim() === 'In progress · 1 of 2 reviewed', `List mid-session: Merge queue check says "${st}"`);
      await p.goto(url('/reviews/small'));
      // Finishing is its own step, asked first (deep review T3): the one goal with nothing flagged is marked in it.
      await p.getByRole('button', { name: 'Finish review' }).click();
      const ask = p.getByRole('dialog', { name: 'Finish Merge queue check?' });
      await ask.waitFor({ timeout: 3000 }).catch(() => fail(false, 'Finish review: no question first'));
      // It says what was decided and who owns it, then what is recorded (deep review P2).
      const said = await ask.innerText().catch(() => '');
      fail(/Decided/.test(said) && /Diego Ramírez/.test(said) && /Agree the batching workaround with Web, by [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/.test(said), `Finish review: the summary doesn't say what was decided and who owns it: ${said.replace(/\s+/g, ' ')}`);
      fail(/1 question for an owner stays open/.test(said) && /1 goal is marked reviewed/.test(said), `Finish review: the question does not say what is recorded: ${said.replace(/\s+/g, ' ')}`);
      await ask.getByRole('button', { name: 'Finish the review' }).click();
      await p.locator('.toast').filter({ hasText: 'Finished Merge queue check' }).getByRole('button', { name: 'Undo' }).waitFor({ timeout: 4000 }).catch(() => fail(false, 'Finish review: no Undo after finishing'));
      await p.locator('.review-home .session-record').waitFor({ timeout: 5000 }).catch(() => fail(false, `Finishing: ${p.url()} does not lead with what was said`));
      fail(/\/reviews\/small(\?|$)/.test(p.url()), `Finishing: landed on ${p.url()}, not the review`);
      const s = await p.evaluate(() => {
        const page = document.querySelector('.review-home');
        const blocks = [...page.children].filter((e) => e.getClientRects().length).map((e) => e.className);
        const prim = [...document.querySelectorAll('.btn.primary')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim());
        return {
          h1: document.querySelector('h1').textContent, t: page.innerText, prim, blocks,
          line: document.querySelector('.hero .review-line')?.innerText.trim(),
          record: document.querySelector('.session-record .block-title')?.innerText.trim(),
          reviewed: document.querySelectorAll('.session-record .agenda-row').length,
          print: [...page.querySelectorAll('a')].some((a) => /\/reviews\/small\/print$/.test(a.getAttribute('href')) && a.getClientRects().length),
          reviewsLink: [...page.querySelectorAll('a')].some((a) => /\/reviews(\?|$)/.test(a.getAttribute('href')) && a.getClientRects().length),
        };
      });
      fail(s.h1 === 'Merge queue check' && /^Held Thu 5 Nov · Next [A-Z][a-z]{2} \d{1,2} Nov$/.test(s.line || ''), `Held review: "${s.h1}", line "${s.line}"`);
      // What was said comes straight after the review's heading.
      fail(s.record === 'What was said' && s.blocks.indexOf('block session-record') === s.blocks.indexOf('hero') + 1, `Held review: the record is "${s.record}", page order ${s.blocks.join(' / ')}`);
      fail(/The vendor’s fix slipped/.test(s.t) && /Can the web monorepo move/.test(s.t) && /Agree the batching workaround/.test(s.t), 'Held review: what was said is missing');
      fail(/Diego Ramírez · by week \d+, \d/.test(s.t), 'Held review: the action does not say who and by when');
      fail(s.reviewed === 2, `Held review: ${s.reviewed} goals listed as reviewed, expected 2`);
      fail(s.prim.length === 0 && s.print && s.reviewsLink, `Held review: primary actions ${s.prim.join(' / ')}, Print ${s.print}, link to Reviews ${s.reviewsLink}`);
      // The old summary address still works: it opens the review.
      await p.goto(url('/reviews/small/summary'));
      await p.waitForURL(/\/reviews\/small(\?|$)/, { timeout: 5000 }).catch(() => fail(false, `/summary: landed on ${p.url()}, not the review`));
      await p.goto(url('/reviews'));
      await p.locator('.rv-line').first().waitFor();
      const row = await p.evaluate(() => { const r = [...document.querySelectorAll('.rv-line')].find((x) => /Merge queue check/.test(x.textContent)); return { state: r.querySelector('.session-state').innerText.trim(), text: r.innerText }; });
      fail(row.state === 'Held Thu 5 Nov' && /Open actions\s*1/.test(row.text), `List after: Merge queue check says "${row.state}", ${row.text.replace(/\s+/g, ' ')}`);
      const weekly = await p.evaluate(() => [...document.querySelectorAll('.rv-line')].find((x) => /Platform leadership weekly/.test(x.textContent)).querySelector('.session-state').innerText.trim());
      fail(weekly === 'Not started', `List after: Platform leadership weekly says "${weekly}"`);
      await c.close();
    }

    // ---------- Walking every goal: "Reviewed & finish" goes straight to the held review and what was said ----------
    {
      const [c, p] = await open(390, 844, 'amara', '/reviews', true);
      await small(p);
      await p.locator('.healthy-group summary').click();
      await p.getByRole('button', { name: 'Walk them one at a time instead' }).click();
      await p.getByRole('button', { name: /^Start review · 2 goals/ }).click();
      // The off-track goal: the review accepts the risk, with a reason.
      await p.locator('.decide').getByRole('button', { name: 'We accept the risk' }).click();
      await p.getByRole('dialog').locator('textarea').fill('The vendor fix lands next release; nothing we can do sooner.');
      await p.getByRole('button', { name: 'Save the decision' }).click();
      await p.locator('.said').getByText('The vendor fix lands next release').waitFor();
      await p.locator('.decide').getByRole('button', { name: 'Reviewed & next' }).click();
      await p.locator('.decide').getByRole('button', { name: 'Reviewed & finish' }).click();
      // The last goal finishes on the review's page, with the summary first.
      await p.waitForURL(/\/reviews\/small\?finish=/, { timeout: 5000 }).catch(() => fail(false, `Reviewed & finish: landed on ${p.url()}`));
      const fin = p.getByRole('dialog', { name: 'Finish Merge queue check?' });
      await fin.waitFor({ timeout: 3000 }).catch(() => fail(false, 'Reviewed & finish: no Finish summary'));
      fail(/We accept the risk: Merge queue live for every monorepo/.test(await fin.innerText().catch(() => '')), 'Reviewed & finish: the summary does not show the risk accepted');
      await fin.getByRole('button', { name: 'Finish the review' }).click();
      await p.waitForURL(/\/reviews\/small(\?|$)/, { timeout: 5000 }).catch(() => fail(false, `Reviewed & finish: landed on ${p.url()}`));
      await p.locator('.review-home .session-record').waitFor({ timeout: 5000 }).catch(() => fail(false, 'Reviewed & finish: the review does not lead with what was said'));
      const m = await agendaReport(p);
      fail(m.rows === 2 && !m.clipped.length && !m.outside.length && m.sideways <= 1, `Held review at 390: ${m.rows} rows, clipped ${m.clipped.length}, sideways ${m.sideways}`);
      const btn = await p.getByRole('link', { name: 'Edit review setup' }).boundingBox();
      // Rounded like the message: a 2.75rem (44px) target can measure 43.99 after sub-pixel layout on some machines.
      fail(!!btn && n(btn.height) >= 44, `Held review at 390: Edit review setup is ${n(btn?.height)}px tall`);
      await c.close();
    }

    // ---------- Demo review, 8 Nov, item 9: a session past its date and not held says so ----------
    {
      const [c, p] = await open(1280, 800, 'amara', '/reviews');
      await p.locator('.rv-line').first().waitFor();
      const rows = await p.evaluate(() => [...document.querySelectorAll('.rv-line')].map((r) => {
        const fact = (k) => [...r.querySelectorAll('.rv-fact')].find((f) => f.querySelector('.rv-fact-k')?.textContent === k)?.innerText ?? '';
        return { href: r.getAttribute('href'), name: r.querySelector('.rv-name')?.textContent, state: r.querySelector('.session-state')?.innerText.trim(), session: fact('Session'), outstanding: fact('Outstanding from'), next: fact('Next'), mark: !!r.querySelector('.rv-past svg') };
      }));
      // Today is Thursday 5 November: Reliability weekly was Wednesday 4 November and is still in progress. Review F07:
      // it is "Outstanding from Wed 4 Nov", with the next session (Wed 11 Nov) named apart from it.
      const late = rows.filter((r) => /^(Not started|In progress)/.test(r.state || '') && /Wed 4 Nov/.test(r.outstanding));
      fail(late.length > 0 && late.every((r) => /1 day past/.test(r.outstanding) && r.mark && /Wed 11 Nov/.test(r.next)), `Reviews: a session a day past its date isn’t flagged as outstanding with the next one beside it (${JSON.stringify(late)})`);
      fail(!rows.some((r) => /Thu 5 Nov/.test(r.session + r.outstanding) && /past/.test(r.session + r.outstanding)), 'Reviews: today’s session is called past');
      // Its page and the walk's bar say the same: the outstanding session's date, then the next.
      const href = late[0]?.href;
      if (href) {
        await p.locator(`.rv-line[href="${href}"]`).first().click();
        await p.locator('.hero .review-line').waitFor();
        const line = (await p.locator('.hero .review-line').innerText()).trim();
        fail(/^Outstanding from Wed 4 Nov \(1 day past\) · .* · Next Wed 11 Nov$/.test(line), `Review F07: the outstanding review's line is "${line}"`);
        const go = p.getByRole('button', { name: /^(Start|Continue) review/ });
        if (await go.count()) {
          await go.click();
          await p.locator('.reviewbar').waitFor();
          const bar = (await p.locator('.reviewbar .reviewbar-when').innerText()).trim();
          fail(bar === 'Outstanding from Wed 4 Nov (1 day past)', `Review F07: the walk's bar doesn't date the session: "${bar}"`);
        }
      }
      await c.close();
    }

    // ---------- Demo review, 8 Nov, items 7 and 8: the walk and the review count the same goals ----------
    {
      const [c, p] = await open(1280, 800, 'amara', '/reviews/weekly');
      const ring = await p.locator('.review-home .ring').first().getAttribute('aria-label').catch(() => null)
        ?? await p.locator('.review-home [role=img]').first().getAttribute('aria-label').catch(() => null);
      const shown = await p.locator('.review-home .ring').first().innerText().catch(() => '');
      const [, rd, rt] = /(\d+) of (\d+)/.exec(ring || '') || [];
      fail(!!rt, `Review ring: no "n of N" in its text alternative (“${ring}”)`);
      if (shown && rd) fail(shown.replace(/\D+/g, ' ').trim().split(' ')[0] === rd, `Review ring: shows “${shown.trim()}” but its text alternative says “${ring}”`);
      await p.getByRole('button', { name: /^(Start|Continue) review/ }).click();
      await p.locator('.reviewbar').waitFor();
      const bar = (await p.locator('.reviewbar .hint').innerText()).trim();
      const m = /^Goal \d+ of (\d+)( to discuss)? · (\d+) of (\d+) reviewed$/.exec(bar);
      fail(!!m && m[4] === rt && m[3] === rd, `Walk: the bar says “${bar}”, the review ${rd} of ${rt} reviewed`);
      if (m) fail(m[1] === rt ? !m[2] : !!m[2], `Walk: “${bar}” doesn’t say the walk is the goals to discuss`);
      await c.close();
    }
    // ---------- Deep review T3 (10 Nov): on the talk's day, the walk keeps its place, its count and its order ----------
    // Daniel runs the Developer Productivity fortnightly on Wednesday 11 November, as the demo does from /demo?today=2026-11-11.
    const talk = (route) => url(route).replace(/today=[\d-]+/, 'today=2026-11-11');
    const barText = async (p) => (await p.locator('.reviewbar .hint').innerText()).trim();
    // The bar is read once it says what's expected, or after 4 seconds: straight after a move it can still be redrawing.
    const barSays = async (p, re) => { for (let i = 0; i < 40; i++) { if (re.test(await barText(p).catch(() => ''))) return true; await p.waitForTimeout(100); } return false; };
    const goalOf = (p) => new URL(p.url()).pathname.split('/').pop();
    // A goal behind is decided before it's marked reviewed (deep review P2): here, by accepting the risk.
    const decide = async (p) => {
      const accept = p.locator('.decide').getByRole('button', { name: 'We accept the risk' });
      // Wait until the bar has drawn one or the other: straight after a move it can still be on its way.
      await accept.or(p.locator('.decide').getByRole('button', { name: /^Reviewed & / })).first().waitFor();
      if (!(await accept.isVisible().catch(() => false))) return;
      await accept.click();
      await p.getByRole('dialog').locator('textarea').fill('Waiting on the Q4 runner budget, decided above this review.');
      await p.getByRole('button', { name: 'Save the decision' }).click();
      await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).waitFor();
    };
    const walked = [];
    let total = 0;
    {
      const [c, p] = await open(1280, 900, 'daniel', '/reviews');
      await p.goto(talk('/reviews/devprod'));
      await p.getByRole('button', { name: /^(Start|Continue) review/ }).click();
      await p.locator('.reviewbar').waitFor();
      const first = /^Goal (\d+) of (\d+)/.exec(await barText(p)) || [];
      const k0 = Number(first[1]);
      total = Number(first[2]);
      fail(total > 3, `T3: the walk is "${await barText(p)}"`);
      // Two goals reviewed, then leave and continue: the third goal, counted as the third.
      for (let i = 0; i < 2; i++) {
        walked.push(goalOf(p));
        const here = p.url();
        await decide(p);
        await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).click();
        await p.waitForURL((u) => u.href !== here);
        await p.locator('.reviewbar').waitFor();
      }
      walked.push(goalOf(p));
      fail(await barSays(p, new RegExp(`^Goal ${k0 + 2} of ${total}`)), `T3: after two reviewed the bar says "${await barText(p)}", expected Goal ${k0 + 2} of ${total}`);
      await p.getByRole('button', { name: 'Close the review' }).click();
      await p.waitForURL(/\/reviews\/devprod(\?|$)/);
      await p.getByRole('button', { name: /^Continue review/ }).click();
      await p.locator('.reviewbar').waitFor();
      fail(await barSays(p, new RegExp(`^Goal ${k0 + 2} of ${total}`)) && goalOf(p) === walked[2], `T3: Continue review opened ${goalOf(p)} as "${await barText(p)}", expected ${walked[2]} as Goal ${k0 + 2} of ${total}`);
      fail(await p.getByRole('button', { name: 'Previous goal' }).isEnabled(), 'T3: Previous goal is disabled after Continue review');

      // The goals with nothing flagged: asked first, not the end of the review, and undone from the message.
      await p.goto(talk('/reviews/devprod'));
      const line0 = (await p.locator('.review-line').innerText()).trim();
      const mark = p.locator('.healthy-group').getByRole('button', { name: /^Mark \d+ goals? reviewed$/ });
      const k = Number(((await mark.innerText().catch(() => '')).match(/\d+/) || ['0'])[0]);
      fail(k > 0, 'T3: no goals with nothing flagged to mark');
      await mark.click();
      const ask = p.getByRole('dialog', { name: new RegExp(`^Mark ${k} goals? reviewed\\?$`) });
      await ask.waitFor({ timeout: 3000 }).catch(() => fail(false, 'T3: marking the goals with nothing flagged did not ask first'));
      await ask.getByRole('button', { name: 'Not yet' }).click();
      fail((await p.locator('.review-line').innerText()).trim() === line0, 'T3: "Not yet" still marked goals reviewed');
      await mark.click();
      await ask.getByRole('button', { name: new RegExp(`^Mark ${k} goals? reviewed$`) }).click();
      const toast = p.locator('.toast').filter({ hasText: /marked reviewed in Developer Productivity/ });
      await toast.waitFor({ timeout: 4000 }).catch(() => fail(false, 'T3: no message after marking'));
      fail(!(await p.locator('.review-home .session-record').filter({ hasText: 'What was said' }).count()) && /In progress|reviewed/.test(await p.locator('.review-line').innerText()), `T3: marking ended the review ("${await p.locator('.review-line').innerText()}")`);
      fail(await p.getByRole('button', { name: /^Continue review/ }).isVisible(), 'T3: after marking, the review has no Continue');
      await toast.getByRole('button', { name: 'Undo' }).click();
      await p.waitForTimeout(600);
      fail((await p.locator('.review-line').innerText()).trim() === line0 && await mark.isVisible(), `T3: Undo did not put the goals back ("${(await p.locator('.review-line').innerText()).trim()}", was "${line0}")`);
      await c.close();
    }
    // Opened from a goal's own address: the agenda's order, the same count, and saving an action moves nothing.
    {
      const [c, p] = await open(1280, 900, 'daniel', '/reviews');
      await p.goto(talk(`/goals/${walked[0]}?review=devprod`));
      await p.locator('.reviewbar').waitFor();
      const before = await barText(p);
      fail(new RegExp(` of ${total}( |$)`).test(before), `T3 deep link: the bar says "${before}", expected the walk's ${total}`);
      await p.locator('.decide').getByRole('button', { name: 'Add the next step' }).click();
      await p.getByPlaceholder('What needs doing').fill('Agree the runner budget with Amara');
      await p.getByRole('dialog').getByLabel(/^By/).selectOption({ index: 1 });
      await p.getByRole('button', { name: 'Save the next step' }).click();
      await p.locator('.said').getByText('Agree the runner budget').waitFor();
      fail(await barText(p) === before, `T3 deep link: saving an action moved the goal from "${before}" to "${await barText(p)}"`);
      const here = p.url();
      await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).click();
      await p.waitForURL((u) => u.href !== here);
      fail(goalOf(p) === walked[1], `T3 deep link: Reviewed & next went to ${goalOf(p)}, not the next goal on the agenda (${walked[1]})`);
      await c.close();
    }

    // ---------- Deep review P2 (10 Nov): last time, and next steps on the goal page ----------
    {
      const [c, p] = await open(1280, 900, 'daniel', '/reviews');
      await p.goto(talk('/reviews/devprod'));
      await p.locator('.review-home').waitFor();
      // The session opens with what the last one agreed, straight after the review's heading.
      const blocks = await p.evaluate(() => [...document.querySelector('.review-home').children].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-part') || e.className));
      fail(blocks.indexOf('Last time') === blocks.indexOf('hero') + 1, `P2: the review doesn't open with last time (${blocks.join(' / ')})`);
      const last = p.locator('[data-part="Last time"]');
      const row = last.locator('li', { hasText: 'Name a review rota' });
      fail(/Tariq agreed: Name a review rota/.test(await row.innerText().catch(() => '')) && /by [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}/.test(await row.innerText().catch(() => '')) && /Open/.test(await row.innerText().catch(() => '')), `P2: last time says "${(await row.innerText().catch(() => 'nothing')).replace(/\s+/g, ' ')}"`);
      await row.getByRole('button', { name: 'Done?' }).click();
      await p.waitForTimeout(500);
      fail(/Done/.test(await last.locator('li', { hasText: 'Name a review rota' }).innerText().catch(() => '')), 'P2: marking last time\'s action done from the review did not say Done');
      await c.close();
    }
    {
      const [c, p] = await open(390, 844, 'daniel', '/reviews', true);
      await p.goto(talk('/goals/lead-review-rota'));
      const rowSel = p.locator('.action-row', { hasText: 'Name a review rota' });
      await rowSel.waitFor();
      fail(/Tariq, by week \d+ \([A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}\)/.test(await rowSel.innerText()), `P2: the goal page's action row has no owner and date: ${(await rowSel.innerText()).replace(/\s+/g, ' ')}`);
      // Changed on the goal page: the owner is found by searching.
      await rowSel.getByRole('button', { name: 'Change' }).click();
      const d = p.getByRole('dialog');
      await d.getByRole('searchbox', { name: /^Who/ }).fill('Rhea');
      await d.getByRole('radio', { name: /Rhea Kapoor/ }).click();
      await d.getByRole('button', { name: 'Save the change' }).click();
      await p.waitForTimeout(500);
      fail(/Rhea, by week/.test(await p.locator('.action-row', { hasText: 'Name a review rota' }).innerText()), 'P2: changing the owner on the goal page did not take');
      // Anyone can add a next step; it asks who and by when.
      await p.getByRole('button', { name: 'Add a next step' }).first().click();
      await p.getByRole('dialog').locator('textarea').fill('Audit CODEOWNERS for the payments repositories');
      await p.getByRole('dialog').getByRole('button', { name: 'Add the next step' }).click();
      fail(await p.getByRole('dialog').getByRole('alert').filter({ hasText: 'Choose the week' }).isVisible().catch(() => false), 'P2: a next step was added with no date');
      await c.close();
    }

    return fails;
  },
};
