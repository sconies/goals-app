/* What an admin has to sort out (Workspace rule 3), once: About lists it and Home's workspace line counts it (Home rule 7,
   HM7), so the two never disagree. The core's needs, then each module section's own, then what a module with no
   section raises (AR2: toSortOut). */
import type { AppModule, WorkspaceSection } from '../core/app';
import { workspaceNeeds, type WorkspaceNeed } from '../domain/workspaceAttention';
import type { Cycle, Person, Snapshot } from '../domain/types';

export function toSortOut(s: Snapshot, cycle: Cycle, viewer: Person, reviews: boolean, sections: readonly Pick<WorkspaceSection, 'needs'>[], screens: readonly Pick<AppModule, 'toSortOut'>[]): WorkspaceNeed[] {
  return [...workspaceNeeds(s, cycle, viewer.admin, { reviews }), ...sections.flatMap((x) => x.needs?.(s, viewer) ?? []), ...screens.flatMap((m) => m.toSortOut?.(s, viewer) ?? [])];
}
