// Two example modules, the platform's proof (module-platform.md, "What proves it"): `example` adds a route, a menu row,
// a part in places, a Workspace section, a Help article, an action and AI tools, and keeps records of its own;
// `example-two` needs `example`, to prove that a module goes off with what it needs.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const notesOf = (data, goalId) => ((data.modules?.example?.notes) || []).filter((n) => !n.removedAt && (!goalId || n.goalId === goalId));

export const example = {
  id: 'example', name: 'Example', group: 'tools', needs: [],
  summary: 'An example of a module: a page, a menu row, a note on a goal’s page, a Help article and an AI tool.',
  navigation: [{ label: 'Example', group: 'lookup', to: '/example' }],
  sections: [{ id: 'example', label: 'Example', after: 'features', admins: false }],
  help: [{ id: 'example', title: 'Example', after: 'goals', body: ['The Example module shows how a module plugs into Faro: its own page, a row in the menu, a note on a goal’s page and an AI tool.', 'An admin switches it off on Workspace, Features. Nothing it saved is lost.'] }],
  records: [{ name: 'example note', key: 'notes', removable: true }],
  offWords: 'long',
  routes: {
    '/example': ({ data, h }) => ({ title: 'Example', body: `<h1>Example</h1><p class="lede">Notes kept by the Example module, one per goal at most.</p>${h.list(notesOf(data).map((n) => `<a href="/goals/${esc(n.goalId)}">${esc(h.goalTitle(n.goalId))}</a> · ${esc(n.text)}`), 'No example notes yet.')}` }),
    '/example/:id': ({ data, params, h }) => { const n = notesOf(data).find((x) => x.id === params.id); return { title: 'Example', body: `<h1>Example</h1><p>${n ? esc(n.text) : 'No such note.'}</p>` }; },
  },
  parts: {
    'goal.sections': ({ goal, data }) => {
      const ns = notesOf(data, goal.id);
      return `<section class="mod-part" data-module="example" aria-label="Example notes"><h3>Example notes</h3>${ns.length ? ns.map((n) => `<p>${esc(n.text)}</p>`).join('') : '<p class="quiet">No example note on this goal.</p>'}
<form method="post" action="/act/example.addNote"><input type="hidden" name="goalId" value="${esc(goal.id)}"><label>Add an example note <input name="text" required></label><button class="plain" type="submit">Add the note</button></form></section>`;
    },
    'home.blocks': ({ data }) => `<section class="mod-part" data-module="example" aria-label="Example"><h2>Example</h2><p>${notesOf(data).length} example notes in this workspace.</p></section>`,
    'features.line': ({ data }) => { const n = notesOf(data).length; return n ? `${n} example ${n === 1 ? 'note is' : 'notes are'} kept.` : ''; },
    'workspace.about': ({ data }) => '',
  },
  actions: {
    'example.addNote': {
      run: ({ actor, input, data, ids, now }) => {
        const text = String(input.text || '').trim();
        if (text.length < 3) return { error: 'Write a note of at least three characters.' };
        const id = ids('exn');
        return { commit: { modules: { example: { notes: [{ id, goalId: input.goalId, text, byId: actor, at: now }] } } }, change: { entity: 'example note', entityId: id, goalId: input.goalId, action: 'added', summary: `Added an example note: ${text}` }, message: 'The example note is saved.' };
      },
    },
    'example.removeNote': {
      whileOff: true, // takes something away: may run while the module is off
      run: ({ actor, input, data, now }) => {
        const n = notesOf(data).find((x) => x.id === input.id);
        if (!n) return { error: 'There’s no such example note.' };
        return { commit: { modules: { example: { notes: [{ ...n, removedAt: now, removedBy: actor }] } } }, change: { entity: 'example note', entityId: n.id, goalId: n.goalId, action: 'removed', summary: `Removed an example note: ${n.text}` }, message: 'The example note is removed.' };
      },
    },
  },
  tools: [
    { name: 'example_notes', title: 'Example notes', description: 'Lists the Example module’s notes, optionally for one goal.', annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', additionalProperties: false, properties: { goal: { type: 'string', description: 'A goal’s id or key.' } } },
      call: ({ args, data, h }) => { const g = args.goal ? h.findGoal(args.goal) : null; const ns = notesOf(data, g?.id); return { text: ns.length ? ns.map((n) => `${h.goalTitle(n.goalId)}: ${n.text}`).join('\n') : 'No example notes.', data: { notes: ns } }; } },
    { name: 'example_add_note', title: 'Add an example note', description: 'Adds an Example note to a goal. dry_run: true says what it would save.', annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: { type: 'object', additionalProperties: false, required: ['goal', 'text'], properties: { goal: { type: 'string' }, text: { type: 'string' }, dry_run: { type: 'boolean' } } },
      call: ({ args, h }) => h.runAction('example.addNote', { goalId: h.findGoal(args.goal)?.id, text: args.text }, args.dry_run) },
  ],
};

export const exampleTwo = {
  id: 'example-two', name: 'Second example', group: 'tools', needs: ['example'],
  summary: 'An example of a module that needs another: it is off whenever Example is.',
  parts: { 'goal.facts': () => '<p class="fact mod-part" data-module="example-two">Second example is on for this goal.</p>' },
  offWords: 'short',
};
