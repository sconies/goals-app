// A test-only module that fills every place and hook the platform has, so each can be checked against the screen that draws it.
// Installed only when the app starts with FARO_PROBE=1.
import { PLACES } from '../app/platform.mjs';
const mark = (place) => () => (place === 'goals.layouts' ? `<option value="probe" data-probe="${place}">Probe layout</option>` : place === 'features.line' ? 'Probe line.' : `<span data-probe="${place}">probe:${place}</span>`);
export const probe = {
  id: 'probe', name: 'Probe', group: 'beyond', needs: [], summary: 'A test module that draws in every place.',
  navigation: [{ label: 'Probe', group: 'work', to: '/probe' }],
  sections: [{ id: 'probe', label: 'Probe', after: 'access', admins: true }],
  help: [{ id: 'probe', title: 'Probe', after: 'home', body: ['The probe module’s own article.'] }],
  routes: { '/probe': () => ({ title: 'Probe', body: '<h1>Probe</h1>' }), '/probe/:id': ({ params }) => ({ title: 'Probe', body: `<h1>Probe ${params.id}</h1>` }) },
  redirects: [['/old-probe', '/probe']],
  parts: Object.fromEntries(PLACES.filter((p) => !['features.readBack', 'menu.count'].includes(p)).map((p) => [p, mark(p)]).concat([
    ['features.readBack', ({ on }) => `<p data-probe="features.readBack">${on ? 'The probe comes back.' : '2 probe records stay.'}</p>`],
    ['menu.count', () => '3'],
  ])),
  hooks: { beforeCheckIn: ({ input }) => (input.why === 'probe refuses' ? { error: 'The probe refuses this check-in.' } : null) },
  actions: { 'probe.poke': { run: ({ input }) => ({ commit: { modules: { probe: { pokes: [{ id: `poke_${Date.now()}`, at: new Date().toISOString(), note: input.note || '' }] } } }, change: { entity: 'poke', action: 'poked', summary: 'Poked the probe' }, message: 'Poked.' }) } },
  tools: [{ name: 'probe_ping', title: 'Probe ping', description: 'Answers pong.', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', additionalProperties: false, properties: {} }, call: () => ({ text: 'pong' }) }],
  offWords: 'short',
};
