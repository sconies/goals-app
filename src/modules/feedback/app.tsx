/* Feedback on screen (SW1): the builders' inbox, /feedback, and its two old addresses (module.json `redirects`). The
   page itself, the sheet and marking up a screen are still the core's (src/screens/Feedback.tsx, src/ui/Shell.tsx,
   src/markup) until SW4 moves them here; the shell draws its sheet and listens for Ctrl+Shift+M only while Feedback is
   on. Its menu row stays the core's (domain/navigation menuGroups, which takes whether Feedback is on). */
import { lazy } from 'react';
import type { AppModule } from '../../core/app';

const Feedback = lazy(() => import('../../screens/Feedback').then((m) => ({ default: m.Feedback })));

const feedback: AppModule = {
  routes: [{ path: '/feedback', element: <Feedback onSend={() => window.dispatchEvent(new Event('faro:send-feedback'))} /> }],
};

export default feedback;
