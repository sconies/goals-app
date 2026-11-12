/* Where people are in the named flows (src/help/flows.ts): which flows they've started, the step each has reached,
   and when one finishes or is left without finishing. Fed the route on each page change, each named action that
   worked, and each mark a screen sets; returns what happened, for telemetry to record. Pure: no browser needed. */
import { routeScore } from '../help/match';
import { FLOWS, type Flow, type FlowStep } from '../help/flows';

export interface FlowEvent {
  event: 'start' | 'step' | 'finish' | 'stop';
  flow: string;
  step: string;
  /** 1-based: "step 2 of 3". */
  index: number;
  count: number;
  durationMs: number;
  reason?: 'left' | 'closed';
}

interface Active { flow: Flow; index: number; startedAt: number }
type Hit = { route: [string, string] } | { action: string } | { mark: string };

const matches = (s: FlowStep, hit: Hit) =>
  'route' in hit ? (s.routes ?? []).some((r) => routeScore(r, hit.route[0], hit.route[1]) !== null)
    : 'action' in hit ? (s.actions as string[] | undefined ?? []).includes(hit.action)
      : (s.marks as string[] | undefined ?? []).includes(hit.mark);

export class FlowTracker {
  private active: Active[] = [];
  private pending = 0;
  private deferred: [string, string] | null = null;

  constructor(private readonly flows: Flow[] = FLOWS, private readonly now: () => number = () => Date.now()) {}

  private ev(a: Active, event: FlowEvent['event'], reason?: FlowEvent['reason']): FlowEvent {
    return { event, flow: a.flow.id, step: a.flow.steps[a.index]!.id, index: a.index + 1, count: a.flow.steps.length, durationMs: Math.max(0, this.now() - a.startedAt), ...(reason ? { reason } : {}) };
  }

  /** Moves the flows this reaches on, and starts the ones it can start. */
  private hit(hit: Hit): FlowEvent[] {
    const out: FlowEvent[] = [];
    for (const a of [...this.active]) {
      // The furthest step it reaches; going back to an earlier step (the agenda between goals) isn't a new step.
      const at = a.flow.steps.map((s, i) => (matches(s, hit) ? i : -1)).reduce((m, i) => Math.max(m, i), -1);
      if (at > a.index) {
        a.index = at;
        if (at === a.flow.steps.length - 1) { out.push(this.ev(a, 'finish')); this.active = this.active.filter((x) => x !== a); } else out.push(this.ev(a, 'step'));
      } else if (at < 0 && 'route' in hit) {
        // A page that isn't part of it: they left without finishing.
        out.push(this.ev(a, 'stop', 'left'));
        this.active = this.active.filter((x) => x !== a);
      } else if (at < 0 && 'mark' in hit && (a.flow.closedBy as string[] | undefined)?.includes(hit.mark)) {
        out.push(this.ev(a, 'stop', 'closed'));
        this.active = this.active.filter((x) => x !== a);
      }
    }
    for (const flow of this.flows) {
      if (this.active.some((a) => a.flow === flow) || out.some((e) => e.flow === flow.id && e.event !== 'stop')) continue;
      const i = flow.steps.findIndex((s, n) => (n === 0 || s.entry) && matches(s, hit));
      if (i < 0 || i === flow.steps.length - 1) continue;
      const a = { flow, index: i, startedAt: this.now() };
      this.active.push(a);
      out.push(this.ev(a, 'start'));
    }
    return out;
  }

  /** The page changed. While an action is saving, wait for it: a page change that follows a save isn't leaving. */
  route(pathname: string, search = ''): FlowEvent[] {
    if (this.pending > 0) { this.deferred = [pathname, search]; return []; }
    return this.hit({ route: [pathname, search] });
  }

  mark(name: string): FlowEvent[] { return this.hit({ mark: name }); }

  actionStarted() { this.pending++; }

  /** A named action finished: one that worked moves its flows on. */
  actionEnded(name: string, ok: boolean): FlowEvent[] {
    this.pending = Math.max(0, this.pending - 1);
    const out = ok ? this.hit({ action: name }) : [];
    if (this.pending === 0 && this.deferred) { const d = this.deferred; this.deferred = null; out.push(...this.hit({ route: d })); }
    return out;
  }

  /** The page is closing: every flow still open stops where it got to. */
  leave(): FlowEvent[] {
    const out = this.active.map((a) => this.ev(a, 'stop', 'closed'));
    this.active = [];
    return out;
  }

  current(): { flow: string; step: string; index: number; count: number }[] {
    return this.active.map((a) => ({ flow: a.flow.id, step: a.flow.steps[a.index]!.id, index: a.index + 1, count: a.flow.steps.length }));
  }
}
