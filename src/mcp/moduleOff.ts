/* What a tool answers when its feature module is switched off in the workspace: one sentence, the same for every module
   (RS, docs/design/round-4/reviews-switch/spec.md 5). callTool says it for a module's own tools; a core tool that is
   partly a module's (edit_call on a note said in a review) says it too. */

/** "Reviews is switched off in {ws}, so {tool} can’t be used there. An admin can switch it on in Workspace, under Features." */
export const moduleOffSentence = (module: string, workspace: string, tool: string) =>
  `${module} is switched off in ${workspace}, so ${tool} can’t be used there. An admin can switch it on in Workspace, under Features.`;
