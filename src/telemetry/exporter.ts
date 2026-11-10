/* Sends what's recorded to the telemetry tables in batches: kept in memory, sent every few seconds and when the page
   is hidden or closed (with keepalive, so it survives the tab closing). It never gets in the app's way: no database,
   tables that aren't there yet, a refusal or a dead network all mean it quietly stops, without retrying in a loop and
   without a word in the console. Nothing is sent until the workspace's recording switch is known, and nothing at all
   while it is off. */
import { FARO_SCHEMA, faroFetch } from '../adapters/supabase/schema';
import type { LogRow, MetricRow, SpanRow } from './model';

export type Table = 'spans' | 'logs' | 'metrics';
type Row<T extends Table> = T extends 'spans' ? SpanRow : T extends 'logs' ? LogRow : MetricRow;

export const TABLES: Record<Table, string> = { spans: 'okr_telemetry_spans', logs: 'okr_telemetry_logs', metrics: 'okr_telemetry_metrics' };

/** Where batches go: Supabase's REST endpoint for the app's public key, in Faro's own schema (backlog 0c). */
export interface Target { url: string; key: string }

export function supabaseTarget(url: string | undefined, key: string | undefined): Target | null {
  if (!url || !key || !/^https?:\/\//.test(url)) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

/** keepalive requests share a 64 KB budget per page: stay under it. */
const KEEPALIVE_BYTES = 60_000;
/** Holds this many records at most while waiting; past it the oldest go. */
const MAX_BUFFER = 1000;

export interface ExporterOptions {
  fetch?: typeof fetch;
  intervalMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

export class Exporter {
  private buffer: { [K in Table]: Row<K>[] } = { spans: [], logs: [], metrics: [] };
  /** null: not known yet (hold); true: send; false: drop everything. */
  private recording: boolean | null = null;
  private inFlight = false;
  private dead = false;
  private failures = 0;
  private quietUntil = 0;
  private timer: unknown = null;
  /** For the tests: every batch actually sent. */
  sent = 0;

  constructor(private readonly target: Target | null, private readonly opts: ExporterOptions = {}) {}

  get enabled() { return !!this.target && !this.dead && this.recording !== false; }

  /** Whether the open workspace records (null while it's loading). Off clears whatever is waiting. */
  setRecording(on: boolean | null) {
    this.recording = on;
    if (on === false) this.clear();
    else if (on) this.schedule();
  }

  push<T extends Table>(table: T, row: Row<T>) {
    if (!this.enabled) return;
    const list = this.buffer[table] as Row<T>[];
    list.push(row);
    if (list.length > MAX_BUFFER) list.splice(0, list.length - MAX_BUFFER);
    this.schedule();
  }

  /** How many records are waiting. */
  get pending() { return this.buffer.spans.length + this.buffer.logs.length + this.buffer.metrics.length; }

  clear() {
    this.buffer = { spans: [], logs: [], metrics: [] };
    if (this.timer != null) (this.opts.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  private schedule() {
    if (this.timer != null || !this.enabled || this.recording !== true || !this.pending) return;
    const set = this.opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.timer = set(() => { this.timer = null; void this.flush(); }, this.opts.intervalMs ?? 5000);
  }

  /** Sends what's waiting. `final`: the page is going away, so use keepalive and send only what fits. */
  async flush(final = false): Promise<void> {
    if (!this.target || this.dead || this.recording !== true) return;
    const now = (this.opts.now ?? Date.now)();
    if (now < this.quietUntil || (this.inFlight && !final)) return;
    const batches = (Object.keys(TABLES) as Table[]).map((t) => [t, this.buffer[t]] as const).filter(([, rows]) => rows.length);
    if (!batches.length) return;
    this.buffer = { spans: [], logs: [], metrics: [] };
    this.inFlight = true;
    let budget = KEEPALIVE_BYTES;
    try {
      for (const [table, rows] of batches) {
        let body = JSON.stringify(rows);
        if (final) {
          // Over the keepalive budget: send the newest rows that fit, drop the rest.
          let keep = rows as unknown[];
          while (keep.length && body.length > budget) { keep = keep.slice(Math.ceil(keep.length / 4)); body = JSON.stringify(keep); }
          if (!keep.length) continue;
          budget -= body.length;
        }
        if (!(await this.send(table, body, final))) break;
      }
    } finally {
      this.inFlight = false;
      if (this.pending) this.schedule();
    }
  }

  /** One request. False when it failed: a refusal (the tables aren't there, the key can't add rows) stops sending for
      the rest of the visit; a network or server fault waits a while, three times, then stops. */
  private async send(table: Table, body: string, keepalive: boolean): Promise<boolean> {
    const t = this.target!;
    const headers: Record<string, string> = { apikey: t.key, 'Content-Type': 'application/json', 'Content-Profile': FARO_SCHEMA, Prefer: 'return=minimal' };
    // A legacy anon key is a JWT and goes in Authorization too; a publishable key goes in apikey only.
    if (t.key.startsWith('eyJ')) headers.Authorization = `Bearer ${t.key}`;
    // A request that hangs (a database that never answers) gives up rather than holding every later batch.
    const ctl = typeof AbortController === 'function' && !keepalive ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 15_000) : null;
    try {
      const res = await faroFetch(this.opts.fetch)(`${t.url}/rest/v1/${TABLES[table]}`, { method: 'POST', headers, body, keepalive, credentials: 'omit', ...(ctl ? { signal: ctl.signal } : {}) });
      this.sent++;
      if (res.ok) { this.failures = 0; return true; }
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) { this.dead = true; this.clear(); return false; }
      return this.backOff();
    } catch {
      return this.backOff();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private backOff(): boolean {
    this.failures++;
    if (this.failures >= 3) { this.dead = true; this.clear(); return false; }
    this.quietUntil = (this.opts.now ?? Date.now)() + 30_000 * 2 ** (this.failures - 1);
    return false;
  }
}
