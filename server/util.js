// Small helpers: random ids, hashing, signing, cookies, safe return paths. Web Crypto only, no packages.
const enc = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export const randomToken = (bytes = 32) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));
export async function sha256(text) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
async function hmacKey(secret) { return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function sign(payload, secret) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
}
export async function unsign(value, secret) {
  const [body, sig] = String(value || '').split('.');
  if (!body || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try { const p = JSON.parse(new TextDecoder().decode(unb64u(body))); return p && (!p.exp || p.exp > Date.now() / 1000) ? p : null; } catch { return null; }
}
export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(/;\s*/)) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i)] = part.slice(i + 1); }
  return out;
}
export function cookie(name, value, { maxAge, path = '/' } = {}) {
  return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax` + (maxAge !== undefined ? `; Max-Age=${maxAge}` : '');
}
// Only our own game pages may be returned to after sign-in (no open redirects).
export function safeReturn(p) {
  if (typeof p !== 'string' || !/^\/games\/[a-z0-9-]+\/?$/.test(p)) return '/games/';
  return p;
}
export const isAnonId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
