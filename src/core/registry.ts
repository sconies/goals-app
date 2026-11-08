/* The modules this build has (vite.modules.ts), as plain data: their facts, and which are on in a workspace. No
   screens here, so the MCP server and the guide read it too. Screens come from src/core/app.tsx. */
import FACTS from 'virtual:faro-modules';
import { resolveModules, type ModuleFacts } from './module';

/** Every module in this build, in id order. */
export const MODULES: readonly ModuleFacts[] = FACTS;

/** A module's facts, if this build has it. */
export const moduleById = (id: string) => MODULES.find((m) => m.id === id);

/** The modules on in a workspace: in this build, not switched off there, and with what they need on. */
export const modulesOn = (ws: { modulesOff?: readonly string[] } | null | undefined) => resolveModules(MODULES, ws?.modulesOff ?? []);

/** Whether a module is on in a workspace. */
export const isModuleOn = (ws: { modulesOff?: readonly string[] } | null | undefined, id: string) => modulesOn(ws).on.has(id);
