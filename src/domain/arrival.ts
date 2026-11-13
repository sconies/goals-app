/* Welcome and the arrival (set-up spec ST1: 2.1 and 2.8): what a pasted invitation opens, the one true line under each
   name on the arrival, and where a set-up left unfinished stopped. Pure; apart from dayOne.ts so the first download
   (Home) doesn't carry what only these two screens say. */
import type { Person } from './types';
import { invitedTo, stepCounter, type SetupStep } from './dayOne';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const ALL: SetupStep[] = ['workspace', 'you', 'team', 'start', 'outcome', 'goals', 'check'];

/** Each set-up step's name, as Welcome says where a draft stopped and the steps' heads say it. */
export const SETUP_STEP_NAMES: Record<SetupStep, string> = { workspace: 'Workspace', you: 'You', team: 'Your team', start: 'Starting point', outcome: 'Outcome', goals: 'Goals', check: 'Check' };

/**
 * Welcome's "Join a workspace you were invited to" (2.1): what a pasted link opens, or why it opens nothing. Only this
 * site's `/join/…` or `/?workspace=…` is an invitation; `demo` is whether it opens in the demo.
 */
export function readInvitation(text: string, origin: string): { id: string; demo: boolean } | { problem: string } {
  const problem = `That isn’t a Faro invitation. It looks like ${origin}/join/…`;
  let u: URL;
  try { u = new URL(text.trim(), origin); } catch { return { problem }; }
  if (u.origin !== origin || !text.trim()) return { problem };
  const id = invitedTo(u.pathname, u.search);
  if (!id || (!/\/join\//.test(u.pathname) && !/^\/(demo\/?)?$/.test(u.pathname))) return { problem };
  return { id, demo: u.pathname === '/demo' || u.pathname.startsWith('/demo/') };
}

/** The one true line under a name on the arrival screen (2.8): who set it up, an admin, what they own, or nothing yet. */
export function arrivalLine(p: Pick<Person, 'id' | 'admin'>, creatorId: string | null, owns: number): string {
  if (p.id === creatorId) return 'Set this up · admin';
  if (p.admin) return 'Admin';
  return owns ? `Owns ${n(owns, 'goal', 'goals')}` : 'No goals yet';
}

/** The arrival's opening line (2.8): who set it up, when, and what is in it. */
export function arrivalIntro(ws: { name: string; createdAt: string }, admin: string | null, people: number, goals: number): string {
  const what = `${n(people, 'person', 'people')}, ${goals ? n(goals, 'goal', 'goals') : 'no goals yet'}`;
  return admin && ws.createdAt
    ? `${admin} set this up on ${shortDate(ws.createdAt)} to keep the team’s goals in one place: ${what}.`
    : `${ws.name} keeps the team’s goals in one place: ${what}.`;
}

/** Where a set-up left unfinished stopped (Welcome, 2.1): "Stopped at step 3 of 7, Your team, on 9 Nov." */
export function draftStopped(d: { step?: number; template?: string; savedAt?: string }): string {
  const step = ALL[Math.min(Math.max(d.step ?? 0, 0), ALL.length - 1)]!;
  const counter = stepCounter(step, d.template ?? '');
  return `Stopped at ${counter.charAt(0).toLowerCase()}${counter.slice(1)}, ${SETUP_STEP_NAMES[step]}${d.savedAt ? `, on ${shortDate(d.savedAt)}` : ''}. Nothing is saved yet.`;
}
