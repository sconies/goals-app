/* A small replay of a goal page's landing for Settings: the number counts up and thumps, the line draws in to its
   latest point (a thump and a ring), the card jolts, and the off-track status shakes. It uses the goal page's own
   classes, so it moves exactly as the page will. Replays whenever a setting changes, or on Replay. */
import { useState } from 'react';
import { CountNumber } from './Count';
import { StatusShape } from './bits';
import { STORY_MS } from './motion';

const PLAN = [[8, 70], [44, 62], [80, 54], [116, 46], [152, 38], [188, 30], [224, 22]];
const ACT = [[8, 72], [44, 66], [80, 63], [116, 58], [152, 56], [188, 52]];
const path = (pts: number[][]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

export function MotionPreview({ pace, countOn, replayKey }: { pace: number; countOn: boolean; replayKey: string }) {
  const [n, setN] = useState(0);
  const key = `${replayKey}-${n}`;
  const last = ACT[ACT.length - 1]!;
  return (
    <div className="motion-preview goal-page" aria-label="Preview of a goal's page moving">
      <div key={key} className="motion-preview-stage">
        <header className="goal-bar" data-tone="off">
          <div className="bar-2">
            <span className="bar-status status-word tone-off"><StatusShape k="off" /> Off track</span>
            <span className="bar-now"><CountNumber value={83} from={countOn ? 61 : null} format={(v) => `${Math.round(v)}%`} duration={STORY_MS * pace} /></span>
          </div>
        </header>
        <figure className="goal-chart card" style={{ margin: 0 }}>
          <svg className="chart draw" viewBox="0 0 232 80" width="100%" height="80" aria-hidden="true">
            <polyline className="c-plan" points={path(PLAN)} />
            <polyline className="c-act" points={path(ACT)} />
            <circle className="c-dot-ring" cx={last[0]} cy={last[1]} r={4} />
            <circle className="c-dot c-last" cx={last[0]} cy={last[1]} r={4} />
          </svg>
        </figure>
      </div>
      <button type="button" className="btn sm ghost" onClick={() => setN((x) => x + 1)}>Replay</button>
    </div>
  );
}
