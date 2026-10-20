// Passport routes: Google sign-in, joining, profile, sign out, delete.
import { json, redirect, nowMs, randomToken, sha256Hex, sha256Url, hmacHex, parseCookies, setCookie, clearCookie, sameOriginPost, readJson, limited, callerKey, isoWeek, isoTime } from './lib/util.js';
import { checkUsername, newPassportId, newReferralCode } from './lib/names.js';
import { buildAuthUrl, exchangeCode } from './lib/google.js';

const SESSION = '__Host-tp_session', SIGNUP = '__Host-tp_signup', OAUTH = '__Host-tp_oauth';
const DAY = 86400000;
const SESSION_AGE = 30 * DAY, SIGNUP_AGE = 30 * 60 * 1000, STATE_AGE = 10 * 60 * 1000;
export const NAME_COOLDOWN = 30 * DAY, FREE_FIRST_CHANGE = DAY;
const PAGE = '/passport/';

const configured = (env) => !!(env.DB && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ID_SALT);
export const authStatus = (env) => ({ googleClientId: !!env.GOOGLE_CLIENT_ID, googleClientSecret: !!env.GOOGLE_CLIENT_SECRET, idSalt: !!env.ID_SALT });

// Only plain paths on our own site may be used as "go back to".
export function safeReturn(p) {
  return typeof p === 'string' && /^\/(?!\/)[A-Za-z0-9\-_\/.]{0,100}$/.test(p) && !p.includes('..') ? p : PAGE;
}
const back = (code) => redirect(PAGE + '?e=' + code, [clearCookie(OAUTH)]);

async function currentTerms(env) {
  const r = await env.DB.prepare('SELECT version FROM terms_versions ORDER BY published_at DESC LIMIT 1').first();
  return r ? r.version : null;
}

export async function sessionPlayer(request, env) {
  const tok = parseCookies(request.headers.get('Cookie'))[SESSION];
  if (!tok || tok.length < 20) return null;
  const now = nowMs(env), h = await sha256Hex(tok);
  const row = await env.DB.prepare(
    "SELECT s.token_hash, s.last_seen_at, p.id, p.username, p.status, p.joined_at, p.adult_confirmed_at, p.terms_version FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?1 AND s.expires_at > ?2"
  ).bind(h, now).first();
  if (!row || row.status === 'removed') return null;
  if (now - row.last_seen_at > 3600000) await env.DB.prepare('UPDATE sessions SET last_seen_at = ?1 WHERE token_hash = ?2').bind(now, h).run();
  return row;
}

async function newSession(env, playerId) {
  const tok = randomToken(32), now = nowMs(env);
  await env.DB.prepare('INSERT INTO sessions (token_hash, player_id, created_at, expires_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?3)').bind(await sha256Hex(tok), playerId, now, now + SESSION_AGE).run();
  await env.DB.prepare('UPDATE players SET last_active_at = ?1 WHERE id = ?2').bind(isoTime(now), playerId).run();
  return setCookie(SESSION, tok, SESSION_AGE / 1000);
}

// ---------- /api/auth/google/start ----------
export async function googleStart(request, env) {
  if (!configured(env)) return back('not_configured');
  const url = new URL(request.url), now = nowMs(env);
  if (await limited(env, 'start:' + await callerKey(request, env), 20, 600)) return back('rate');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?1').bind(now),
    env.DB.prepare('DELETE FROM pending_signups WHERE expires_at < ?1').bind(now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now),
  ]);
  const state = randomToken(24), verifier = randomToken(32), nonce = randomToken(16);
  await env.DB.prepare('INSERT INTO oauth_states (state_hash, code_verifier, nonce, return_to, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(await sha256Hex(state), verifier, nonce, safeReturn(url.searchParams.get('return')), now, now + STATE_AGE).run();
  const dest = buildAuthUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri: url.origin + '/api/auth/google/callback', state, challenge: await sha256Url(verifier), nonce });
  return redirect(dest, [setCookie(OAUTH, state, STATE_AGE / 1000)]);
}

