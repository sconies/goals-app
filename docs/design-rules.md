# Design rules

This app must not look like a default AI-generated interface. These rules are enforced. The **design check** (`P6` in `npm run evals`) inspects every screen at phone and desktop width and fails the build if a banned pattern appears.

## Banned

1. **Coloured edges.** No stripe on one side of a card, row, panel, tile or node. That covers:
   - `border-left`, `border-top` or any other single side, 2px or thicker;
   - one side coloured differently from the others;
   - an inset `box-shadow` bar.

   This is the commonest default-AI tell, especially on rounded rectangles.
2. **Quote bars.** No vertical rule beside quoted or carried-over text.
3. **Emoji or dingbats as icons.** No ⚠ ✓ ✗ ✔ ❌ ⭐ 🔥 in the interface. Icons are the app's own SVG shapes.
4. **Gradients, glass, glows and heavy floating shadows.** Surfaces are flat.
5. **Pastel pill badges for states.** States are text with a shape, not filled capsules.

## What we do instead

- **Status is a shape plus a word, always together.** Shapes: filled circle for on track, half circle for at risk, open ring for off track, dashed ring for no recent update, ticked circle for done. They sit where the eye starts: the first thing on a row, card or node.
- **Emphasis through type and placement,** not colour blocks: weight, size, order, and the status word itself.
- **Off track gets a quiet full-surface wash** (`--off-wash`) on the whole container, never an edge. At risk and no recent update get no wash; the shape and word carry them.
- **Lists are hairline-divided rows,** not floating cards, except where the layout is cards by choice (Cards and Board views).
- **Selection and errors cover the whole element:** a full outline on every side, or a wash. Never a side bar.
- **Quotes are labelled,** for example "Maya said in week 42", followed by the text at normal weight. There is no rule beside them.
- **Results** (Completed, Completed late, Did not meet) are words in the status colour, set in small capitals, with no capsule.

- **Status shapes mean a status, and only that.** A flag that isn't a status (a worsening trend, a missed date, no recovery plan) uses the warning mark. Every shape on screen has its status word beside it, checked by P3 and P4.

## Every screen size

Each kind of page gets the room it needs, from a 360px phone to a 3440px monitor (checked by P7):

- **Focused tasks** (check-in, a wizard) stay narrow: one column, about 600px.
- **Reading pages** (Activity, Reviews) are narrow: 760px.
- **Home, a goal and Watching** are one column up to 800–1040px. Once the page has 1100px, they put a side column (340–400px) beside the main one: what needs your response; the owner's account and recovery plan; what changed this week. With nothing for the side, they stay one column.
- **Portfolio views** (Table, Board, History, Cards) get a wide frame, up to 1760px. A table never clips: its columns share one set of widths, text wraps, and Trend, then Owner, give way when it's narrow.
- **The map** gets the whole work area, as tall as the window.
- On a very wide monitor, a page sits close to the sidebar rather than floating in the middle.
- On touch screens, every control is at least 44px to hit.

## Changing a pattern

You can vary patterns, but a new one must:

- keep status as shape plus word;
- pass the design check on every screen;
- not reintroduce anything on the banned list.

If you're unsure, choose plainer.
