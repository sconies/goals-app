/* A review's order, fixed when a session starts so moving between goals doesn't reshuffle it. Its own small file: Home
   saves it when someone starts walking a review, and Home is in the first download, while the walk itself
   (Inspect.tsx) loads with the goal page. */
const orderKey = (ws: string, review: string, week: number) => `goals-app-review:${ws}:${review}:${week}`;
export function saveReviewOrder(ws: string, review: string, week: number, ids: string[]) {
  try { sessionStorage.setItem(orderKey(ws, review, week), JSON.stringify(ids)); } catch { /* private mode: the live order is used */ }
}
export function loadReviewOrder(ws: string, review: string, week: number): string[] | null {
  try { const v = sessionStorage.getItem(orderKey(ws, review, week)); return v ? (JSON.parse(v) as string[]) : null; } catch { return null; }
}