// ---------- /api/auth/google/callback ----------
export async function googleCallback(request, env, deps) {
  if (!configured(env)) return back('not_configured');
  const url = new URL(request.url), now = nowMs(env);
  if (url.searchParams.get('error')) return back('cancelled');
  const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
  const cookieState = parseCookies(request.headers.get('Cookie'))[OAUTH];
  if (!state || !code || !cookieState || cookieState !== state) return back('expired');
  // single use: the update only succeeds the first time
  const sh = await sha256Hex(state);
  const used = await env.DB.prepare('UPDATE oauth_states SET used_at = ?1 WHERE state_hash = ?2 AND used_at IS NULL AND expires_at > ?1').bind(now, sh).run();
  if (!used.meta || used.meta.changes !== 1) return back('expired');
  const st = await env.DB.prepare('SELECT code_verifier, nonce, return_to FROM oauth_states WHERE state_hash = ?1').bind(sh).first();
  if (!st) return back('expired');
  const g = await exchangeCode({ code, verifier: st.code_verifier, clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: url.origin + '/api/auth/google/callback', nonce: st.nonce, now, fetchImpl: deps && deps.fetch });
  if (!g.ok) return back(g.error === 'google_email_unverified' ? 'email' : 'failed');
  const ph = await hmacHex(env.ID_SALT, 'google:' + g.sub);
  const linked = await env.DB.prepare('SELECT l.player_id, p.status FROM linked_accounts l JOIN players p ON p.id = l.player_id WHERE l.provider = ?1 AND l.provider_hash = ?2').bind('google', ph).first();
  if (linked) {
    if (linked.status === 'removed') return back('blocked');
    const cookie = await newSession(env, linked.player_id);
    return redirect(st.return_to, [cookie, clearCookie(OAUTH), clearCookie(SIGNUP)]);
  }
  const tok = randomToken(32);
  await env.DB.prepare('INSERT INTO pending_signups (token_hash, provider, provider_hash, email, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(await sha256Hex(tok), 'google', ph, g.email, now, now + SIGNUP_AGE).run();
  return redirect(PAGE + '?step=join', [setCookie(SIGNUP, tok, SIGNUP_AGE / 1000), clearCookie(OAUTH)]);
}

const maskEmail = (e) => { const [u, d] = e.split('@'); return (u.slice(0, 1) + '***@' + d); };

async function pendingSignup(request, env) {
  const tok = parseCookies(request.headers.get('Cookie'))[SIGNUP];
  if (!tok || tok.length < 20) return null;
  return await env.DB.prepare('SELECT token_hash, provider, provider_hash, email FROM pending_signups WHERE token_hash = ?1 AND expires_at > ?2').bind(await sha256Hex(tok), nowMs(env)).first();
}

async function nameChangeInfo(env, playerId) {
  const now = nowMs(env);
  const cur = await env.DB.prepare('SELECT claimed_at FROM username_claims WHERE player_id = ?1 AND is_current = 1').bind(playerId).first();
  const n = await env.DB.prepare('SELECT COUNT(*) AS c FROM username_claims WHERE player_id = ?1').bind(playerId).first();
  if (!cur) return { allowed: true, nextAt: null };
  const free = n.c === 1 && now - cur.claimed_at < FREE_FIRST_CHANGE;
  const allowed = free || now - cur.claimed_at >= NAME_COOLDOWN;
  return { allowed, nextAt: allowed ? null : isoTime(cur.claimed_at + NAME_COOLDOWN) };
}

// ---------- /api/me ----------
export async function me(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  const terms = await currentTerms(env);
  const p = await sessionPlayer(request, env);
  if (p) return json(200, { ok: true, signedIn: true, passportId: p.id, username: p.username, joinedAt: p.joined_at, termsVersion: terms, usernameChange: await nameChangeInfo(env, p.id) });
  const pend = await pendingSignup(request, env);
  if (pend) return json(200, { ok: true, signedIn: false, pending: true, emailHint: maskEmail(pend.email), termsVersion: terms });
  return json(200, { ok: true, signedIn: false, pending: false, signInAvailable: configured(env), termsVersion: terms });
}

const uniqueErr = (e) => String((e && e.message) || e);

// Is the name free for this player? (their own reserved old name counts as free for them)
async function nameAvailable(env, key, playerId, now) {
  const r = await env.DB.prepare('SELECT player_id, is_current, reserved_until FROM username_claims WHERE key = ?1').bind(key).first();
  if (!r) return true;
  if (r.player_id === playerId) return true;
  return r.is_current === 0 && r.reserved_until !== null && r.reserved_until < now;
}

// ---------- POST /api/signup ----------
export async function signup(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  if (!sameOriginPost(request)) return json(403, { ok: false, error: 'forbidden' });
  if (await limited(env, 'signup:' + await callerKey(request, env), 10, 3600)) return json(429, { ok: false, error: 'rate' });
  const pend = await pendingSignup(request, env);
  if (!pend) return json(401, { ok: false, error: 'sign_in_first' });
  const body = await readJson(request);
  if (!body) return json(400, { ok: false, error: 'bad_request' });
  const terms = await currentTerms(env);
  if (body.adult !== true) return json(400, { ok: false, error: 'adult_required' });
  if (body.terms !== terms) return json(400, { ok: false, error: 'terms_required' });
  const u = checkUsername(body.username);
  if (!u.ok) return json(400, { ok: false, error: u.error });
  const now = nowMs(env);
  if (!(await nameAvailable(env, u.key, '', now))) return json(409, { ok: false, error: 'username_taken' });
  let id = newPassportId();
  for (let i = 0; i < 5 && await env.DB.prepare('SELECT 1 AS x FROM players WHERE id = ?1').bind(id).first(); i++) id = newPassportId();
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM username_claims WHERE key = ?1 AND is_current = 0 AND reserved_until < ?2').bind(u.key, now),
      env.DB.prepare('INSERT INTO players (id, username, joined_at, join_week, signin_method, referral_code, adult_confirmed_at, terms_version, status, last_active_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?3, ?7, ?8, ?3)')
        .bind(id, u.display, isoTime(now), isoWeek(now), pend.provider, newReferralCode(), terms, 'active'),
      env.DB.prepare('INSERT INTO linked_accounts (player_id, provider, provider_hash) VALUES (?1, ?2, ?3)').bind(id, pend.provider, pend.provider_hash),
      env.DB.prepare('INSERT INTO player_contacts (player_id, email) VALUES (?1, ?2)').bind(id, pend.email),
      env.DB.prepare('INSERT INTO username_claims (key, player_id, display, is_current, claimed_at) VALUES (?1, ?2, ?3, 1, ?4)').bind(u.key, id, u.display, now),
      env.DB.prepare('INSERT INTO trust_scores (player_id) VALUES (?1)').bind(id),
      env.DB.prepare('DELETE FROM pending_signups WHERE token_hash = ?1').bind(pend.token_hash),
    ]);
  } catch (e) {
    const m = uniqueErr(e);
    if (/linked_accounts/.test(m)) return json(409, { ok: false, error: 'already_registered' }, null, [clearCookie(SIGNUP)]);
    if (/username/.test(m)) return json(409, { ok: false, error: 'username_taken' });
    console.error('signup failed', m);
    return json(500, { ok: false, error: 'server_error' });
  }
  const cookie = await newSession(env, id);
  return json(200, { ok: true, passportId: id, username: u.display }, null, [cookie, clearCookie(SIGNUP)]);
}

