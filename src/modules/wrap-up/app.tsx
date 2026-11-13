/* The Wrap-up on screen (SW1): its two addresses. The pages themselves are still the core's (src/screens/Retro.tsx)
   until SW8 moves them here, as are Home's wrap-up lead and a goal's “Wrap up this goal”, which ask src/app/reads.ts
   wrapUpOn. Starting the next year (/workspace/cycles/next) is the core's and never switches off. */
import { lazy } from 'react';
import type { AppModule } from '../../core/app';

const WrapUp = lazy(() => import('../../screens/Retro').then((m) => ({ default: m.WrapUp })));
const RetroGoal = lazy(() => import('../../screens/Retro').then((m) => ({ default: m.RetroGoal })));

const wrapUp: AppModule = {
  routes: [
    { path: '/retro', element: <WrapUp /> },
    { path: '/retro/:goalId', element: <RetroGoal /> },
  ],
};

export default wrapUp;
