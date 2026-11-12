/* A review's goal order, fixed when a session starts so moving between goals doesn't reshuffle it (this tab only).
   Its own small file so Home can start a review without loading the review bar (Inspect) in the first download. */
const orderKey = (ws: string, review: string, week: number) => `goals-app-review:${ws}:${review}:${week}`;
export function saveReviewOrder(ws: string, review: string, week: number, ids: string[]) {
  try { sessionStorage.setItem(orderKey(ws, review, week), JSON.stringify(ids)); } catch { /* private mode: the live order is used */ }
}
export function loadReviewOrder(ws: string, review: string, week: number): string[] | null {
  try { const v = sessionStorage.getItem(orderKey(ws, review, week)); return v ? (JSON.parse(v) as string[]) : null; } catch { return null; }
}
