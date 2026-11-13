/* A goal's share image and link (approved by Lane, 5 Nov: an image plus a link). Used by the goal page's Share and by
   the check-in's receipt when a goal reaches its target (habit spec 2.2), which loads it only when pressed. */
import type { AppState } from '../app/state';
import { saveFile } from '../app/files';
import { isEveryday, levelName } from '../domain/levels';
import { valueSeries } from '../domain/plan';
import { assessPosted, LABEL } from '../domain/status';
import { projects } from '../domain/scorecard';
import type { DisplayStatus, Goal, MetricGoal } from '../domain/types';
import { shareCardPng, type ShareCard } from '../ui/shareCard';

const goalLink = (app: AppState, goal: Goal) => `${window.location.origin}${app.mode === 'demo' ? '/demo' : ''}/goals/${goal.key ?? goal.id}`;
const copyText = async (text: string) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

export async function copyGoalLink(app: AppState, goal: Goal): Promise<void> {
  const link = goalLink(app, goal);
  const ok = await copyText(link);
  app.toast(ok ? 'Link copied' : `Couldn’t copy. The link is ${link}`, ok ? undefined : 'error');
}

/** A PNG of the summary bar and a small chart, with the goal's link: copied where the browser allows, saved otherwise. */
export async function shareGoalImage(app: AppState, goal: Goal, now: string, against: string[], why: string, status: DisplayStatus): Promise<void> {
  const owner = app.person(goal.ownerId);
  const series = valueSeries(app.checkInsOf(goal));
  const a = assessPosted(goal, app.cycle, app.snapshot.checkIns, app.week);
  const card: ShareCard = {
    workspace: app.ws.name.replace(/^Example:\s*/, ''), title: goal.title, owner: owner?.name ?? '',
    meta: [!isEveryday(app.cycle, goal.level) ? levelName(app.cycle, goal.level) : '', goal.key ?? ''].filter(Boolean).join(' · '),
    status, statusWord: LABEL[status], now, against: against.join(' · '), why,
    when: `Week ${app.week} · ${app.today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    link: goalLink(app, goal),
    chart: goal.kind === 'metric' && a.kind === 'metric' ? { goal: goal as MetricGoal, weeks: app.cycle.weeks, week: app.week, series, projection: projects(goal, status) ? a.projection : null } : null,
  };
  try {
    const png = await shareCardPng(card);
    const url = goalLink(app, goal);
    let copied = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const CI = (window as any).ClipboardItem as typeof ClipboardItem | undefined;
      if (CI && navigator.clipboard?.write) {
        await navigator.clipboard.write([new CI({ 'image/png': png, 'text/plain': new Blob([url], { type: 'text/plain' }) })]);
        copied = true;
      }
    } catch { copied = false; }
    if (copied) app.toast('Copied an image of this goal, with its link');
    else {
      await saveFile({ workspace: app.ws.name, what: 'goal', scope: goal.key ?? goal.title, date: app.today }, { kind: 'png', blob: png });
      app.toast(await copyText(url) ? 'Saved an image of this goal, and copied its link' : `Saved an image of this goal. Its link is ${url}`);
    }
  } catch (e) {
    app.toast('Couldn’t make the image: ' + (e instanceof Error ? e.message : String(e)), 'error');
  }
}
