/* Stage weeks counted from now, and whether a file's goal has history: what the import's stage Check reads. (The
   four example templates set-up once offered are gone: a workspace begins with real goals or none, set-up spec 2.6.) */

/**
 * Stage weeks count from now, not from the start of the year: set up in week 43, "Design@3" is due in week 45.
 * Stages are spread over the weeks left when they would run past the year's end.
 */
export function stagesFromNow(stages: string, week: number, weeks = 52): string {
  const parts = stages.split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^(.*?)\s*@\s*(\d+)\s*$/.exec(x);
    return m ? { name: m[1]!, at: Number(m[2]) } : { name: x, at: null };
  });
  const last = Math.max(1, ...parts.map((p) => p.at ?? 0));
  const room = Math.max(1, weeks - Math.max(0, week));
  const scale = Math.min(1, room / last);
  return parts.map((p) => (p.at == null ? p.name : `${p.name}@${Math.min(weeks, Math.max(0, week) + Math.max(1, Math.round(p.at * scale)))}`)).join('; ');
}

/** Whether a file's Check-ins sheet has a row for a Goals row (by key, ID or title): a goal with history keeps its weeks. */
export function reportedIn(checkIns: Record<string, string>[] | undefined): (g: Record<string, string>) => boolean {
  const low = (v: string | undefined) => (v ?? '').trim().toLowerCase();
  const keys = new Set<string>();
  for (const c of checkIns ?? []) for (const [col, as] of [['goal key', 'k'], ['goal id', 'i'], ['goal', 't']] as const) if (low(c[col])) keys.add(as + low(c[col]));
  return (g) => (!!low(g['key']) && keys.has('k' + low(g['key']))) || (!!low(g['id']) && keys.has('i' + low(g['id']))) || (!!low(g['goal']) && keys.has('t' + low(g['goal'])));
}

