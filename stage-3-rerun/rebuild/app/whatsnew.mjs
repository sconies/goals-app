// What's new: one small file per release in whatsnew/, put together here, newest first.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'whatsnew');
export const WHATS_NEW = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