// ---------- POST /api/me/username ----------
export async function changeUsername(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  if (!sameOriginPost(request)) return json(403, { ok: false, error: 'forbidden' });
  const p = await sessionPlayer(request, env);
  if (!p) return json(401, { ok: false, error: 'sign_in_first' });
  if (await limited(env, 'rename:' + p.id, 10, 3600)) return json(429, { ok: false, error: 'rate' });
  const body = await readJson(request);
  if (!body) return json(400, { ok: false, error: 'bad_request' });
  const u = checkUsername(body.username);
  if (!u.ok) return json(400, { ok: false, error: u.error });
  const now = nowMs(env);
  const info = await nameChangeInfo(env, p.id);
  if (!info.allowed) return json(429, { ok: false, error: 'username_cooldown', nextAt: info.nextAt });
  if (!(await nameAvailable(env, u.key, p.id, now))) return json(409, { ok: false, error: 'username_taken' });
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM username_claims WHERE key = ?1 AND player_id <> ?2 AND is_current = 0 AND reserved_until < ?3').bind(u.key, p.id, now),
      env.DB.prepare('UPDATE username_claims SET is_current = 0, reserved_until = ?1 WHERE player_id = ?2 AND is_current = 1 AND key <> ?3').bind(now + NAME_COOLDOWN, p.id, u.key),
      env.DB.prepare('INSERT INTO username_claims (key, player_id, display, is_current, claimed_at, reserved_until) VALUES (?1, ?2, ?3, 1, ?4, NULL) ON CONFLICT(key) DO UPDATE SET display = excluded.display, is_current = 1, claimed_at = excluded.claimed_at, reserved_until = NULL WHERE player_id = excluded.player_id')
        .bind(u.key, p.id, u.display, now),
      env.DB.prepare('UPDATE players SET username = ?1 WHERE id = ?2').bind(u.display, p.id),
    ]);
  } catch (e) {
    if (/UNIQUE/i.test(uniqueErr(e))) return json(409, { ok: false, error: 'username_taken' });
    console.error('rename failed', uniqueErr(e));
    return json(500, { ok: false, error: 'server_error' });
  }
  return json(200, { ok: true, username: u.display, usernameChange: await nameChangeInfo(env, p.id) });
}

