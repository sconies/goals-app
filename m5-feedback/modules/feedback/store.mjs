// The builders' inbox: every markup and piece of feedback, from every workspace and the demo.
// It is not a workspace's: switching Feedback off, or resetting a workspace, leaves it as it is.
// Kept in memory, and in a JSON file when FARO_INBOX_FILE names one.
import fs from 'node:fs';
import crypto from 'node:crypto';

export function makeInbox(file = process.env.FARO_INBOX_FILE) {
  let items = [];      // { kind: 'markup'|'feedback', id, workspace, demo, personId, personName, at, status, ... }
  let pictures = new Map(); // markup id -> { 'screen.svg', 'ink.svg', 'marked.svg' }
  const changes = []; // { id, at, by, via, before, after }
  if (file && fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    items = j.items || []; pictures = new Map(Object.entries(j.pictures || {}));
  }
  const save = () => { if (file) fs.writeFileSync(file, JSON.stringify({ items, pictures: Object.fromEntries(pictures) })); };
  const issued = new Set();
  return {
    newMarkupId() { const id = `mk_${crypto.randomBytes(8).toString('hex')}`; issued.add(id); return id; },
    idOk: (id) => issued.has(id) && !items.some((x) => x.id === id),
    newFeedbackId: () => `fb_${crypto.randomBytes(8).toString('hex')}`,
    // The public key can only add: a new row always arrives New, with no triage columns.
    add(row, pics) {
      const clean = { ...row, status: 'new', fixedIn: null, wontFixReason: null, issueUrl: null, statusBy: null, statusAt: null };
      items.push(clean);
      if (pics) pictures.set(row.id, pics);
      save();
      return clean;
    },
    all: () => items.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1)),
    get: (id) => items.find((x) => x.id === id) || null,
    picture: (id, name) => pictures.get(id)?.[name] ?? null,
    hasPictures: (id) => pictures.has(id),
    // Only the triage columns change.
    patch(id, cols, meta) {
      const x = items.find((i) => i.id === id);
      if (!x) return null;
      const before = {};
      for (const k of ['status', 'fixedIn', 'wontFixReason', 'issueUrl', 'statusBy', 'statusAt', 'statusVia']) if (k in cols) { before[k] = x[k] ?? null; x[k] = cols[k]; }
      changes.push({ id, at: meta?.at, by: meta?.by, via: meta?.via || null, before, after: cols });
      save();
      return x;
    },
    changes: () => changes.slice(),
    reset() { items = []; pictures = new Map(); changes.length = 0; save(); },
  };
}
