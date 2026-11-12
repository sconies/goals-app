/* The module registry the build makes (vite.modules.ts): one entry per module folder in src/modules that this build
   keeps. Read it through src/core/registry.ts (facts, help, tools) and src/core/app.tsx (screens). */
declare module 'virtual:faro-modules' {
  const facts: import('./module').ModuleFacts[];
  export default facts;
}
declare module 'virtual:faro-modules/help' {
  const help: { id: string; part: import('../help/guide').Article[] }[];
  export default help;
}
declare module 'virtual:faro-modules/tools' {
  const tools: { id: string; part: import('../mcp/tools').ToolDef[] }[];
  export default tools;
}
declare module 'virtual:faro-modules/app' {
  const app: { id: string; part: import('./app').AppModule }[];
  export default app;
}
declare module 'virtual:faro-modules/records' {
  const records: { id: string; part: Omit<import('../domain/records').ModuleRecords, 'module'> }[];
  export default records;
}
declare module 'virtual:faro-modules/actions' {
  const actions: { id: string; part: import('../app/actions').ModuleActions }[];
  export default actions;
}
declare module 'virtual:faro-modules/demo' {
  const demo: { id: string; part: (b: import('../domain/records').DemoBuild) => void }[];
  export default demo;
}
declare module 'virtual:faro-modules/spec' {
  const spec: { id: string; part: import('../spec/rules').Rule[] }[];
  export default spec;
}
declare module 'virtual:faro-modules/conformance' {
  const conformance: { id: string; part: import('../spec/conformance').ModuleConformance[] }[];
  export default conformance;
}
/* The Help index the build makes (vite.helpIndex.ts): the guide's and What's new's ids, titles and routes, without
   their text. Read it through src/help/lookup.ts. */
declare module 'virtual:faro-help-index' {
  const index: import('../../vite.helpIndex.ts').HelpIndex;
  export default index;
}
/* Every What's new release's id, date and title (vite.helpIndex.ts), for the screens that list them. Read it through
   src/help/newsIndex.ts; the first download never imports it. */
declare module 'virtual:faro-news-index' {
  const index: { news: import('../../vite.helpIndex.ts').NewsRef[] };
  export default index;
}