// ---------- POST /api/auth/logout ----------
export async function logout(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  if (!sameOriginPost(request)) return json(403, { ok: false, error: 'forbidden' });
  const tok = parseCookies(request.headers.get('Cookie'))[SESSION];
  if (tok) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256Hex(tok)).run();
  return json(200, { ok: true }, null, [clearCookie(SESSION), clearCookie(SIGNUP)]);
}

// ---------- POST /api/me/delete ----------
// Removes everything that can identify the person (email, Google link, username, sessions, device signals).
// Points and run records stay, tied to a Passport ID that no longer leads to anyone, as the privacy page will say.
export async function deleteMe(request, env) {
  if (!env.DB) return json(503, { ok: false, error: 'not_configured' });
  if (!sameOriginPost(request)) return json(403, { ok: false, error: 'forbidden' });
  const p = await sessionPlayer(request, env);
  if (!p) return json(401, { ok: false, error: 'sign_in_first' });
  const body = await readJson(request);
  if (!body || body.confirm !== 'DELETE') return json(400, { ok: false, error: 'confirm_required' });
  const now = nowMs(env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE player_id = ?1').bind(p.id),
    env.DB.prepare('DELETE FROM linked_accounts WHERE player_id = ?1').bind(p.id),
    env.DB.prepare('DELETE FROM player_contacts WHERE player_id = ?1').bind(p.id),
    env.DB.prepare('DELETE FROM device_signals WHERE player_id = ?1').bind(p.id),
    env.DB.prepare('DELETE FROM username_claims WHERE player_id = ?1').bind(p.id),
    env.DB.prepare("UPDATE players SET username = NULL, status = 'removed', last_active_at = ?1 WHERE id = ?2").bind(isoTime(now), p.id),
    env.DB.prepare("INSERT INTO privacy_requests (player_id, type, requested_at, completed_at, outcome) VALUES (?1, 'delete', ?2, ?2, 'self-service: contact, Google link, username, sessions and device signals removed')").bind(p.id, isoTime(now)),
  ]);
  return json(200, { ok: true }, null, [clearCookie(SESSION)]);
}
