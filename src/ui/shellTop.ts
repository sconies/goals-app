/* On a phone, a goal's summary bar takes the app header's place (the flagship goal page, 5 Nov): the header's own
   controls, the Demo tag and the person button, stay small at the bar's right. The Shell hands them down here. */
import { createContext, useContext, type ReactNode } from 'react';

export const ShellTopContext = createContext<ReactNode>(null);
/** The header's controls, for a page whose own bar replaces the header on a phone. */
export const useShellTop = () => useContext(ShellTopContext);

/** A goal's own page, outside a review walk: the pages whose summary bar is the header on a phone. */
export const isGoalTop = (pathname: string, search: string) => /^\/goals\/(?!new$)[^/]+$/.test(pathname) && !/[?&]review=/.test(search);
