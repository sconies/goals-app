/* The names of Workspace's sections, apart from the screen itself, so the back link and the page's title can name a
   section without loading Workspace (it loads when opened: AX4). */
import { useMemo } from 'react';
import { useModules } from '../core/app';

/** The core sections' names, by id, in their order. */
export const CORE_SECTION_LABELS = {
  overview: 'About',
  cycles: 'Cycles',
  access: 'Access',
  features: 'Features',
  privacy: 'Privacy',
  removed: 'Recently removed',
} as const;

/** Every section's name by id: the core's, then each module's. */
export function useSectionNames(): Record<string, string> {
  const { screens } = useModules();
  return useMemo(() => ({ ...CORE_SECTION_LABELS, ...Object.fromEntries(screens.flatMap((m) => m.sections ?? []).map((x) => [x.id, x.label])) }), [screens]);
}
