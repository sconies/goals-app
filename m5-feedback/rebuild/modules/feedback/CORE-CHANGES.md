# Core changes for stage 5 (Feedback)

Five core files changed. All but one are generic extension points the module platform lacked; none names Feedback.

| File | Change | Why |
|---|---|---|
| `app/state.mjs` | Modules are found as folders (`modules/<id>/module.mjs`) at start; a module's own facts replace the placeholder row in `INSTALLED`. | The core only knew `exampleModule` by import: a module in its own folder had no way in. |
| `platform.mjs` | The registry adds `assets(on)` (a module's styles and scripts on every page while on), `prompts()` and `redirects()`. | Feedback needs a script on every page (Ctrl+Shift+M, the sheet), an MCP prompt (`review_inbox`) and old addresses (`/inbox`, `/workspace/inbox`, `/workspace?inbox=1&markup=…`). The kit's platform lists `redirects` as a fact but stage 3 never built them; assets and prompts are not in the kit's list at all. |
| `app/server.mjs` | (a) `/m/<id>/…` goes to a module's `serve` (its JSON doors, pictures and files); (b) module redirects, which say the module's sentence while it is off; (c) a module page is given the request's `url`, and a route can be a place's first page (no back link); (d) a Help article the guide marks “from the <id> module” is left to that module when its code registers it (so it goes while the module is off); (e) the core's hard-coded `/feedback` page and its switched-off sentence are gone. | (a) the core's form posts only redirect; markups need JSON in and out. (d) the core read every guide article, module ones included, so Feedback's two articles stayed while it was off. (e) the core named a module and said “switched off” even when Feedback was left out of the build. |
| `app/pages.mjs` | The shell adds the on modules' styles and scripts; the goal page names its parts `Goal page`, `Summary bar` and `Scorecard` (`data-part`). | A markup names the parts its marks cover (screens.md lists them; stage 3 built three parts in all, none on a goal's page). |
| `app/mcp.mjs` | `prompts/list` and `prompts/get` answer the modules' prompts; a tool's result may carry more content (images) after its text; `GET ?check` reports `pictures` from the modules that keep them. | MCP-PICTURES: pictures come back as image content, and `review_inbox` is also a prompt. |

Not changed, though the kit says the core owns them: the menu row (`screens.mjs` `menuFor` already draws Feedback after Help while it is on), the switch, the sentences.
