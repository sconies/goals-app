/* find_goals' `fields: { Stage: "Build" }` (TG2, rule 3): each name a live list field, each value one or more of its
   values (or Not set), as the parameters Goals reads (?f.<field id>=Build). Loaded only when the argument is used
   (records.ts), so the first download doesn't carry it. */
import type { Snapshot } from '../../domain/types';
import { filterParam, NOT_SET, pickedText } from './filter';
import { fieldByName, liveFields } from './fields';
import { valueProblem } from './rules';

/** The parameters find_goals' `fields` means; anything else is an Error in words. */
export async function fieldParams(s: Snapshot, asked: Record<string, unknown>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, v] of Object.entries(asked)) {
    const f = fieldByName(s, name);
    // In set_goal_fields' words (tools.ts).
    if (!f) throw new Error(`There’s no field called ${name}. Fields: ${liveFields(s).map((x) => x.name).join(', ') || 'none yet'}.`);
    if (f.kind === 'text') throw new Error(`${f.name} is free text, so it can’t filter goals: only a list field can.`);
    const typed = (Array.isArray(v) ? v.map(String) : String(v ?? '').split(',')).map((x) => x.trim()).filter(Boolean);
    if (!typed.length) throw new Error(`Say which of ${f.name}’s values to find: ${[...f.options, NOT_SET].join(', ')}.`);
    const picked: string[] = [];
    for (const t of typed) {
      if (t.toLowerCase() === NOT_SET.toLowerCase()) { picked.push(NOT_SET); continue; }
      const r = valueProblem(f, t);
      if ('problem' in r) throw new Error(`${r.problem} Or ${NOT_SET}, for goals with no value.`);
      picked.push(r.value);
    }
    out[filterParam(f.id)] = pickedText(f, picked);
  }
  return out;
}

