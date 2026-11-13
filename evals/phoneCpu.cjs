/* A phone's slower CPU, in every eval run (Lane, 13 Nov). Every browser context no wider than a phone runs its pages with
   the CPU slowed PHONE_CPU times (4 unless the environment says otherwise; PHONE_CPU=1 turns it off), through the
   DevTools protocol's Emulation.setCPUThrottlingRate. A fast laptop and a loaded CI runner then both run a phone as a
   slow phone, so a race that only shows on a slow phone (U109's keys outrunning a render, U98's Stop gone before the
   click) shows on every run, a pull request's included, instead of now and then after the merge.
   It slows a page's own thread, not its workers (an import's check runs in one): a worker's time is the machine's.
   Desktop-sized contexts are left at full speed, so a timing check measured on a desktop (N12) means what it did. */

/** The widest viewport that counts as a phone: a phone held either way, not a tablet. */
const PHONE_MAX_WIDTH = 600;
/** How many times slower a phone's CPU runs than the machine's. */
const PHONE_CPU = Math.max(1, Number(process.env.PHONE_CPU ?? 4) || 1);

const isPhone = (opts) => (opts?.viewport?.width ?? Infinity) <= PHONE_MAX_WIDTH;

/** Slows one page's CPU, once per page; every caller waits for the same slowing to be in place. */
const slowed = new WeakMap();
function slow(context, page) {
  if (!slowed.has(page)) slowed.set(page, context.newCDPSession(page).then((cdp) => cdp.send('Emulation.setCPUThrottlingRate', { rate: PHONE_CPU })));
  return slowed.get(page);
}

/**
 * The browser, with every phone-sized context slowed: a page it opens is slowed before `newPage` returns, so the first
 * navigation already runs slow; a page it opens itself (a link to a new tab) is slowed as it appears.
 */
function withPhoneCpu(browser) {
  if (PHONE_CPU <= 1) return browser;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const context = await newContext(opts);
    if (!isPhone(opts)) return context;
    const newPage = context.newPage.bind(context);
    context.newPage = async () => { const page = await newPage(); await slow(context, page); return page; };
    context.on('page', (page) => { slow(context, page).catch(() => {}); });
    return context;
  };
  return browser;
}

module.exports = { withPhoneCpu, isPhone, PHONE_CPU, PHONE_MAX_WIDTH };
