/* The app's telemetry, one per tab. It sends to the app's own Supabase (the telemetry tables of migration 0022) with
   the public key, which can add rows but never read them. With no database (the demo built without one, local
   development, the evals' build, unit tests) it records nothing and sends nothing. */
import { latestNewsId } from '../help/lookup';
import { Telemetry } from './client';
import { Exporter, supabaseTarget } from './exporter';
import { tabSessionId } from './ids';

export type { Problem, Step } from './client';

const env = import.meta.env;
const testing = env.MODE === 'test';
const demo = typeof location !== 'undefined' && (location.pathname === '/demo' || location.pathname.startsWith('/demo/'));

export const telemetry = new Telemetry({
  sessionId: tabSessionId(),
  exporter: new Exporter(testing ? null : supabaseTarget(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY)),
  resource: {
    'service.name': 'goals-app',
    // The release people see: the newest What's new entry.
    'service.version': latestNewsId() ?? 'unknown',
    'deployment.environment': testing ? 'test' : demo ? 'demo' : 'live',
    'telemetry.sdk.name': 'goals-telemetry',
    'telemetry.sdk.language': 'webjs',
    ...(typeof navigator !== 'undefined' ? { 'user_agent.original': navigator.userAgent.slice(0, 300) } : {}),
  },
});

/** The last steps of this tab's session, oldest first (at most 20), kept in memory only. */
export const recentSteps = () => telemetry.recentSteps();

/** This visit's errors and failed saves, oldest first (at most 25), kept in memory only. */
export const recentProblems = () => telemetry.recentProblems();

/** A screen moved on to a step of its own in a named flow (src/help/flows.ts). */
export const mark = (name: import('../help/flows').Mark) => { try { telemetry.mark(name); } catch { /* never in the way */ } };
