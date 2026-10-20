// Small shared helpers for the Season server. No dependencies; uses only Web APIs available in Workers and Node 22.

const enc = new TextEncoder();

export const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

// JSON answer. cookies: array of Set-Cookie strings.
export function json(status, body, extra, cookies) {
  const h = new Headers({ ...BASE_HEADERS, ...(extra || {}) });
  for (const c of cookies || []) h.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function redirect(location, cookies) {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  for (const c of cookies || []) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
}

export const nowMs = (env) => (env && typeof env.__NOW === 'function' ? env.__NOW() : Date.now());   // __NOW only exists in tests

export function b64url(bytes) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str) {
  const p = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(p); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function randomToken(bytes = 32) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }

const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(text) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
export async function sha256Url(text) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))); }
export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// Cookies
export function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
// __Host- cookies: Secure, Path=/, no Domain, so other sub-domains and plain http cannot set or read them.
export function setCookie(name, value, maxAgeSec) {
  return `${name}=${value}; Max-Age=${maxAgeSec}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}
export const clearCookie = (name) => `${name}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;

// A same-site check for requests that change things: must come from our own page, with our own header, as JSON.
export function sameOriginPost(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (!origin || origin !== url.origin) return false;
  if (request.headers.get('X-Requested-With') !== 'toddy-passport') return false;
  return /^application\/json/i.test(request.headers.get('Content-Type') || '');
}

export async function readJson(request, maxBytes = 4096) {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (e) { return null; }
}

// Counts how many times a key was used in the current window. Returns true when the limit is exceeded.
export async function limited(env, key, limit, windowSec) {
  const now = nowMs(env), win = windowSec * 1000;
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) ' +
    'ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END, ' +
    'window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END RETURNING count'
  ).bind(key, now, now - win).first();
  return !!row && row.count > limit;
}

// Hash of the caller's network address (never stored raw). Falls back to a constant when the header is missing.
export async function callerKey(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return (await hmacHex((env && env.ID_SALT) || 'no-salt', 'ip:' + ip)).slice(0, 24);
}

export function isoWeek(ms) {
  const d = new Date(ms); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0');
}
export const isoTime = (ms) => new Date(ms).toISOString();
