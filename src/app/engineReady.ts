/* Imported for its effect by the screens that preview changes while they render (Quick check-in, Data, bulk edit,
   People, Import): it brings the change engine with the screen's own chunk and hands it to the dispatcher before the
   screen's first render, so app.previewChanges never runs before the engine is there (src/app/actions.ts). A module's
   own Goals columns (Fields') are read by its rules, loaded beside it: Data's table edits them, never at first render. */
import * as changeset from '../domain/changeset';
import { loadGoalSheets } from '../core/records';
import { setEngine } from './actions';

setEngine(changeset);
void loadGoalSheets();
