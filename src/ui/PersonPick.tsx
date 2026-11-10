/* Choosing who does something: find-and-pick for one person (src/ui/Pick.tsx). Kept as a name for the places that
   already call it. */
import { PickOne } from './Pick';

/** `suggest`: people offered first, before anything is typed, each with a note ("you", "who owns this goal"). */
export function PersonPick({ value, onChange, label = 'Who', invalid = false, suggest = [] }: { value: string | null; onChange: (id: string) => void; label?: string; invalid?: boolean; suggest?: { id: string; note: string }[] }) {
  return <PickOne kind="person" label={label} value={value} onChange={(id) => { if (id) onChange(id); }} invalid={invalid} first={suggest} />;
}
