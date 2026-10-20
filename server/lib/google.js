// Google sign-in by redirect (authorization code + PKCE). No Google script ever runs on our pages.
// We ask for "openid email" only: no name, no photo.
import { b64urlDecode } from './util.js';

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

export function buildAuthUrl({ clientId, redirectUri, state, challenge, nonce }) {
  const u = new URL(GOOGLE_AUTH);
  const p = { client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return u.toString();
}

// Trades the one-time code for the person's identity. The token comes straight from Google over HTTPS,
// so, as Google's documentation allows, we check its claims instead of its signature.
export async function exchangeCode({ code, verifier, clientId, clientSecret, redirectUri, nonce, now, fetchImpl }) {
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier });
  const res = await (fetchImpl || fetch)(GOOGLE_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) return { ok: false, error: 'google_exchange_failed' };
  let data; try { data = await res.json(); } catch (e) { return { ok: false, error: 'google_exchange_failed' }; }
  const parts = String(data.id_token || '').split('.');
  if (parts.length !== 3) return { ok: false, error: 'google_token_invalid' };
  let c; try { c = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))); } catch (e) { return { ok: false, error: 'google_token_invalid' }; }
  const okIss = c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com';
  if (!okIss || c.aud !== clientId || !c.sub || typeof c.exp !== 'number' || c.exp * 1000 < now || c.nonce !== nonce) return { ok: false, error: 'google_token_invalid' };
  if (c.email_verified !== true || typeof c.email !== 'string' || !c.email.includes('@')) return { ok: false, error: 'google_email_unverified' };
  return { ok: true, sub: String(c.sub), email: c.email.toLowerCase() };
}
