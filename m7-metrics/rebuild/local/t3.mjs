import { App } from '../app/state.mjs';
import * as O from '../modules/metrics/ops.mjs';
const app = new App(); app.now = app.W.builtFor;
console.log(O.saveMetric(app, 'rhea', { id: 'metric_lead-time', unit: 'h' }, { relabel: true, confirm: true, answers: { unit: 'keep' } }));
