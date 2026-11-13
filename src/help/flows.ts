/* The named flows: the jobs people come to the app to do, each with its steps in order and the guide article that
   explains it. Defined once, next to the guide, so telemetry can say "a check-in, step 2 of 3" and record where people
   start, how far they get, whether they finish and where they stop. src/help/flows.test.ts checks every flow's article
   exists, every step's route is a real App.tsx route, and every action and mark exists.

   A step is reached by a route (as App.tsx writes it; a query like ?review=* makes it more specific), a named action
   (a method of AppState, the same names src/mcp/parity.ts maps to MCP tools), or a mark a screen sets as it moves
   between steps of its own (MARKS below). Routes are taken from the flow's guide article where that article's routes
   are the flow's, so they're written once. */
import { moduleById } from '../core/registry';
import type { AppState } from '../app/state';
import { articleRef } from './lookup';

/** Steps inside a screen that has no route of its own for them, set by the screen as it moves on (telemetry.mark). */
export const MARKS = [
  'checkIn.open', 'checkIn.carry', 'checkIn.account',
  'newGoal.step-2', 'newGoal.step-3', 'newGoal.step-4',
  'setUp.step-1', 'setUp.step-2', 'setUp.step-3', 'setUp.step-4', 'setUp.step-5', 'setUp.step-6', 'setUp.step-7',
  'import.read',
  'respond.open', 'respond.close',
] as const;
export type Mark = (typeof MARKS)[number];

export type ActionName = Exclude<keyof AppState, 'mode' | 'viewerChosen' | 'ws' | 'workspaces' | 'snapshot' | 'allGoals' | 'cycle' | 'week' | 'today' | 'viewer' | 'lookup' | 'storeKind'>;

export interface FlowStep {
  id: string;
  /** What the person is doing at this step, in a few words. */
  title: string;
  routes?: string[];
  actions?: ActionName[];
  marks?: Mark[];
  /** A flow can start here (the first step always can). */
  entry?: boolean;
}

export interface Flow {
  id: string;
  title: string;
  /** The guide article that explains it (src/help/guide.ts). */
  article: string;
  /** A feature module's flow: there only when this build has the module (src/core/registry.ts). */
  module?: string;
  steps: FlowStep[];
  /** Marks that mean the person closed it without finishing (a sheet closed). */
  closedBy?: Mark[];
}

/** An article's own routes: a flow that covers exactly what an article explains uses them, rather than restating them. */
const routesOf = (article: string) => articleRef(article)?.routes ?? [];

/** Every flow, the modules' included; FLOWS is those this build has. */
const ALL_FLOWS: Flow[] = [
  {
    id: 'check-in', title: 'Check in on a goal', article: 'check-in',
    steps: [
      { id: 'open', title: 'Open the check-in', routes: routesOf('check-in'), marks: ['checkIn.open'] },
      { id: 'explain', title: 'Say why, and what’s next', marks: ['checkIn.account', 'checkIn.carry'] },
      { id: 'post', title: 'Post it', actions: ['postCheckIn'] },
    ],
  },
  {
    id: 'quick-check-in', title: 'Check in on several goals in one table', article: 'check-in-table',
    steps: [
      { id: 'open', title: 'Open the table', routes: routesOf('check-in-table') },
      { id: 'save', title: 'Save the check-ins', actions: ['applyChanges', 'postCheckIn'] },
    ],
  },
  {
    id: 'review', title: 'Run a review', article: 'reviews', module: 'reviews',
    steps: [
      { id: 'agenda', title: 'Open the review', routes: ['/reviews/:reviewId'] },
      { id: 'walk', title: 'Go through the goals', routes: ['/goals/:goalId?review=*'], actions: ['reviewCall'], entry: true },
      { id: 'summary', title: 'Reach the summary', routes: ['/reviews/:reviewId/summary'] },
    ],
  },
  {
    id: 'new-goal', title: 'Set up a new goal', article: 'new-goal',
    steps: [
      { id: 'what', title: 'Say what it is', routes: routesOf('new-goal') },
      { id: 'measure', title: 'Say how it’s measured', marks: ['newGoal.step-2'] },
      { id: 'fits', title: 'Say where it fits', marks: ['newGoal.step-3'] },
      { id: 'check', title: 'Check it', marks: ['newGoal.step-4'] },
      { id: 'publish', title: 'Publish it', actions: ['saveGoal'] },
    ],
  },
  {
    id: 'change-goal', title: 'Change a goal or its plan', article: 'edit-goal',
    steps: [
      { id: 'open', title: 'Open the goal’s settings', routes: routesOf('edit-goal') },
      { id: 'save', title: 'Save the change', actions: ['saveGoal'] },
    ],
  },
  {
    id: 'answer-request', title: 'Answer a request for a decision or help', article: 'requests',
    steps: [
      { id: 'open', title: 'Open the request', marks: ['respond.open'] },
      { id: 'answer', title: 'Answer it', actions: ['answerRequest'] },
    ],
    closedBy: ['respond.close'],
  },
  {
    id: 'import', title: 'Load numbers from a spreadsheet', article: 'import', module: 'spreadsheets',
    steps: [
      { id: 'open', title: 'Open Import', routes: routesOf('import') },
      { id: 'read', title: 'Check what the file would change', marks: ['import.read'] },
      { id: 'apply', title: 'Save the changes', actions: ['applyChanges'] },
    ],
  },
  {
    id: 'wrap-up', title: 'Wrap up the year', article: 'wrap-up',
    steps: [
      { id: 'list', title: 'Open the wrap-up', routes: ['/retro'] },
      { id: 'goal', title: 'Wrap up a goal', routes: ['/retro/:goalId'], entry: true },
      { id: 'save', title: 'Save the wrap-up', actions: ['saveRetro'] },
    ],
  },
  {
    id: 'set-up', title: 'Set up a workspace', article: 'set-up',
    steps: [
      { id: 'workspace', title: 'Name the workspace', routes: ['/workspace/new'], marks: ['setUp.step-1'] },
      { id: 'you', title: 'Say who you are', marks: ['setUp.step-2'] },
      { id: 'team', title: 'Add your team', marks: ['setUp.step-3'] },
      { id: 'start', title: 'Choose a starting point', marks: ['setUp.step-4'] },
      { id: 'outcome', title: 'Set the outcome', marks: ['setUp.step-5'] },
      { id: 'goals', title: 'Add goals', marks: ['setUp.step-6'] },
      { id: 'check', title: 'Check it', marks: ['setUp.step-7'] },
      { id: 'create', title: 'Create the workspace', actions: ['createWorkspace'] },
    ],
  },
];

export const FLOWS: Flow[] = ALL_FLOWS.filter((f) => !f.module || !!moduleById(f.module));

export const flowById = (id: string) => FLOWS.find((f) => f.id === id);
