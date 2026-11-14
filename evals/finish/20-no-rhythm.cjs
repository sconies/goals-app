/* F20: with no set check-in rhythm, nothing says what is due, late or on time (FT1, docs/design/feature-toggles/spec.md
   section 9). run({ open, url }) returns a list of failures. As Amara, an admin, the rhythm is set to none on Features;
   then, as Rhea, an owner, at 1440 and 390 px, none of the core screens says “No recent update”, “due by”, “to do”,
   “streak”, “on time”, or “Can’t say”, and a goal's History has no “No check-in” row. (Reviews off is FT2's half: N21.) */
const ROUTES = ['/', '/check-in', '/goals?scope=all', '/goals?scope=all&layout=board', '/watching', '/people', '/activity', '/goals/ns-lead', '/goals/ns-lead?history=all'];
const NEVER = [/No recent update/i, /due by/i, /\bto do\b/i, /streak/i, /on time/i, /Can’t say/];

module.exports = {
  id: 'F20',
  area: 'rhythm',
  reqs: ['RHYTHM-OPTIONAL', 'FIT-AND-FINISH'],
  title: 'With no set check-in rhythm, no screen says what is due, late, quiet or on time, at either width',
  async run({ open, url }) {
    const fails = [];
    const [c, p] = await open(1440, 900, 'amara', '/workspace/features');
    await p.locator('.rhythm-row').getByRole('button', { name: 'Change' }).click();
    const sheet = p.getByRole('dialog', { name: 'Check-in rhythm' });
    await sheet.getByRole('radio', { name: /No set rhythm/ }).click();
    await sheet.getByRole('button', { name: 'Save' }).click();
    await p.getByText('Check-ins have no set rhythm now.').first().waitFor();
    await p.evaluate(() => localStorage.setItem('goals-app-viewer:platform-org', 'rhea'));
    for (const width of [1440, 390]) {
      await p.setViewportSize({ width, height: width > 800 ? 900 : 844 });
      for (const route of ROUTES) {
        await p.goto(url(route));
        await p.locator('main').first().waitFor();
        await p.waitForTimeout(300);
        // What the screen says, less what people wrote or asked: a goal's own title ("…completed on time") and an ask's
        // date ("Due by Tue 10 Nov · Daniel asked in …", the date a question is wanted by, not a check-in) aren't the rhythm.
        const raw = await p.locator('main').innerText().catch(() => '');
        const titles = new Set((await p.locator('main .trow-name, main h1').allInnerTexts().catch(() => [])).map((t) => t.trim()));
        const text = raw.split('\n').filter((l) => !titles.has(l.trim()) && !/^(Was )?due by .* · .+ asked\b/i.test(l.trim())).join('\n');
        for (const re of NEVER) { const m = text.match(re); if (m) fails.push(`${width}px ${route}: says “${m[0]}” with no set rhythm`); }
        if (/history=/.test(route) && /Week \d+ · No check-in|No check-ins \(\d+ weeks\)/.test(text)) fails.push(`${width}px ${route}: History has a “No check-in” row with no set rhythm`);
      }
    }
    await c.close();
    return fails;
  },
};
