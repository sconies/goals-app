/* N8: observability, release 1. run({ browser, down }) returns a list of failures.
   Runs the demo from the build that has a database address (DOWN), so telemetry has somewhere to send, and catches
   every insert to the telemetry tables with Playwright routing. At a phone and a desktop width:
   [TELEMETRY-SIGNALS] [TELEMETRY-FLOWS] a check-in sends, in one trace, the action, its save timed as a CLIENT span,
   the page showing the result and the check-in flow's finish; every span is OpenTelemetry's shape.
   [TELEMETRY-PRIVACY] a distinctive string typed into the check-in and a comment (and put in a search) never appears in
   any request.
   [TELEMETRY-SWITCH] once an admin turns recording off on Workspace, nothing is sent, after a reload too, and Settings
   says it's off.
   [TELEMETRY-SIGNALS] when the telemetry tables answer 404 the app carries on with no error of its own in the console
   (the browser's own "Failed to load resource" network line is not the app's) and sends at most a request or two. */
const SIZES = [[390, 844, true], [1280, 800, false]];
const SECRET = 'Quokka-marmalade-5521';
const TODAY = '2026-11-05';
const HEX32 = /^[0-9a-f]{32}$/, HEX16 = /^[0-9a-f]{16}$/;

module.exports = {
  id: 'N8',
  area: 'telemetry',
  title: 'Telemetry: one trace from action to save to result, nothing anyone types, nothing at all when switched off, and quiet when it can’t send',
  reqs: ['TELEMETRY-SIGNALS', 'TELEMETRY-PRIVACY', 'TELEMETRY-FLOWS', 'TELEMETRY-SWITCH'],
  async run({ browser, down }) {
    const fails = [];
    const fail = (ok, msg) => { if (!ok) fails.push(msg); };
    if (!down) return ['N8 needs the build with a database address (DOWN) to catch what telemetry sends'];
    const url = (p) => down + '/demo' + p + (p.includes('?') ? '&' : '?') + 'today=' + TODAY;

    async function open(w, h, touch, who, status = 201) {
      const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 800 });
      const sent = [];
      const errors = [];
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      await c.route(/\/rest\/v1\/okr_telemetry_/, async (route) => {
        const r = route.request();
        if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        sent.push({ at: Date.now(), url: r.url(), body: r.postData() || '' });
        return route.fulfill({ status, headers: cors, body: status === 404 ? '{"code":"42P01","message":"relation does not exist"}' : '' });
      });
      const p = await c.newPage();
      // A step that can't happen fails in seconds, not half a minute each.
      p.setDefaultTimeout(8000);
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      p.on('pageerror', (e) => errors.push('page error: ' + e.message));
      await p.goto(url('/'));
      await p.evaluate((v) => localStorage.setItem('goals-app-viewer:platform-org', v), who);
      return { c, p, sent, errors };
    }
    // What the page sends when it's hidden (switching tabs, closing): the quickest way to see what's waiting.
    const hide = (p) => p.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    }).catch(() => {});
    // A full page load: what's waiting goes when the page is hidden first. (Playwright can't see the keepalive
    // requests a page sends as it unloads, though browsers send them, so the check hides the page before leaving.)
    const go = async (p, path) => { await hide(p); await p.waitForTimeout(250); await p.goto(url(path)); };
    const rows = (sent, table) => sent.filter((s) => s.url.includes(table)).flatMap((s) => { try { return JSON.parse(s.body); } catch { return []; } });
    const waitFor = async (p, test, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return true; await p.waitForTimeout(150); } return test(); };

    async function checkIn(p) {
      await p.goto(url('/check-in/dep-jenkins'));
      const g = await p.evaluate(async () => (await window.__goalsStore.load('platform-org')).goals.find((x) => x.id === 'dep-jenkins'));
      await p.getByLabel('This week’s value').fill(String(g.plan.start));
      await p.getByRole('button', { name: 'Continue' }).click();
      const changed = p.getByRole('button', { name: 'Something changed', exact: true });
      if (await changed.count()) await changed.click();
      await p.getByRole('group', { name: 'Main cause' }).getByRole('button', { name: 'Something else' }).click();
      await p.getByLabel('What happened').fill(SECRET + ' moved the Jenkins job owners');
      await p.getByRole('button', { name: 'Post check-in' }).click();
      await p.getByText('Check-in saved').first().waitFor({ timeout: 5000 });
    }

    for (const [w, h, touch] of SIZES) {
      // ---------- On: one trace from the action to its save to the result, and nothing typed ----------
      {
        const { c, p, sent } = await open(w, h, touch, 'chen');
        try {
          await checkIn(p);
          await go(p, '/goals/dep-jenkins');
          await p.getByLabel('Add a comment').fill(SECRET + ' said the vendor');
          await p.getByRole('button', { name: 'Post comment' }).click();
          await p.getByText(SECRET + ' said the vendor').first().waitFor({ timeout: 3000 });
          await go(p, '/goals?q=' + encodeURIComponent(SECRET));
          await p.locator('main h1').first().waitFor();
          await p.waitForTimeout(300);
          await hide(p);
          await waitFor(p, () => rows(sent, 'okr_telemetry_spans').some((s) => s.name === 'addNote'));
          const spans = rows(sent, 'okr_telemetry_spans');
          const bad = spans.filter((s) => !HEX32.test(s.trace_id) || !HEX16.test(s.span_id) || (s.parent_span_id !== null && !HEX16.test(s.parent_span_id)) || !['INTERNAL', 'CLIENT', 'SERVER'].includes(s.kind) || !['UNSET', 'OK', 'ERROR'].includes(s.status_code) || !(s.duration_ms >= 0) || !s.resource || s.resource['service.name'] !== 'goals-app' || s.resource['deployment.environment'] !== 'demo');
          fail(spans.length > 0 && !bad.length, `[TELEMETRY-SIGNALS] ${w}: ${spans.length} spans sent, ${bad.length} not OpenTelemetry’s shape (${bad.slice(0, 2).map((s) => s.name).join(', ')})`);
          const action = spans.find((s) => s.name === 'postCheckIn');
          const trace = action ? spans.filter((s) => s.trace_id === action.trace_id) : [];
          const has = {
            page: trace.some((s) => /^page \//.test(s.name)),
            action: !!action && action.parent_span_id === null && action.attributes['app.action.name'] === 'postCheckIn',
            rpc: trace.some((s) => s.kind === 'CLIENT' && s.parent_span_id === action.span_id && !!s.attributes['db.operation'] && !!s.attributes['db.system']),
            flow: trace.some((s) => s.name === 'flow.finish' && s.attributes['app.flow.name'] === 'check-in'),
          };
          fail(Object.values(has).every(Boolean), `[TELEMETRY-SIGNALS] ${w}: the check-in’s trace has ${Object.entries(has).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}`);
          const flow = spans.filter((s) => s.attributes['app.flow.name'] === 'check-in').map((s) => `${s.attributes['app.flow.event']} ${s.attributes['app.flow.step']} ${s.attributes['app.flow.step.index']}/${s.attributes['app.flow.step.count']}`);
          fail(['start open 1/3', 'step explain 2/3', 'finish post 3/3'].every((x) => flow.includes(x)), `[TELEMETRY-FLOWS] ${w}: the check-in flow recorded ${flow.join(', ') || 'nothing'}`);
          const page = spans.find((s) => s.attributes['http.route'] === '/goals/:goalId' && /^page /.test(s.name));
          fail(!!page && page.attributes['url.path'] === '/goals/dep-jenkins' && page.attributes['session.id'] && page.attributes['user.id'] === 'chen', `[TELEMETRY-SIGNALS] ${w}: no page span for /goals/:goalId with its path, session and person`);
          const leaked = sent.filter((s) => s.body.includes('Quokka') || s.url.includes('Quokka') || s.body.includes('marmalade'));
          fail(!leaked.length, `[TELEMETRY-PRIVACY] ${w}: what was typed appears in ${leaked.length} requests (${leaked.map((s) => s.url.split('/').pop()).join(', ')})`);
        } catch (e) { fail(false, `[TELEMETRY-SIGNALS] ${w}: ${String(e.message || e).split('\n')[0]}`); }
        await c.close();
      }

      // ---------- Off: an admin turns recording off on Workspace, and nothing more is sent ----------
      {
        const { c, p, sent } = await open(w, h, touch, 'grace');
        try {
          await p.goto(url('/workspace'));
          const box = p.getByRole('checkbox', { name: /Record how the app is used/ });
          await box.scrollIntoViewIfNeeded();
          fail(await box.isChecked(), `[TELEMETRY-SWITCH] ${w}: recording isn’t on to start with`);
          if (touch) { const b = await p.locator('.record-check').boundingBox(); fail(b && b.height >= 44, `[TELEMETRY-SWITCH] ${w}: the switch is ${b && Math.round(b.height)}px tall on touch`); }
          await box.uncheck();
          await p.getByText(/Recording is off in/).first().waitFor({ timeout: 3000 });
          await p.waitForTimeout(150);
          const off = Date.now();
          await p.goto(url('/goals/ns-lead'));
          await p.getByLabel('Add a comment').fill('Checked with the team');
          await p.getByRole('button', { name: 'Post comment' }).click();
          await p.goto(url('/settings'));
          const said = await p.locator('#set-rec').locator('..').innerText().catch(() => '');
          fail(/Recording is off in/.test(said), `[TELEMETRY-SWITCH] ${w}: Settings doesn’t say recording is off`);
          await hide(p);
          await p.waitForTimeout(5600);
          await p.reload();
          await p.locator('main h1').first().waitFor();
          await hide(p);
          await p.waitForTimeout(400);
          const after = sent.filter((s) => s.at > off);
          fail(!after.length, `[TELEMETRY-SWITCH] ${w}: ${after.length} requests sent after recording was turned off`);
          await p.goto(url('/workspace'));
          fail(!(await p.getByRole('checkbox', { name: /Record how the app is used/ }).isChecked()), `[TELEMETRY-SWITCH] ${w}: the switch didn’t stay off after a reload`);
        } catch (e) { fail(false, `[TELEMETRY-SWITCH] ${w}: ${String(e.message || e).split('\n')[0]}`); }
        await c.close();
      }

      // ---------- The tables aren't there (404): the app carries on, quietly ----------
      {
        const { c, p, sent, errors } = await open(w, h, touch, 'chen', 404);
        try {
          await checkIn(p);
          for (const route of ['/', '/goals', '/goals/dep-jenkins', '/settings']) { await p.goto(url(route)); await p.locator('main h1, main .home-hero').first().waitFor(); await hide(p); }
          await p.waitForTimeout(600);
          const own = errors.filter((t) => !/^Failed to load resource/.test(t));
          fail(!own.length, `[TELEMETRY-SIGNALS] ${w}: console errors when the telemetry tables answer 404: ${own.slice(0, 2).join(' | ')}`);
          // One refusal stops it for the rest of a visit: at most one request for each of the six page loads here.
          fail(sent.length <= 6, `[TELEMETRY-SIGNALS] ${w}: ${sent.length} requests to tables that answer 404 over six page loads`);
        } catch (e) { fail(false, `[TELEMETRY-SIGNALS] ${w} (404): ${String(e.message || e).split('\n')[0]}`); }
        await c.close();
      }
    }
    return fails;
  },
};
