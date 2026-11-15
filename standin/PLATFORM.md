# The stand-in platform (drill item 11, Lane 15 Nov)

The internal team will have Faro's code, kit and running app. Their job is moving Faro onto their own platform (their sign-in and SSO, data store, hosting), not Supabase and Vercel. The drill rebuilds Faro on a small generic platform that stands in for theirs, and measures what ports, what must be rewired, and whether the spec named everything Faro needs from a platform.

## What the stand-in platform is (keep it this small)
- **Runtime and hosting:** Node 22, one plain server built on `node:http` (no Vercel, no serverless functions, no framework beyond what Faro already depends on). It serves the built app, a JSON API under `/api/`, and the MCP server at `/mcp`.
- **Data store:** SQLite through Node's built-in `node:sqlite` (`DatabaseSync`), one file. No Postgres, no row-level security, no database functions: every access rule is enforced in the server. Schema changes are plain numbered `.sql` files the server applies in order at start.
- **Sign-in:** the platform's own: email and password (hashed with `crypto.scrypt`), a session cookie (HttpOnly, SameSite=Lax), sign-out. Workspace membership and roles live in the platform's tables.
- **Stub SSO:** `/sso/stub` acts as the company's identity provider: it lists a few people, issues an HMAC-signed assertion (email, name, groups), and the server's `/sso/callback` signs the person in. A `left` flag on a stub person stands for a leaver: their next request is refused and their sessions end.
- **Files:** a local folder (`data/files/`) behind a tiny files API (put, get, delete), for anything Faro keeps as a file (images, uploads, exports).
- **Jobs:** a `setInterval` scheduler in the server for anything Faro runs on a timer.
- **Nothing else:** no Supabase client, no `@supabase/*`, no Vercel config, no edge functions. `grep -ri supabase` over the server and the new adapters must find nothing.

## Inputs every rebuild session gets
- Faro's code at the pin (a copy, `faro/`), its kit (`faro/spec/`, `faro/llms.txt`), and the running app: https://goals-app-puce-five.vercel.app/demo?today=2026-11-11 (demo workspace, no sign-in; Demo controls, Start over resets it).
- Start from `spec/rebuild/adapters.md` (swap the outside parts), `ports-at-scale.md`, `dont-copy.md` and `spec/requirements/internal/` (R1 to R5 and the rest): they are what the spec says a platform must provide.

## What each stage measures
(a) **Ported as-is:** files copied unchanged (count, and which folders: `src/domain` is expected to copy almost untouched).
(b) **Rewired:** every file changed or written for the platform (auth, storage, migrations, MCP server, the import's file handling, jobs), with lines added and removed (`git diff --stat` against the pin copy) and why.
(c) **Platform requirements:** everything Faro needed from the platform, each marked NAMED (the spec says it: cite file and line) or GAP (the spec didn't name it: what was needed, where it showed).
(d) **Behaviour first:** Faro's own unit tests on the copy (`npm test`), the conformance harness (`npm run drill -- scripts/drill-faro` and the rebuild's own drill where it applies), each port's contract test passing against the stand-in adapters, and the rules on the running stand-in (the stage's requirements and conformance rows). Journeys are secondary: run what you can against the stand-in server and say which failures are only class names or wording.
