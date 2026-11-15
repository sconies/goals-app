import { App } from '../app/state.mjs';
import * as O from '../modules/metrics/ops.mjs';
const app = new App(); app.now = app.W.builtFor;
console.log(O.saveMetric(app, 'oskar', { name: 'Build time', unit: 'min', direction: 'lower' }));
