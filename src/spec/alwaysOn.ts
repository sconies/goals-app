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
  { id: 'watching', name: 'Watching', until: 'SW1', why: 'Home’s “Goals you watch” and Goals’ watching scope read watches inside core screens. Its switch is designed, not built.' },
  { id: 'ai-access', name: 'AI access', until: 'SW2', why: 'Every AI call is checked against a token at the server’s door. Switching it off needs the Features screen’s groups and a way to keep tokens named for when it comes back.' },
  { id: 'feedback', name: 'Feedback', until: 'SW1', why: 'Its menu row, its page and its inbox tools are core code. Its switch is designed, not built.' },
  { id: 'goal-map', name: 'The goal map', until: 'SW1', why: 'It is one of Goals’ views, drawn from core records only. Its switch is designed, not built.' },
  { id: 'wrap-up', name: 'The wrap-up', until: 'SW1', why: 'Its screens sit beside the year’s end rules (results, carrying on, starting the next year), which stay core whatever happens. Its own screens get a switch; the rules don’t.' },
];
