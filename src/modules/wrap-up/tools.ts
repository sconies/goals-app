/* The Wrap-up's AI tools (SW1): read the year's wrap-up, and wrap up a goal. Their rules are still the core's
   (src/domain/actions.ts saveRetro, src/domain/cycle.ts) until SW8 moves them here; being this module's tools, the
   core's callTool refuses them with its switched-off sentence while the Wrap-up is off. Starting the next year
   (start_next_cycle) is the core's and works either way. */
import * as A from '../../domain/actions';
import { cycleDates, cycleState, dayWithYear, wrapUpOpenOn } from '../../domain/cycle';
import type { Retro } from '../../domain/types';
import type { ToolDef } from '../../mcp/tools';
import { ax, goalOf, name, READ, save, WRITE } from '../../mcp/workTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });

const tools: ToolDef[] = [
  {
    name: 'get_wrap_up',
    title: 'The cycle’s wrap-up',
    description: 'At the end of a cycle: which goals are wrapped up (result, what was learned, carry on or stop) and which are still to do.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const retros = ctx.snapshot.retros ?? [];
      const list = ctx.snapshot.goals.map((g) => { const r = retros.find((x) => x.goalId === g.id); return { id: g.id, title: g.title, owner: name(ctx, g.ownerId), wrappedUp: !!r, result: r?.result ?? null, learned: r?.learned ?? null, next: r?.next ?? null }; });
      // The wrap-up's days (cycle-end rule 1): it opens two weeks before the last day and closes four weeks after it.
      const open = wrapUpOpenOn(ctx.cycle, ctx.today);
      const d = cycleDates(ctx.cycle), state = cycleState(ctx.cycle, ctx.today);
      const when = state === 'closed' ? `The wrap-up closed on ${dayWithYear(d.wrapUpCloses)}.` : open ? `Wrap-up is open until ${dayWithYear(d.wrapUpCloses)}.` : `Wrap-up opens on ${dayWithYear(d.wrapUpOpens)}.`;
      return { data: { open, opensWeek: ctx.cycle.weeks - 1, opens: d.wrapUpOpens, lastDay: d.lastDay, closes: d.wrapUpCloses, goals: list }, text: `${when} ${list.filter((g) => g.wrappedUp).length} of ${list.length} goals wrapped up.` };
    },
  },
  {
    name: 'wrap_up_goal',
    title: 'Wrap up a goal',
    description: 'In the last two weeks of a cycle, the goal’s owner (or an admin) says how it landed, what was learned, and whether it carries on into the next cycle. Can be changed until the next cycle starts.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'result', 'learned', 'next'], properties: {
      goal_id: str('The goal’s ID or its key, e.g. G-12.'), result: str('How it landed.', { enum: ['hit', 'partly', 'missed'] }), learned: str('One thing worth knowing next time (a sentence).'), next: str('Next cycle.', { enum: ['carry', 'stop'] }),
    } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const g = goalOf(ctx, a.goal_id);
      if (!['hit', 'partly', 'missed'].includes(String(a.result))) throw new Error('result is hit, partly or missed.');
      if (!['carry', 'stop'].includes(String(a.next))) throw new Error('next is carry or stop.');
      return save(ctx, A.saveRetro(ax(ctx), g, { result: a.result as Retro['result'], learned: String(a.learned ?? ''), next: a.next as Retro['next'] }), `Wrapped up ${g.title}`, '');
    },
  },
];

export default tools;
