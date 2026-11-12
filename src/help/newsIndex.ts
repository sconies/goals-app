/* Every What's new release's id, date and title, without their text (vite.helpIndex.ts): for the screens that list
   them, such as the markup inbox's "Fixed in". The first download never imports this file, so a new release never
   grows it; the first download knows only the newest release (src/help/lookup.ts). */
import INDEX from 'virtual:faro-news-index';
import type { NewsRef } from './lookup';

/** Every release, newest first. */
export const NEWS: readonly NewsRef[] = INDEX.news;
