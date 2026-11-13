/* The way out of an import's check and its changes (navigation spec 2.5; review of #328): a read file makes them forms,
   focus mode hides the tab bar, so without this a phone has none. Nothing is saved, so it says "Close without saving",
   asks first once an answer or a reason was given, forgets the file and goes back to Import. */
import { useNavigate } from 'react-router';
import { FormClose } from '../../ui/FormClose';
import { importStore, useImport } from './importStore';

export function CheckClose() {
  const nav = useNavigate();
  const st = useImport();
  const typed = Object.keys(st.answers).length > 0 || !!st.reason.trim();
  return (
    <div className="focus-top quick-top">
      <span className="small strong">Import</span>
      <FormClose keeps={false} dirty={typed} onClose={() => { importStore.reset(); nav('/data/import'); }} />
    </div>
  );
}
