/* The line a switched-off module's address adds (FT2, docs/design/feature-toggles/spec.md section 3, check N21): on
   the not-found page for one of its routes, and on Help for one of its articles. Generic: any module installed here and
   switched off. For an admin, "Workspace, Features" is a link. */
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { workspaceName } from '../domain/workspaceAttention';

export function SwitchedOffLine({ name }: { name: string }) {
  const app = useApp();
  return (
    <p className="switched-off">
      <strong>{name} is switched off in {workspaceName(app.ws, app.mode).name}.</strong> An admin can switch it on in {app.viewer.admin ? <Link to="/workspace/features">Workspace, Features</Link> : 'Workspace, Features'}.
    </p>
  );
}
