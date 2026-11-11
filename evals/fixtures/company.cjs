/* The company-size workspace (find spec, N12; FS4): 15,000 people in 1,500 teams with 30,000 goals, generated in the
   page before the app starts and kept in an in-memory stand-in for localStorage, so the browser's 5 MB quota doesn't
   decide what is measured. Pass `seedCompany` to a Playwright context's addInitScript with `{ viewer }`. Deterministic:
   the same names, teams and goals every run. */

/** Runs in the page: builds the workspace and swaps localStorage for a Map that already holds it. */
function seedCompany({ people: P = 15000, teams: T = 1500, goals: G = 30000, viewer = 'p1' }) {
  const FIRST = ['Ada', 'Ben', 'Chloé', 'Dev', 'Esi', 'Farah', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kofi', 'Lucía', 'Mateo', 'Noor', 'Oskar', 'Priya', 'Quinn', 'Rhea', 'Sami', 'Tunde', 'Uma', 'Vik', 'Wen', 'Xavi', 'Yara', 'Zoë'];
  const LAST = ['Adams', 'Bakare', 'Chen', 'Dubois', 'Eze', 'Fischer', 'García', 'Haddad', 'Ito', 'Jensen', 'Kapoor', 'Lindgren', 'Moreno', 'Novák', 'Okafor', 'Park', 'Quist', 'Rossi', 'Suzuki', 'Tanaka', 'Usman', 'Vega', 'Weber', 'Xu', 'Yilmaz', 'Zhou', 'Andersen', 'Bianchi', 'Costa', 'Diallo', 'Evans', 'Fernández', 'Gupta', 'Horvat', 'Ivanova', 'Jovanović', 'Kowalski', 'Larsen', 'Mensah', 'Nakamura'];
  const ROLES = ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Engineering Manager', 'Product Manager', 'Designer', 'Data Scientist', 'Site Reliability Engineer', 'Analyst', 'Director'];
  const AREAS = ['Payments', 'Search', 'Platform', 'Mobile', 'Growth', 'Risk', 'Data', 'Identity', 'Billing', 'Messaging', 'Maps', 'Ads', 'Support', 'Security', 'Infra'];
  const NOUNS = ['latency', 'conversion', 'uptime', 'adoption', 'cost per request', 'error rate', 'retention', 'build time', 'queue wait', 'coverage'];
  const people = [], teams = [], goals = [];
  for (let t = 0; t < T; t++) teams.push({ id: `t${t + 1}`, name: `${AREAS[t % AREAS.length]} ${Math.floor(t / AREAS.length) + 1}`, leadId: `p${t * 10 + 1}`, objective: '' });
  for (let i = 0; i < P; i++) {
    const first = FIRST[i % FIRST.length], last = LAST[Math.floor(i / FIRST.length) % LAST.length];
    people.push({ id: `p${i + 1}`, name: `${first} ${last} ${Math.floor(i / (FIRST.length * LAST.length)) || ''}`.trim(), role: ROLES[i % ROLES.length], initials: first[0] + last[0], teamId: `t${Math.floor(i / 10) + 1}`, admin: i < 3, email: `person${i + 1}@example.com` });
  }
  for (let g = 0; g < G; g++) {
    const team = g % T, owner = team * 10 + (g % 10);
    goals.push({
      id: `g${g + 1}`, key: `G-${g + 1}`, cycleId: 'cy', teamId: `t${team + 1}`, ownerId: `p${owner + 1}`,
      title: `${AREAS[team % AREAS.length]} ${NOUNS[g % NOUNS.length]} ${g + 1}`, io: 'output', level: g < 30 ? 'north-star' : g < 1530 ? 'svp' : 'team', guardrail: false,
      parentId: g < 30 ? null : g < 1530 ? `g${(g % 30) + 1}` : `g${31 + (g % 1500)}`, effect: null, source: '', definition: '', createdAt: '2026-01-05T09:00:00Z',
      kind: 'metric', unit: '%', decimals: 0, plan: { start: 0, target: 100, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null,
    });
  }
  const snapshot = { people, teams, cycles: [{ id: 'cy', name: '2026', startDate: '2026-01-05', weeks: 52, reviewDay: 3 }], goals, checkIns: [], decisions: [], changes: [], watches: [], reviews: [], retros: [], keysIssued: G };
  const data = new Map([
    ['goals-live-v1:workspaces', JSON.stringify([{ id: 'ws_company', name: 'Company', kind: 'own', createdAt: '2026-01-05T09:00:00Z' }])],
    ['goals-live-v1:ws_company', JSON.stringify(snapshot)],
    ['goals-live-workspace', 'ws_company'],
    ['goals-live-me:ws_company', viewer],
  ]);
  const store = {
    getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
    setItem: (k, v) => { data.set(String(k), String(v)); },
    removeItem: (k) => { data.delete(String(k)); },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
}

module.exports = { seedCompany, SIZE: { people: 15000, teams: 1500, goals: 30000 } };
