/* Choosing who does something: find-and-pick for one person (src/ui/Pick.tsx). Kept as a name for the places that
   already call it. */
import { PickOne } from './Pick';

export function PersonPick({ value, onChange, label = 'Who', invalid = false }: { value: string | null; onChange: (id: string) => void; label?: string; invalid?: boolean }) {
  return <PickOne kind="person" label={label} value={value} onChange={(id) => { if (id) onChange(id); }} invalid={invalid} />;
}
