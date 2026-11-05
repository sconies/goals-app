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
  reqs: ['REVIEW-LIST-STATE', 'REVIEW-AGENDA'],
  async run({ open, url }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };

    // ---------- The Reviews list: state as shape and word, session date, last held, open actions, people ----------
    for (const [w, h] of [[390, 844], [768, 1024], [1280, 800]]) {
      const [c, p] = await open(w, h, 'elena', '/reviews', w < 800);
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
      fail(rows.length === 2, `List: ${rows.length} reviews listed at ${w}`);
      for (const r of rows) {
        fail(r.shape && STATE.test(r.state || ''), `List ${w}: ${r.name} state is "${r.state}" (shape ${r.shape})`);
        fail(/^(Mon|Tue|Wed|Thu|Fri) \d{1,2} [A-Z][a-z]{2}$/.test(r.facts.Session || r.facts.Next || ''), `List ${w}: ${r.name} has no session date (${JSON.stringify(r.facts)})`);
        fail(/^\d+$/.test(r.facts['Open actions'] || ''), `List ${w}: ${r.name} has no open-actions count`);
        fail(r.cut === 0, `List ${w}: ${r.name} has ${r.cut} clipped parts`);
      }
      const weekly = rows.find((r) => r.name === 'Platform weekly review');
      fail(!!weekly && weekly.facts['Last held'] === 'Thu 22 Oct', `List ${w}: weekly last held "${weekly?.facts['Last held']}", expected Thu 22 Oct (last week's note)`);
      fail(!!weekly && /Elena/.test(weekly.people) && /Leo/.test(weekly.people), `List ${w}: weekly's people are "${weekly?.people}"`);
      await c.close();
    }

    // ---------- The agenda: one line per goal, nothing cut off, at every width ----------
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [915, 832], [1024, 768], [1280, 800], [1440, 900], [2560, 1300]]) {
      const [c, p] = await open(w, h, 'elena', '/reviews/weekly', w <= 1024);
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
      const [c, p] = await open(1280, 800, 'elena', '/reviews/weekly');
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
      const [c, p] = await open(390, 844, 'elena', '/reviews/weekly', true);
      await p.getByRole('button', { name: /^Start review/ }).click();
      await p.locator('.reviewbar').waitFor();
      await p.getByRole('button', { name: 'Close the review' }).click();
      await p.waitForURL(/\/reviews\/weekly(\?|$)/);
      fail(await p.locator('.agenda-row').first().waitFor({ timeout: 3000 }).then(() => true, () => false), `Close (×): ${p.url()} shows no agenda`);
      await c.close();
    }

    // ---------- A whole session: say things, finish, the held review leading with what was said, and the list after ----------
    {
      const [c, p] = await open(1280, 900, 'elena', '/reviews/security');
      await p.getByRole('button', { name: /^Start review/ }).click();
      await p.locator('.decide').waitFor();
      await p.locator('.decide').getByRole('button', { name: 'Add a note' }).click();
      await p.getByPlaceholder('What the review said').fill('Access review slipped on the Brain export.');
      await p.getByRole('button', { name: 'Save note' }).click();
      await p.locator('.said').getByText('Access review slipped').waitFor();
      await p.locator('.decide .quiet-links').getByRole('button', { name: 'Add an action' }).click();
      await p.getByPlaceholder('What needs doing').fill('Agree the export scope with Legal');
      await p.getByRole('dialog').getByLabel('Who').selectOption({ label: 'Aisha Rahman' });
      await p.getByRole('dialog').getByLabel(/^By/).selectOption({ index: 2 });
      await p.getByRole('button', { name: 'Save action' }).click();
      await p.locator('.said').getByText('Agree the export scope').waitFor();
      await p.locator('.decide .quiet-links').getByRole('button', { name: /^Ask / }).click();
      await p.getByPlaceholder(/What would it take/).fill('Can SEC-88 land before week 47?');
      await p.getByRole('button', { name: 'Save question' }).click();
      await p.locator('.said').getByText('Can SEC-88').waitFor();
      // The healthy goal is still to mark, so the walk returns to the agenda, whose one action finishes it.
      await p.locator('.decide').getByRole('button', { name: /^Reviewed & / }).click();
      await p.waitForURL(/\/reviews\/security(\?|$)/);
      const mid = await p.locator('.review-line').innerText();
      fail(/1 of 2 reviewed/.test(mid), `Mid-session: the review says "${mid}"`);
      // The list says it's in progress, with how many reviewed.
      await p.goto(url('/reviews'));
      const st = await p.locator('.rv-line', { hasText: 'Security monthly' }).locator('.session-state').innerText();
      fail(st.trim() === 'In progress · 1 of 2 reviewed', `List mid-session: Security monthly says "${st}"`);
      await p.goto(url('/reviews/security'));
      await p.getByRole('button', { name: /^Mark 1 goal on track reviewed/ }).click();
      await p.locator('.review-home .session-record').waitFor({ timeout: 5000 }).catch(() => fail(false, `Finishing: ${p.url()} does not lead with what was said`));
      fail(/\/reviews\/security(\?|$)/.test(p.url()), `Finishing: landed on ${p.url()}, not the review`);
      const s = await p.evaluate(() => {
        const page = document.querySelector('.review-home');
        const blocks = [...page.children].filter((e) => e.getClientRects().length).map((e) => e.className);
        const prim = [...document.querySelectorAll('.btn.primary')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim());
        return {
          h1: document.querySelector('h1').textContent, t: page.innerText, prim, blocks,
          line: document.querySelector('.hero .review-line')?.innerText.trim(),
          record: document.querySelector('.session-record .block-title')?.innerText.trim(),
          reviewed: document.querySelectorAll('.session-record .agenda-row').length,
          print: [...page.querySelectorAll('a')].some((a) => /\/reviews\/security\/print$/.test(a.getAttribute('href')) && a.getClientRects().length),
          reviewsLink: [...page.querySelectorAll('a')].some((a) => /\/reviews(\?|$)/.test(a.getAttribute('href')) && a.getClientRects().length),
        };
      });
      fail(s.h1 === 'Security monthly' && /^Held Fri 30 Oct · next /.test(s.line || ''), `Held review: "${s.h1}", line "${s.line}"`);
      // What was said comes straight after the review's heading.
      fail(s.record === 'What was said' && s.blocks.indexOf('block session-record') === s.blocks.indexOf('hero') + 1, `Held review: the record is "${s.record}", page order ${s.blocks.join(' / ')}`);
      fail(/Access review slipped/.test(s.t) && /Can SEC-88 land/.test(s.t) && /Agree the export scope/.test(s.t), 'Held review: what was said is missing');
      fail(/Aisha Rahman · by week \d+, \d/.test(s.t), 'Held review: the action does not say who and by when');
      fail(s.reviewed === 2, `Held review: ${s.reviewed} goals listed as reviewed, expected 2`);
      fail(s.prim.length === 0 && s.print && s.reviewsLink, `Held review: primary actions ${s.prim.join(' / ')}, Print ${s.print}, link to Reviews ${s.reviewsLink}`);
      // The old summary address still works: it opens the review.
      await p.goto(url('/reviews/security/summary'));
      await p.waitForURL(/\/reviews\/security(\?|$)/, { timeout: 5000 }).catch(() => fail(false, `/summary: landed on ${p.url()}, not the review`));
      await p.goto(url('/reviews'));
      await p.locator('.rv-line').first().waitFor();
      const row = await p.evaluate(() => { const r = [...document.querySelectorAll('.rv-line')].find((x) => /Security monthly/.test(x.textContent)); return { state: r.querySelector('.session-state').innerText.trim(), text: r.innerText }; });
      fail(row.state === 'Held Fri 30 Oct' && /Open actions\s*1/.test(row.text), `List after: Security monthly says "${row.state}", ${row.text.replace(/\s+/g, ' ')}`);
      const weekly = await p.evaluate(() => [...document.querySelectorAll('.rv-line')].find((x) => /Platform weekly/.test(x.textContent)).querySelector('.session-state').innerText.trim());
      fail(weekly === 'Not started', `List after: Platform weekly says "${weekly}"`);
      await c.close();
    }

    // ---------- Walking every goal: "Reviewed & finish" goes straight to the held review and what was said ----------
    {
      const [c, p] = await open(390, 844, 'elena', '/reviews/security', true);
      await p.locator('.healthy-group summary').click();
      await p.getByRole('button', { name: 'Walk them one at a time instead' }).click();
      await p.getByRole('button', { name: /^Start review · 2 goals/ }).click();
      await p.locator('.decide').getByRole('button', { name: 'Reviewed & next' }).click();
      await p.locator('.decide').getByRole('button', { name: 'Reviewed & finish' }).click();
      await p.waitForURL(/\/reviews\/security(\?|$)/, { timeout: 5000 }).catch(() => fail(false, `Reviewed & finish: landed on ${p.url()}`));
      await p.locator('.review-home .session-record').waitFor({ timeout: 5000 }).catch(() => fail(false, 'Reviewed & finish: the review does not lead with what was said'));
      const m = await agendaReport(p);
      fail(m.rows === 2 && !m.clipped.length && !m.outside.length && m.sideways <= 1, `Held review at 390: ${m.rows} rows, clipped ${m.clipped.length}, sideways ${m.sideways}`);
      const btn = await p.getByRole('link', { name: 'Edit review setup' }).boundingBox();
      // Rounded like the message: a 2.75rem (44px) target can measure 43.99 after sub-pixel layout on some machines.
      fail(!!btn && n(btn.height) >= 44, `Held review at 390: Edit review setup is ${n(btn?.height)}px tall`);
      await c.close();
    }
    return fails;
  },
};
