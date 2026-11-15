// The Goal map module: one of Goals' layouts. It owns no records, routes, menu rows, Home cards or AI tools.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from '../../app/modules.mjs';
import { renderMap } from './screen.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

register({
  id: 'goal-map',
  name: 'Goal map',
  group: 'Tools',
  about: 'See every goal and what feeds it on one canvas, with the path the risk runs along.',
  layouts: [{
    id: 'map',
    label: 'Map',
    about: 'Every goal and what feeds it, on one canvas.',
    offNotice: 'The Goal map is off here, so this is the List.',
    wide: true,
    render: renderMap,
  }],
  help: [{ title: 'The goal map', id: 'goal-map' }],
  assets: { 'rules.mjs': path.join(here, 'rules.mjs'), 'map.js': path.join(here, 'public/map.js') },
});
