// Google sign-in (server-side "authorization code" flow with PKCE). No Google script ever runs on our pages.
import { b64u, randomToken } from './util.js';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export async function startParams(env, origin) {
  const state = randomToken(16), verifier = randomToken(32);
  const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const url = new URL(AUTH);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + '/api/auth/google/callback', response_type: 'code',
    scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  return { url: url.toString(), state, verifier };
}
// Checks the claims of the id_token Google handed us directly over TLS in the code exchange.
export function checkClaims(c, env, now = Date.now() / 1000) {
  if (!c || typeof c !== 'object') return 'no claims';
  if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') return 'wrong issuer';
  if (c.aud !== env.GOOGLE_CLIENT_ID) return 'wrong audience';
  if (!(c.exp > now)) return 'expired';
  if (!c.sub || !c.email) return 'missing sub or email';
  if (c.email_verified !== true && c.email_verified !== 'true') return 'email not verified';
  return null;
}
export function decodeIdToken(t) {
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch { return null; }
}
export async function exchange(env, origin, code, verifier, fetchFn = fetch) {
  const res = await fetchFn(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
    code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: origin + '/api/auth/google/callback', grant_type: 'authorization_code', code_verifier: verifier }) });
  if (!res.ok) return { error: 'token exchange failed' };
  const body = await res.json();
  const claims = decodeIdToken(body.id_token), bad = checkClaims(claims, env);
  return bad ? { error: bad } : { claims };
}
