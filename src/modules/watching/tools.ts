/* Watching's AI tools (SW1): what you watch, watch and stop watching. Their rules are still the core's
   (src/domain/actions.ts watch and unwatch, src/domain/review.ts watchedGoals) until SW6 moves them here; being this
   module's tools, the core's callTool refuses them with its switched-off sentence while Watching is off in the
   workspace, as for any module's. Every change is logged as the person, via the AI tool. */
import * as A from '../../domain/actions';
import { watchedGoals } from '../../domain/review';
import type { Watch } from '../../domain/types';
import type { ToolDef } from '../../mcp/tools';
import { listed } from '../../mcp/listed';
import { ax, goalOf, READ, save, WRITE } from '../../mcp/workTools';

const str = (description: string, extra: object = {}) => ({ type: 'string', description, ...extra });

const tools: ToolDef[] = [
  {
    name: 'list_watching',
    title: 'What you watch',
    description: 'Your watches (a goal, a goal and everything feeding it, or a whole level) and the goals they cover.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ,
    async run(_a, ctx) {
      const watches = ctx.snapshot.watches.filter((w) => w.personId === ctx.actor.id).map((w) => ({ id: w.id, kind: w.kind, ref: w.ref, what: w.kind === 'level' ? `every ${w.ref} goal` : ctx.snapshot.goals.find((g) => g.id === w.ref)?.title ?? w.ref }));
      const goals = watchedGoals(ctx.actor.id, ctx.snapshot).map((g) => ({ id: g.id, title: g.title }));
      return listed({ watches, goals });
    },
  },
  {
    name: 'watch',
    title: 'Watch goals',
    description: 'Watch a goal, a goal and everything feeding it, or every goal at a level. Watched goals are on the Watching page and in get_my_work.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['kind', 'ref'], properties: { kind: str('What to watch.', { enum: ['goal', 'tree', 'level'] }), ref: str('A goal’s ID or key (G-12), or a level (north-star, svp, team).') } },
    annotations: { ...WRITE, idempotentHint: true },
    async run(a, ctx) {
      const ref = a.kind === 'level' ? String(a.ref ?? '') : goalOf(ctx, a.ref).id;
      return save(ctx, A.watch(ax(ctx), a.kind as Watch['kind'], ref), `Watching ${a.kind === 'level' ? `every ${ref} goal` : goalOf(ctx, ref).title}`, 'Already watching that.');
    },
  },
  {
    name: 'unwatch',
    title: 'Stop watching',
    description: 'Stop one of your watches: the goals it covered leave your Watching page.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['watch_id'], properties: { watch_id: str('The watch’s ID, from list_watching.') } },
    annotations: WRITE,
    async run(a, ctx) { return save(ctx, A.unwatch(ax(ctx), String(a.watch_id ?? '')), 'Stopped watching', ''); },
  },
];

export default tools;
