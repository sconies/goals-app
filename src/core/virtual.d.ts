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
declare module 'virtual:faro-modules/spec' {
  const spec: { id: string; part: import('../spec/rules').Rule[] }[];
  export default spec;
}
