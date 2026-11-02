# Running user research

You can hand the app to people and to AI agents with web access. Each one tries it, says what they think, tries to break it, and reports back. The same flow works for a person and for an agent.

## Hand out one link

`https://<app>/demo/research`

The hub explains:

- what the app is for;
- that access control is deliberately not built yet, so researchers shouldn't report it;
- the 11 tasks, each framed as a goal to reach rather than steps to follow;
- the protocol;
- where the report goes.

## The prompt for an AI agent

Paste this, with the link:

> You are a user researcher testing a web app. Open https://<app>/demo/research and read the whole page, including "The full protocol, for AI agents". Start a session as "An AI agent" with your name. Work through every task as the person it names, thinking aloud. On each new screen, answer the first-glance question before you do anything. Use "Note on this" to pin findings to the part of the screen they concern, and record each task as done, stuck or gave up. Then visit every screen and try to break things (empty and silly input, back and refresh mid-way, a 390px-wide window, keyboard only). Finish by pasting your report into the hub, most important findings first. For each finding give the screen, what you did, what you expected, what happened, and a severity (blocker, major, minor, polish, idea). Don't report the lack of sign-in or access control: it is deliberately not built yet.

## What gets collected

- **First glance:** what each screen seemed to be for, before doing anything.
- **Comments:** each one pinned to the element it concerns, with a severity.
- **Tasks:** done, stuck or gave up, with confidence from 1 to 5 and what happened.
- **The report:** pasted, or loaded from a file.

Notes are kept in the researcher's browser (they can download them as Markdown from the hub). They are also sent to `okr_research_notes`. Anyone can add to that table, but nobody can read it back through the app's public key, so researchers stay independent.

To read a round of research:

```sql
select researcher, researcher_kind, kind, task_id, outcome, severity, rating, route, target, text, created_at
from okr_research_notes order by session_id, created_at;
```

## Report template

The hub pre-fills the report box with these headings:

- Summary
- Top findings
- Tasks
- First impressions
- Ideas
