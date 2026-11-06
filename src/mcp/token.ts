/* AI assistant tokens: how one is made and how it is checked. The shared database makes its own the same way
   (migration 0024, okr_token_create), so a token made in either place is checked the same. */

/** SHA-256 of a token, as hex: what's stored, and what a presented token is checked against. */
export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A new token: "gk_" and 40 random letters and digits. */
export function newToken(): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  return 'gk_' + [...bytes].map((b) => abc[b % 62]).join('');
}
