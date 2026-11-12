/* Past imports (backlog IM4; import spec 2.7), at /data/imports: every import, bulk edit and change through MCP in the
   change log (rule 9, pastImports), newest first, each with who, when, how and what it changed, whether it has been
   undone, and Undo for whoever made it or an admin. Found by search (the list bar's When, Who and How wait for FS2). */
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../../app/state';
import { fold } from '../../domain/problemLevels';
import { canUndoImport, importCounts, importName, pastImports } from '../../domain/removal';
import type { Change } from '../../domain/types';
import { whenText } from '../../ui/ChangeItem';
import { CountLine, ListBar, ListSearch } from '../../ui/ListBar';
import { UndoImport, UndoneLine } from '../../ui/UndoImport';
import './import.css';

const IMPORTS = { thing: 'import', things: 'imports' };
const rows = (k: number) => `${k} ${k === 1 ? 'row' : 'rows'}`;

export function PastImports() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const all = pastImports(app.snapshot.changes);
  const words = (e: Change) => `${importName(e)} ${app.person(e.actorId)?.name ?? ''} ${e.diffs.find((d) => d.field === 'Via')?.to ?? ''} ${importCounts(e)}`;
  const list = q.trim() ? all.filter((p) => fold(words(p.entry)).includes(fold(q))) : all;
  const set = (v: string) => { const p = new URLSearchParams(params); if (v) p.set('q', v); else p.delete('q'); setParams(p, { replace: true }); };
  return (
    <div className="page narrow past-imports">
      <div className="page-head">
        <h1 className="title-xl">Past imports</h1>
        <span className="small muted">Every import, bulk edit and change through MCP, newest first. Whoever made one, or an admin, can undo it.</span>
      </div>
      {all.length === 0 ? (
        <p>Nothing has been imported yet. <Link className="btn" to="/data/import">Import</Link></p>
      ) : (
        <>
          <ListBar search={<ListSearch value={q} onSearch={(t) => set(t)} label="Find an import" placeholder="Find by file, person or what changed" />} />
          <CountLine things={IMPORTS} n={list.length} narrowed={!!q.trim()} order="newest first" />
          <ul className="removed-list past-imports-list">
            {list.map(({ entry, undone }) => <PastImport key={entry.id} entry={entry} undone={!!undone} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function PastImport({ entry, undone }: { entry: Change; undone: boolean }) {
  const app = useApp();
  const who = app.person(entry.actorId)?.name ?? 'Someone';
  const how = entry.diffs.find((d) => d.field === 'Via')?.to;
  // What Undo would put back, for those who may undo it: said only when some rows have changed since.
  let preview: { restores: number; skipped: unknown[] } | null = null;
  if (!undone && canUndoImport(app.snapshot, entry, app.viewer)) { try { preview = app.undoPreview(entry.entityId); } catch { preview = null; } }
  const k = preview?.skipped.length ?? 0;
  const m = preview?.restores ?? 0;
  return (
    <li className="removed-row past-import">
      <span className="removed-text">
        <Link className="removed-name linkish" to={`/data/import/done/${entry.entityId}`}>{importName(entry)}</Link>
        <span className="small muted">{who} · {whenText(entry.at, app.today)}{how ? ` · ${how}` : ''} · {importCounts(entry)}</span>
        {undone ? <UndoneLine entry={entry} /> : k > 0 ? <span className="small">{k} of its {rows(k + m)} {k === 1 ? 'has' : 'have'} changed since, so Undo would put back {m}.</span> : null}
      </span>
      {!undone && preview && (m > 0 ? <UndoImport entry={entry} label={k > 0 ? `Undo ${rows(m)}` : 'Undo'} className="btn" /> : null)}
    </li>
  );
}
