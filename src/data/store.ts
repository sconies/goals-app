import type { CheckIn, Goal, Snapshot } from '../domain/types';
import { seed } from './seed';

/** Where the app keeps its records. The browser store runs today; a Supabase store implements the same contract. */
export interface Store {
  readonly kind: 'browser' | 'supabase';
  load(): Promise<Snapshot>;
  saveGoal(goal: Goal): Promise<void>;
  /** Saves a check-in, replacing any earlier one for the same goal and week. */
  saveCheckIn(checkIn: CheckIn): Promise<void>;
  /** Starts again from the demo data. */
  reset(): Promise<Snapshot>;
}

const KEY = 'goals-app-v1';

export class BrowserStore implements Store {
  readonly kind = 'browser' as const;
  private memory: Snapshot | null = null;

  constructor(private readonly today: () => Date = () => new Date()) {}

  private read(): Snapshot | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }

  private write(s: Snapshot) {
    this.memory = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Storage blocked (private window): the app still works for this visit.
    }
  }

  private current(): Snapshot {
    const s = this.memory ?? this.read();
    if (s) return s;
    const fresh = seed(this.today());
    this.write(fresh);
    return fresh;
  }

  async load() {
    return structuredClone(this.current());
  }

  async saveGoal(goal: Goal) {
    const s = this.current();
    const goals = s.goals.some((g) => g.id === goal.id) ? s.goals.map((g) => (g.id === goal.id ? goal : g)) : [...s.goals, goal];
    this.write({ ...s, goals });
  }

  async saveCheckIn(c: CheckIn) {
    const s = this.current();
    const checkIns = [...s.checkIns.filter((x) => x.id !== c.id && !(x.goalId === c.goalId && x.week === c.week)), c];
    this.write({ ...s, checkIns });
  }

  async reset() {
    const fresh = seed(this.today());
    this.write(fresh);
    return structuredClone(fresh);
  }
}

export const newId = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
