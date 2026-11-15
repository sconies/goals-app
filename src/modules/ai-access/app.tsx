/* AI access on screen (SW2): its own Workspace section, AI access (/workspace/ai, after Access, admins), with every MCP
   token and Make a token. The section itself is still drawn by the core (src/screens/Workspace.tsx AiAccessSection, the
   token list in src/ui/AiAssistants.tsx) until SW7 moves it here. With AI access switched off the section is not there,
   and its address says it is off. Its facts are in module.json. */
import { lazy } from 'react';
import type { AppModule } from '../../core/app';

const AiAccessSection = lazy(() => import('../../screens/Workspace').then((m) => ({ default: m.AiAccessSection })));

const aiAccess: AppModule = {
  sections: [{
    id: 'ai',
    label: 'AI access',
    summary: 'The MCP tokens that let an AI tool act as someone here.',
    admins: true,
    after: 'access',
    element: <AiAccessSection />,
  }],
};

export default aiAccess;
