// The example module (module-platform.md, "What proves it"): a route, a menu row, a part in a place, a Help article,
// an action and an AI tool, with records of its own under modules.example. The core never names it.
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const exampleModule = {
  id: 'example', name: 'Example', group: 'tools', summary: 'A module that only shows the platform works: a page, a line on each goal and a note you can add.', needs: [],
  menu: { to: '/example', label: 'Example', group: 'lookup' },
  routes: [{ path: '/example', name: 'Example', help: 'example' }, { path: '/example/one', name: 'Example', help: 'example' }],
  places: {
    'goal.facts': ({ goal, app }) => { const n = ((app.W.modules.example || {}).notes || []).filter((x) => x.goalId === goal.id).length; return `<p class="fact" data-module="example">Example: ${n} ${n === 1 ? 'note' : 'notes'}</p>`; },
    'home.blocks': () => '',
  },
  help: [{ id: 'example', after: 'getting-around', title: 'The example module', body: 'The example module adds a page, a line on each goal and a note. It shows how a module plugs into Faro.' }],
  page: (app, viewer) => {
    const notes = (app.W.modules.example || {}).notes || [];
    return `<h1>Example</h1><p>${notes.length} ${notes.length === 1 ? 'note' : 'notes'} kept.</p>
      <form method="post" action="/act/example.note"><label>Note <input name="text" required></label><input type="hidden" name="goalId" value="${h(app.W.goals[0].id)}"><button class="primary">Add a note</button></form>
      <ul>${notes.map((n) => `<li>${h(n.text)}</li>`).join('')}</ul>`;
  },
  actions: {
    'example.note': (app, actor, input) => {
      if (!String(input.text || '').trim()) return { error: 'Write a note first.' };
      app.W.modules.example = app.W.modules.example || { notes: [] };
      app.W.modules.example.notes = app.W.modules.example.notes || [];
      app.W.modules.example.notes.push({ id: `ex_${app.W.modules.example.notes.length + 1}`, goalId: input.goalId || null, text: String(input.text).trim(), by: actor });
      return { ok: true, summary: `Added an example note`, diffs: [{ field: 'Note', from: '—', to: String(input.text).trim() }] };
    },
  },
  aiTools: [{
    name: 'example_notes', title: 'Example notes', description: 'Lists the example module’s notes.', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    run: (app) => { const notes = (app.W.modules.example || {}).notes || []; return { text: notes.length ? notes.map((n) => `- ${n.text}`).join('\n') : 'No example notes yet.', structured: { notes } }; },
  }],
};
