/* The Platform Engineering organisation's people and teams: one division of about 100 people under a VP, six
   directors, an engineering manager per team, and the engineers. All names are invented. */
import type { Person, Team } from '../../domain/types';

export const TEAMS: Team[] = [
  { id: 'office', name: 'Office of the VP', leadId: 'amara', objective: 'One plan for the division, reviewed every week, with decisions made where the work is' },
  { id: 'devex', name: 'Developer Experience', leadId: 'tariq', objective: 'Make the fast path the easy path, from first commit to merged pull request' },
  { id: 'cicd', name: 'CI/CD', leadId: 'rhea', objective: 'Pipelines that are fast, trusted and boring' },
  { id: 'build', name: 'Build & Release', leadId: 'pavel', objective: 'Ship any service, any day, with one button and an easy way back' },
  { id: 'infra', name: 'Infrastructure & Compute', leadId: 'akosua', objective: 'Compute and Kubernetes that teams never have to think about' },
  { id: 'finops', name: 'Cloud Cost (FinOps)', leadId: 'ethan', objective: 'Every team sees what it spends and can act on it the same week' },
  { id: 'sre', name: 'Site Reliability Engineering', leadId: 'mateo', objective: 'Restore service fast, learn from every incident, and page fewer people' },
  { id: 'obs', name: 'Observability', leadId: 'yuki', objective: 'One place to see what every service is doing, with alerts people trust' },
  { id: 'sec', name: 'Security Engineering', leadId: 'omar', objective: 'Fix what matters within SLA and keep secrets out of code' },
  { id: 'iam', name: 'Identity & Access', leadId: 'leilani', objective: 'Least privilege by default, with access that expires on its own' },
  { id: 'data', name: 'Data Platform', leadId: 'arjun', objective: 'Fresh, documented, trustworthy tables for every team that needs them' },
  { id: 'ml', name: 'ML Platform', leadId: 'zara', objective: 'Train, evaluate and serve models without a ticket to anyone' },
  { id: 'portal', name: 'Developer Portal, Golden Paths & Self-Service Environments', leadId: 'camille', objective: 'Anything a team needs, from a new service to a test environment, in one place and in minutes' },
  { id: 'net', name: 'Networking & Edge', leadId: 'tobias', objective: 'A network that scales quietly, with zero-trust between every service' },
];

type P = [id: string, name: string, role: string, team: string, admin?: boolean];

