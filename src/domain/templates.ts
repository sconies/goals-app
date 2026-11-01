/* Starting points for a new workspace: an outcome and the goals that usually feed it, with typical numbers to edit. */

export interface TemplateGoal {
  title: string;
  kind: 'metric' | 'milestone';
  unit: string;
  start: string;
  target: string;
  plan?: 'straight' | 'back-loaded' | 'stepped';
  /** Milestones: "Design@3; Pilot@7; Launch@12". */
  stages?: string;
}

export interface Template {
  id: string;
  name: string;
  /** One line on who it suits. */
  blurb: string;
  outcome: TemplateGoal;
  goals: TemplateGoal[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'platform', name: 'Engineering platform', blurb: 'Faster, safer delivery for product teams',
    outcome: { title: 'Lead time from commit to production', kind: 'metric', unit: 'days', start: '5', target: '2', plan: 'back-loaded' },
    goals: [
      { title: 'Deploys per week', kind: 'metric', unit: 'deploys', start: '12', target: '30' },
      { title: 'Change failure rate', kind: 'metric', unit: '%', start: '18', target: '10' },
      { title: 'Self-service environments live', kind: 'milestone', unit: '', start: '', target: '', stages: 'Design@3; Pilot with one team@7; All teams@12' },
    ],
  },
  {
    id: 'product', name: 'Product team', blurb: 'Grow active use through activation and retention',
    outcome: { title: 'Weekly active users', kind: 'metric', unit: 'users', start: '1200', target: '2000', plan: 'back-loaded' },
    goals: [
      { title: 'New users activated in week one', kind: 'metric', unit: '%', start: '35', target: '50' },
      { title: 'Time to first value', kind: 'metric', unit: 'min', start: '20', target: '8' },
      { title: 'Onboarding redesign shipped', kind: 'milestone', unit: '', start: '', target: '', stages: 'Research@2; Prototype tested@5; Shipped to all@10' },
    ],
  },
  {
    id: 'support', name: 'Customer support', blurb: 'Happier customers with faster answers',
    outcome: { title: 'Customer satisfaction (CSAT)', kind: 'metric', unit: '%', start: '82', target: '90' },
    goals: [
      { title: 'First response time', kind: 'metric', unit: 'hours', start: '6', target: '2' },
      { title: 'Tickets solved in one reply', kind: 'metric', unit: '%', start: '40', target: '60' },
      { title: 'Questions answered by the help centre', kind: 'metric', unit: '%', start: '20', target: '35' },
    ],
  },
  {
    id: 'sales', name: 'Sales', blurb: 'More revenue from a healthier pipeline',
    outcome: { title: 'New annual revenue', kind: 'metric', unit: 'k$', start: '0', target: '1200', plan: 'stepped' },
    goals: [
      { title: 'Qualified pipeline', kind: 'metric', unit: 'k$', start: '800', target: '2400' },
      { title: 'Win rate', kind: 'metric', unit: '%', start: '18', target: '25' },
      { title: 'Sales cycle length', kind: 'metric', unit: 'days', start: '60', target: '45' },
    ],
  },
];
