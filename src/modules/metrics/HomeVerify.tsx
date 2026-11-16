/* A verifier's line on Home (MQ2 journey 3): "2 metrics to verify", the ones on "To verify" this person may verify
   (rulesLibrary toVerifyFor), each a link to its page. Nothing when there are none. Loaded only when Home shows it. */
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import { toVerifyOf } from './reads';
import { metricPath } from './rulesLibrary';
import { onDay } from './rulesQuality';
import './metrics.css';

/** At most this many names on Home; the rest are in the library's "To verify". */
const SHOWN = 3;

export function HomeVerify() {
  const app = useApp();
  const rows = toVerifyOf(app.snapshot, app.stamp(), app.viewer);
  if (!rows.length) return null;
  const more = rows.length - SHOWN;
  return (
    <section className="home-block metric-home-verify stack" aria-labelledby="metric-home-verify" data-part="Metrics to verify">
      <h2 className="label" id="metric-home-verify">Metrics to verify</h2>
      <p>{rows.length === 1 ? '1 metric to verify' : `${rows.length} metrics to verify`}.</p>
      <ul className="metric-home-verify-list">
        {rows.slice(0, SHOWN).map(({ metric: m, stage: st }) => (
          <li key={m.id}>
            <Link to={metricPath(m)}>{m.name}</Link>
            {st.stage === 'verified' && st.dueBy ? <span className="small muted"> · due {onDay(st.dueBy)}</span> : st.lapsed ? <span className="small muted"> · no longer Verified</span> : null}
          </li>
        ))}
      </ul>
      {more > 0 && <p className="small"><Link to="/metrics?verify=1">{more === 1 ? '1 more' : `${more} more`} in To verify</Link></p>}
    </section>
  );
}
