/* The way in to Metrics from Data (the data.tools place): a quiet link beside Columns, Saved layouts and Spreadsheets. */
import { Link } from 'react-router';

export function MetricsLink() {
  return <Link className="btn ghost data-metrics" to="/data/metrics">Metrics</Link>;
}
