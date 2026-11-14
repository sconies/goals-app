/* Fields' records (TG1), owned by the module: a workspace's field, and a goal's value for one. They live in the workspace
   under `modules.tags` (domain/records): `fields` and `fieldValues`, as records.ts declares them. Stored in goal_fields
   and goal_field_values (migration 0052), neither of which has removed_at: a field is retired, a value cleared. */

/** A field a workspace defines. A retired one keeps every value and can be brought back (Lane, 5a). */
export interface GoalField {
  id: string;
  /** 1 to 40 characters; no other live field has it, whatever the case. */
  name: string;
  /** A list of values (filterable from TG2), or free text. It doesn't change once the field is added. */
  kind: 'list' | 'text';
  /** A list's values, in order (1 to 20, each 1 to 40 characters, none twice); a text field has none. */
  options: string[];
  /** Its place in the order goals' pages show the fields in. */
  position: number;
  /** When it was retired; null or absent while it is live. */
  retiredAt?: string | null;
}

/** A field as saved, with who added it and who retired it. */
export interface SavedField extends GoalField {
  createdBy: string;
  createdAt: string;
  retiredBy?: string | null;
}

/** A goal's value for one field. Its id is `{goalId}:{fieldId}` (migration 0052): a goal has one value per field. */
export interface GoalFieldValue {
  id: string;
  goalId: string;
  fieldId: string;
  /** As stored: a list's value as the list writes it, or free text of up to 80 characters. Empty when cleared. */
  value: string;
  /** Who set it last, and when. */
  setBy: string;
  setAt: string;
  /** Set only by the core's generic paths (a carried copy that leaves, a start undone): the value then reads as cleared, and is written so. */
  removedAt?: string | null;
  removedBy?: string | null;
}
