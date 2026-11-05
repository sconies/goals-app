/* Every download goes through saveFile: one naming rule, one way of saving, one way of saying it failed. */
import { fileName, saveAndSay, saveFile, slug } from './files';

const date = new Date('2026-11-05T09:30:00Z');

describe('the naming rule: <workspace>-<what>-<scope>-<date>', () => {
  it('joins the parts in order, each made safe for any file system', () => {
    expect(fileName({ workspace: 'Platform Engineering', what: 'goals', scope: 'Year 2026', date }, 'xlsx')).toBe('platform-engineering-goals-year-2026-2026-11-05.xlsx');
    expect(fileName({ workspace: 'Platform Engineering', what: 'check-ins', scope: 'Off track & at risk', date }, 'csv')).toBe('platform-engineering-check-ins-off-track-at-risk-2026-11-05.csv');
  });

  it('leaves out an empty scope rather than leaving a double hyphen', () => {
    expect(fileName({ workspace: 'Platform', what: 'activity', scope: '', date }, 'csv')).toBe('platform-activity-2026-11-05.csv');
    expect(fileName({ workspace: 'Platform', what: 'template', date }, 'xlsx')).toBe('platform-template-2026-11-05.xlsx');
  });

  it('never starts with nothing: a workspace without a usable name is "goals"', () => {
    expect(fileName({ workspace: '  ', what: 'ai brief', date }, 'md')).toBe('goals-ai-brief-2026-11-05.md');
  });

  it('keeps letters with accents as plain letters', () => {
    expect(slug('Équipe Données')).toBe('equipe-donnees');
  });
});

describe('saving a file', () => {
  let made: Blob[] = [];
  let clicked: string[] = [];
  beforeEach(() => {
    made = []; clicked = [];
    URL.createObjectURL = vi.fn((b: Blob) => { made.push(b); return 'blob:x'; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads under the rule’s name, with a byte-order mark on CSV so Excel keeps accents', async () => {
    const name = await saveFile({ workspace: 'Platform', what: 'goals', scope: 'Mine', date }, { kind: 'csv', text: 'Goal\nCafé' });
    expect(name).toBe('platform-goals-mine-2026-11-05.csv');
    expect(clicked).toEqual(['platform-goals-mine-2026-11-05.csv']);
    expect(made[0]!.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await made[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('says it saved, or says what went wrong, the same way everywhere', async () => {
    const toast = vi.fn();
    expect(await saveAndSay(toast, { workspace: 'P', what: 'brief', date }, { kind: 'md', text: '# Hi' }, 'Brief saved')).toBe(true);
    expect(toast).toHaveBeenLastCalledWith('Brief saved');
    URL.createObjectURL = vi.fn(() => { throw new Error('the browser refused'); }) as typeof URL.createObjectURL;
    expect(await saveAndSay(toast, { workspace: 'P', what: 'brief', date }, { kind: 'md', text: '# Hi' }, 'Brief saved')).toBe(false);
    expect(toast).toHaveBeenLastCalledWith('Couldn’t save the file: the browser refused', 'error');
  });
});
