/* Leaving rows out (backlog IM3; docs/design/import/spec.md, rule 8 and decision 1). An import saves all or nothing,
   unless the person chooses to leave named rows out and save the rest. Rows that depend on a row left out go with it,
   and each says why: a new goal's check-ins (named by the goal's name, as a new goal has no key yet), goals that feed
   into it, and goals and Takes-over cells that name a new person left out. Pure: no screen, network or database code. */
import { fold } from './problemLevels';
import type { Sheet } from './problemLevels';
import type { Rec, Tables } from './sheets';

export interface RowRef { sheet: Sheet; row: number }
export interface DependentRow extends RowRef { because: string }

const KEY: Record<Sheet, keyof Tables> = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const v = (r: Rec, k: string) => (r[k] ?? '').trim();
const rowOf = (r: Rec, i: number) => Number(r.__row ?? i + 2);

/** Whether a row adds a record (a goal with no Key or ID, a person with no ID): what may depend on it. */
export type IsNew = (sheet: Sheet, r: Rec) => boolean;
const NEW: IsNew = (sheet, r) => (sheet === 'Goals' ? !v(r, 'key') && !v(r, 'id') : sheet === 'People' ? !v(r, 'id') : false);

/**
 * Rule 8. The tables without the rows named and without the rows that depend on them; `also` lists the dependants,
 * each with why ("Feeds into names row 44"). `isNew` says which rows add a record (by default, a goal with no Key or ID
 * and a person with no ID; the app passes one that also knows who is already here).
 */
export function leaveOut(tables: Tables, rows: readonly RowRef[], isNew: IsNew = NEW): { tables: Tables; also: DependentRow[] } {
  const out = new Set(rows.map((x) => `${x.sheet}:${x.row}`));
  const also: DependentRow[] = [];
  const add = (sheet: Sheet, row: number, because: string) => { const k = `${sheet}:${row}`; if (out.has(k)) return false; out.add(k); also.push({ sheet, row, because }); return true; };
  const list = (sheet: Sheet) => (tables[KEY[sheet]] ?? []).map((r, i) => ({ r, row: rowOf(r, i) }));
  const goals = list('Goals');
  const people = list('People');
  const checkIns = list('Check-ins');

  // A person left out: the goals they would own, and the people they would take over from.
  for (const { r, row } of people.filter((x) => out.has(`People:${x.row}`) && isNew('People', x.r))) {
    const email = v(r, 'email').toLowerCase();
    const name = fold(v(r, 'name'));
    const names = (cell: string) => !!cell && (cell.toLowerCase() === email || (!!name && fold(cell) === name));
    for (const g of goals) if (names(v(g.r, 'owner email')) || (!v(g.r, 'owner email') && names(v(g.r, 'owner')))) add('Goals', g.row, `its owner is People row ${row}`);
    for (const p of people) if (names(v(p.r, 'takes over'))) add('People', p.row, `Takes over names People row ${row}`);
  }
  // A new goal left out (and, in turn, each goal that leaves with it): its check-ins and the goals that feed into it.
  const queue = goals.filter((x) => out.has(`Goals:${x.row}`));
  while (queue.length) {
    const { r, row } = queue.shift()!;
    if (!isNew('Goals', r)) continue;
    const title = fold(v(r, 'goal'));
    // Its Ref (backlog BT) names it as surely as its name: a row naming that Ref leaves with it.
    const tag = fold(v(r, 'ref'));
    for (const c of checkIns) if ((tag && fold(v(c.r, 'goal ref')) === tag) || (title && !v(c.r, 'goal ref') && !v(c.r, 'goal key') && !v(c.r, 'goal id') && fold(v(c.r, 'goal')) === title)) add('Check-ins', c.row, `it is a check-in for Goals row ${row}`);
    for (const g of goals) if (((tag && fold(v(g.r, 'feeds into ref')) === tag) || (title && !v(g.r, 'feeds into ref') && !v(g.r, 'feeds into key') && fold(v(g.r, 'feeds into')) === title)) && add('Goals', g.row, `Feeds into names Goals row ${row}`)) queue.push(g);
  }
  const kept: Tables = {};
  for (const sheet of Object.keys(KEY) as Sheet[]) {
    const t = tables[KEY[sheet]];
    if (t) kept[KEY[sheet]] = t.filter((r, i) => !out.has(`${sheet}:${rowOf(r, i)}`));
  }
  return { tables: kept, also };
}
