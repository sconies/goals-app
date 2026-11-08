/* The Cards layout: a card per goal, its number straight under its title so cards compare. */
import { Link } from 'react-router';
import { Chip, LevelTag, TitleTell } from '../ui/bits';
import { hasStory, Keep, ResultTag, StoryLines } from '../ui/GoalStory';
import { useSummaries, GroupHead, type ViewGroup } from './GoalViews';

export function GoalCards({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  return (
    <>
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="gcards">
              {g.rows.map(({ goal }) => {
                const s = sums.get(goal.id)!;
                return (
                  <Link key={goal.id} to={'/goals/' + goal.id} className="gcard" data-tone={s.status}>
                    <span className="row between nowrap"><Chip k={s.status} /><LevelTag level={goal.level} /></span>
                    <span className="gcard-title">{goal.title}</span><TitleTell goal={goal} />
                    {/* The number straight under the title, in the same place on every card, so cards compare (visual review 2). */}
                    <span className="gcard-figure"><span className="gcard-now">{s.now}</span><span className="small"><Keep text={`target ${s.target}`} />{s.gap !== s.now && <> · <span className={'tone-' + s.gapTone}><Keep text={s.gap} /></span></>}</span></span>
                    <span className="hint"><Keep text={`${s.owner} · ${s.team}${s.story.since && s.status !== 'stale' ? ` · ${s.story.since.toLowerCase()}` : ''}`} /></span>
                    <ResultTag s={s} />
                    {hasStory(s) ? <StoryLines s={s} brief /> : <span className="small">{s.story.where}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
