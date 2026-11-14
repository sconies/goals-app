/* Distinct features that are still in the core, so a workspace can't switch them off yet, and why (Lane, 13 Nov:
   "a feature that cannot be switched off says why in its spec"; docs/architecture/module-map.md, fix item F1).
   The spec's modules index (spec/modules/README.md) prints this list. An entry leaves the list in the same PR that
   gives the feature its switch: src/spec/alwaysOn.test.ts fails while an entry is also a module. */

export interface AlwaysOn {
  /** The id its module will have (module map, "Every module"). */
  id: string;
  name: string;
  /** Why it can't be switched off today, in one or two sentences. */
  why: string;
  /** The backlog item that gives it a switch. */
  until: string;
}

export const ALWAYS_ON: readonly AlwaysOn[] = [
];
