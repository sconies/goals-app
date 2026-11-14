/* Fields' Help article (TG1): Workspace → Fields and a goal's Fields block. Help hides it while Fields is switched off,
   and its address then says Fields is switched off. src/help/guide.ts places it after Features. */
import type { Article } from '../../help/guide';
import { FIELD_LIMITS } from './rules';

const help: Article[] = [
  {
    id: 'fields',
    title: 'Fields: a workspace’s own columns on goals',
    summary: `A workspace’s own fields on goals, such as a stage or a programme: up to ${FIELD_LIMITS.fields}, each a short list of values or free text, set on each goal’s page. No rule reads them: they’re for finding and sorting.`,
    group: 'you',
    after: 'features',
    sections: [
      { heading: 'What it’s for', text: ['Teams track things Faro has no column for: a lifecycle stage (Discover, Build, Run), a programme, a funding line. A field keeps them on the goal, out of its title, where nothing could find them. No status, flag or check-in rule reads a field.'] },
      { heading: 'Workspace, Fields', list: [
        'Workspace, Fields lists the fields in order: each one’s name, its kind (“A list: Discover, Build, Run” or “Free text”) and how many of this year’s goals have a value.',
        `An admin adds one with Add a field: a name of up to ${FIELD_LIMITS.name} characters, and for a list its values, one per line (1 to ${FIELD_LIMITS.values}, each up to ${FIELD_LIMITS.option} characters, none twice). Free text holds up to ${FIELD_LIMITS.value} characters on each goal. A workspace has at most ${FIELD_LIMITS.fields} fields.`,
        'Change renames a field or changes a list’s values; goals keep the value they have. Up and Down change the order, which is the order a goal’s page shows them in.',
        'A field that is no longer wanted is retired, never deleted: every goal keeps its value and History its changes, and Bring back shows them again. A retired field’s name can be used again.',
        'With no field yet, the page says “No fields yet” and offers Add a field to admins.',
      ] },
      { heading: 'On a goal', list: [
        'A goal’s page has a Fields block in About, after its facts: one line per field, such as “Stage · Build”, or “Stage · Not set”.',
        'The goal’s owner or an admin presses Change beside a line and picks a value from the list, or types the text and presses Save. Not set clears it. No reason is asked: a field isn’t the plan.',
        'History says each change on the goal: “Stage: Discover → Build”. Adding, retiring and bringing back a field is in Activity.',
      ] },
      { heading: 'With an AI assistant', list: [
        'list_fields lists the fields and their values (with goal_id, that goal’s values); set_goal_fields sets a goal’s values by field name, with dry_run to check first; save_field lets an admin add, change, move, retire or bring back a field. Each follows the same rules.',
      ] },
      { heading: 'Who can', text: ['Admins add and change the fields. A goal’s owner or an admin sets its values. Everyone sees them. An admin can switch Fields off in Workspace, Features: the block and the section go, and every field and value is kept for when it’s switched on again.'] },
    ],
    routes: ['/workspace/fields'],
    screens: ['FieldsSection', 'FieldsBlock'],
    reqs: ['TAGS-FIELDS', 'TAGS-OFF'],
    keywords: ['field', 'fields', 'tag', 'tags', 'stage', 'programme', 'custom field', 'column', 'label'],
    related: ['workspace', 'features', 'goal-page'],
  },
];

export default help;
