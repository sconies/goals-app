/* Watching on screen (SW1): its one address, /watching, the way into Goals' Watching tab. The screens themselves are
   still the core's (src/screens/Watching.tsx, Home's “Goals you watch”, the Watch button on a goal's page) until SW6
   moves them here. With Watching switched off the route is not there, and the not-found page says it is off. Its facts
   are in module.json. */
import { lazy } from 'react';
import type { AppModule } from '../../core/app';

const Watching = lazy(() => import('../../screens/Watching').then((m) => ({ default: m.Watching })));

const watching: AppModule = {
  routes: [{ path: '/watching', element: <Watching /> }],
};

export default watching;
