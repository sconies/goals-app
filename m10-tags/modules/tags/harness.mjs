// Starts the rebuild's app on a port of its own, for the module's tests and journeys, and speaks to it as a person.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.resolve(here, '../../app/server.mjs');

export async function start(port) {
  const child = spawn(process.execPath, [server, String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 200; i++) {
    try { const r = await fetch(base + '/'); if (r.ok) break; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 100));
    if (child.exitCode !== null) throw new Error(`The app stopped: ${err}`);
  }
  // a kept-alive connection the app has closed fails once: ask again
  const fetch = async (u, o) => { try { return await globalThis.fetch(u, o); } catch { await new Promise((r) => setTimeout(r, 50)); return globalThis.fetch(u, o); } };
  const as = (who) => ({ cookie: `as=${who}; today=2026-11-05` });
  const api = {
    base, child,
    stop: () => child.kill(),
    reset: () => fetch(base + '/__reset', { method: 'POST' }),
    get: async (who, p) => { const r = await fetch(base + p, { headers: as(who) }); return { status: r.status, url: r.url, text: await r.text() }; },
    post: async (who, p, form, follow = true) => { const r = await fetch(base + p, { method: 'POST', headers: { ...as(who), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString(), redirect: follow ? 'follow' : 'manual' }); return { status: r.status, url: r.url, location: r.headers.get('location'), text: await r.text() }; },
    tool: async (who, name, args = {}) => { const r = await fetch(base + '/mcp', { method: 'POST', headers: { ...as(who), 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }); const j = await r.json(); return { error: j.result.isError, text: j.result.content[0].text, data: j.result.structuredContent }; },
    setModule: (on) => api.post('amara', '/workspace/features', { module: 'tags', on: on ? '1' : '0' }),
    async fieldId(name) { const t = (await api.tool('amara', 'list_fields')).data; return [...(t?.fields || []), ...(t?.retired || [])].find((f) => f.name === name)?.id; },
    /** Fields' journeys' seed (seedStage): Stage on two goals, Flaky test rate in Build and Base image build time in Discover. */
    async seedStage() {
      await api.post('amara', '/workspace/fields/add', { name: 'Stage', kind: 'list', values: 'Discover\nBuild\nRun' });
      const id = await api.fieldId('Stage');
      await api.post('amara', '/goals/lead-flaky/fields', { field: id, value: 'Build' });
      await api.post('amara', '/goals/ci-docker/fields', { field: id, value: 'Discover' });
      return id;
    },
    async load(who, name, text, answers = {}, save = false) {
      const form = { name, file: text, ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [`ans:${k}`, v])) };
      if (save) form.save = '1';
      return api.post(who, '/data/import', form);
    },
  };
  return api;
}
export const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
