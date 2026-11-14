/* The app's Prefs (src/ports/prefs.ts): this browser's, with the few that follow a person between devices kept on the
   server too (adapters/serverPrefs). The app's state hands it each workspace's server rows as it loads; screens reach
   it through usePrefs() (app/search). */
import { browserPrefs } from '../adapters/local';
import { serverPrefs } from '../adapters/serverPrefs';

export const prefs = serverPrefs(browserPrefs('faro-prefs:'));