const ROWS: P[] = [
  // The Office of the VP: the division's leader, its programme manager, operations and analytics.
  ['amara', 'Amara Nwosu', 'VP Platform Engineering', 'office', true],
  ['grace', 'Grace Achterberg', 'Engineering Operations Manager', 'office', true],
  ['hamid', 'Hamid Rezaei', 'Engineering Operations Administrator', 'office', true],
  ['wen', 'Wen Zhao', 'Technical Programme Manager', 'office'],
  ['lucia', 'Lucía Romero', 'Engineering Analyst', 'office'],
  // Directors.
  ['daniel', 'Daniel Okafor', 'Director of Developer Productivity', 'devex'],
  ['bjorn', 'Björn Halvorsen', 'Director of Infrastructure', 'infra'],
  ['marisol', 'Marisol Duarte', 'Director of Reliability Engineering', 'sre'],
  ['farah', 'Farah Siddiqui', 'Director of Security Engineering', 'sec'],
  ['jun', 'Jun Watanabe', 'Director of Data & ML Platform', 'data'],
  ['ingrid', 'Ingrid Solberg', 'Director of Platform Product', 'portal'],
  // Engineering managers and leads, one per team.
  ['tariq', 'Tariq Haddad', 'Engineering Manager, Developer Experience', 'devex'],
  ['rhea', 'Rhea Kapoor', 'Engineering Manager, CI/CD', 'cicd'],
  ['pavel', 'Pavel Novák', 'Engineering Manager, Build & Release', 'build'],
  ['akosua', 'Akosua Owusu', 'Engineering Manager, Compute & Kubernetes', 'infra'],
  ['ethan', 'Ethan Brooks', 'FinOps Lead', 'finops'],
  ['mateo', 'Mateo Fernández', 'SRE Manager', 'sre'],
  ['yuki', 'Yuki Tanaka', 'Engineering Manager, Observability', 'obs'],
  ['omar', 'Omar Benali', 'Security Engineering Manager', 'sec'],
  ['leilani', 'Leilani Kahale', 'Engineering Manager, Identity & Access', 'iam'],
  ['arjun', 'Arjun Mehta', 'Engineering Manager, Data Platform', 'data'],
  ['zara', 'Zara Ahmed', 'Engineering Manager, ML Platform', 'ml'],
  ['camille', 'Camille Laurent', 'Engineering Manager, Developer Portal', 'portal'],
  ['tobias', 'Tobias Becker', 'Engineering Manager, Networking & Edge', 'net'],
  ['nadia', 'Nadia Petrova', 'Principal Engineer, Platform Architecture', 'office'],
  // Developer Experience.
  ['oskar', 'Oskar Lindgren', 'Software Engineer', 'devex'],
  ['mei', 'Mei Lin', 'Staff Engineer', 'devex'],
  ['kwame', 'Kwame Asante', 'Senior Software Engineer', 'devex'],
  ['isabel', 'Isabel Moreno', 'Software Engineer', 'devex'],
  ['ravi', 'Ravi Shankar', 'Senior Software Engineer', 'devex'],
  ['hannah', 'Hannah Schmidt', 'Developer Advocate', 'devex'],
  // CI/CD.
  ['diego', 'Diego Ramírez', 'Staff Engineer', 'cicd'],
  ['aiko', 'Aiko Suzuki', 'Senior Software Engineer', 'cicd'],
  ['femi', 'Femi Adebayo', 'Software Engineer', 'cicd'],
  ['johanna', 'Johanna Virtanen', 'Senior Software Engineer', 'cicd'],
  ['marcus', 'Marcus Bell', 'Software Engineer', 'cicd'],
  ['sana', 'Sana Qureshi', 'Software Engineer', 'cicd'],
  // Build & Release.
  ['maximilian', 'Maximilian Alexander von Hohenberg-Castellanos', 'Senior Software Engineer', 'build'],
  ['chen', 'Chen Wei', 'Staff Engineer', 'build'],
  ['olivia', 'Olivia Martins', 'Release Engineer', 'build'],
  ['tunde', 'Tunde Bakare', 'Software Engineer', 'build'],
  ['elif', 'Elif Yılmaz', 'Senior Release Engineer', 'build'],
  ['patrick', 'Patrick O’Sullivan', 'Software Engineer', 'build'],
  // Infrastructure & Compute.
  ['sipho', 'Sipho Dlamini', 'Staff Infrastructure Engineer', 'infra'],
  ['anya', 'Anya Kowalski', 'Senior Infrastructure Engineer', 'infra'],
  ['luca', 'Luca Romano', 'Infrastructure Engineer', 'infra'],
  ['priyam', 'Priyam Banerjee', 'Senior Infrastructure Engineer', 'infra'],
  ['jonah', 'Jonah Greenberg', 'Infrastructure Engineer', 'infra'],
  ['astrid', 'Astrid Nilsson', 'Infrastructure Engineer', 'infra'],
  // Cloud Cost (FinOps).
  ['valentina', 'Valentina Rossi', 'Senior FinOps Analyst', 'finops'],
  ['kenji', 'Kenji Mori', 'FinOps Engineer', 'finops'],
  ['amelia', 'Amelia Hughes', 'FinOps Engineer', 'finops'],
  // Site Reliability Engineering.
  ['chioma', 'Chioma Eze', 'Staff SRE', 'sre'],
  ['rafael', 'Rafael Souza', 'Senior SRE', 'sre'],
  ['ingeborg', 'Ingeborg Dahl', 'SRE', 'sre'],
  ['samir', 'Samir Khalil', 'Senior SRE', 'sre'],
  ['beatriz', 'Beatriz Costa', 'SRE', 'sre'],
  ['connor', 'Connor Walsh', 'Incident Manager', 'sre'],
  // Observability.
  ['thandiwe', 'Thandiwe Mokoena', 'Staff Engineer', 'obs'],
  ['nikolai', 'Nikolai Ivanov', 'Senior Software Engineer', 'obs'],
  ['grete', 'Grete Kask', 'Software Engineer', 'obs'],
  ['hyunwoo', 'Hyun-woo Park', 'Senior Software Engineer', 'obs'],
  ['adaeze', 'Adaeze Obi', 'Software Engineer', 'obs'],
  ['felix', 'Felix Wagner', 'Software Engineer', 'obs'],
  // Security Engineering.
  ['yasmin', 'Yasmin El-Amin', 'Staff Security Engineer', 'sec'],
  ['dmitri', 'Dmitri Volkov', 'Senior Security Engineer', 'sec'],
  ['laila', 'Laila Karimi', 'Security Engineer', 'sec'],
  ['ben', 'Ben Carter', 'Application Security Engineer', 'sec'],
  ['siobhan', 'Siobhan Murphy', 'Security Engineer', 'sec'],
  ['kaito', 'Kaito Nakamura', 'Detection Engineer', 'sec'],
  // Identity & Access.
  ['amir', 'Amir Tehrani', 'Senior Software Engineer', 'iam'],
  ['freya', 'Freya Jensen', 'Software Engineer', 'iam'],
  ['malik', 'Malik Johnson', 'Senior Software Engineer', 'iam'],
  ['lena', 'Lena Hoffmann', 'Software Engineer', 'iam'],
  ['ngoc', 'Ngọc Trần', 'Software Engineer', 'iam'],
  // Data Platform.
  ['santiago', 'Santiago Herrera', 'Staff Data Engineer', 'data'],
  ['ayesha', 'Ayesha Malik', 'Senior Data Engineer', 'data'],
  ['tomasz', 'Tomasz Zieliński', 'Data Engineer', 'data'],
  ['nkechi', 'Nkechi Uzor', 'Data Engineer', 'data'],
  ['erik', 'Erik Lund', 'Senior Data Engineer', 'data'],
  ['rosa', 'Rosa Jiménez', 'Analytics Engineer', 'data'],
  // ML Platform.
  ['vikram', 'Vikram Rao', 'Staff ML Engineer', 'ml'],
  ['claire', 'Claire Dubois', 'Senior ML Engineer', 'ml'],
  ['obinna', 'Obinna Nwachukwu', 'ML Engineer', 'ml'],
  ['sakura', 'Sakura Ito', 'ML Engineer', 'ml'],
  ['william', 'William Grant', 'Senior Software Engineer', 'ml'],
  // Developer Portal, Golden Paths & Self-Service Environments.
  ['noor', 'Noor Hassan', 'Staff Engineer', 'portal'],
  ['gabriel', 'Gabriel Silva', 'Senior Software Engineer', 'portal'],
  ['emma', 'Emma Larsson', 'Product Designer', 'portal'],
  ['kojo', 'Kojo Amankwah', 'Software Engineer', 'portal'],
  ['julia', 'Julia Novak', 'Product Manager, Developer Portal', 'portal'],
  ['arnav', 'Arnav Kulkarni', 'Software Engineer', 'portal'],
  // Networking & Edge.
  ['mohammed', 'Mohammed Al-Rashid', 'Staff Network Engineer', 'net'],
  ['katarina', 'Katarina Horvat', 'Senior Network Engineer', 'net'],
  ['joao', 'João Pereira', 'Network Engineer', 'net'],
  ['hiroshi', 'Hiroshi Kimura', 'Network Engineer', 'net'],
  ['zainab', 'Zainab Bello', 'Senior Software Engineer', 'net'],
];

const initialsOf = (name: string) => {
  const w = name.replace(/[’']/g, '').split(/[\s-]+/).filter((x) => /^\p{Lu}/u.test(x));
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1]![0] : '')).toUpperCase();
};

/** An example email, firstname.lastname@example.com, without accents: every person in the example has one. */
export const exampleEmail = (name: string) => {
  const w = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
  return `${w[0]}.${w.slice(1).join('-') || 'x'}@example.com`;
};
export const PEOPLE: Person[] = ROWS.map(([id, name, role, teamId, admin]) => ({ id, name, role, initials: initialsOf(name), teamId, admin: !!admin, email: exampleEmail(name) }));
