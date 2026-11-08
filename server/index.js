// Toddy accounts Worker (step 1): Google sign-in, session, profile, delete. Runs only for /api/* (see wrangler.jsonc).
// Scores and progress arrive in step 2. Nothing here handles passwords or wallets.
import { json, cookie, parseCookies, sign, unsign, randomToken, sha256, safeReturn, isAnonId } from './util.js';
import { startParams, exchange } from './google.js';
import { cleanNickname } from './nickname.js';

const SESSION_DAYS = 30, OAUTH_MINUTES = 10, AVATARS = 8;
const now = () => Math.floor(Date.now() / 1000);

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    try {
      if (path === '/api/health') return json({ ok: true, accounts: !!(env.DB && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET) });
      if (!env.DB || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) return json({ error: 'Accounts are not set up yet.' }, 503);
      if (path === '/api/auth/google/start' && request.method === 'GET') return start(request, env, url);
      if (path === '/api/auth/google/callback' && request.method === 'GET') return callback(request, env, url);
      if (path === '/api/me' && request.method === 'GET') return me(request, env);
      // everything below changes data: must come from our own pages
      if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Blocked' }, 403);
      if (path === '/api/logout') return logout(request, env);
      if (path === '/api/me/profile') return profile(request, env);
      if (path === '/api/me/delete') return deleteMe(request, env);
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};

async function start(request, env, url) {
  const { url: googleUrl, state, verifier } = await startParams(env, url.origin);
  const anon = url.searchParams.get('anon');
  const packed = await sign({ state, verifier, ret: safeReturn(url.searchParams.get('return')), anon: isAnonId(anon) ? anon : null, exp: now() + OAUTH_MINUTES * 60 }, env.SESSION_SECRET);
  return new Response(null, { status: 302, headers: { Location: googleUrl, 'Set-Cookie': cookie('toddy_oauth', packed, { maxAge: OAUTH_MINUTES * 60, path: '/api/auth/google' }), 'Cache-Control': 'no-store' } });
}

async function callback(request, env, url) {
  const back = (p, flag) => new Response(null, { status: 302, headers: { Location: p + (flag ? '?signin=' + flag : ''), 'Cache-Control': 'no-store', 'Set-Cookie': cookie('toddy_oauth', '', { maxAge: 0, path: '/api/auth/google' }) } });
  const saved = await unsign(parseCookies(request.headers.get('Cookie')).toddy_oauth, env.SESSION_SECRET);
  if (!saved) return back('/games/', 'expired');
  if (url.searchParams.get('error')) return back(saved.ret, 'cancelled');
  if (!url.searchParams.get('code') || url.searchParams.get('state') !== saved.state) return back(saved.ret, 'failed');
  const got = await exchange(env, url.origin, url.searchParams.get('code'), saved.verifier);
  if (got.error) return back(saved.ret, 'failed');
  const c = got.claims, t = now();
  let p = await env.DB.prepare('SELECT id, nickname FROM players WHERE google_sub = ?').bind(c.sub).first();
  if (!p) {
    const id = randomToken(12);
    await env.DB.prepare('INSERT INTO players (id, google_sub, email, name, consent_at, created_at, last_seen_at) VALUES (?,?,?,?,?,?,?)')
      .bind(id, c.sub, String(c.email).slice(0, 254), String(c.name || '').slice(0, 100), t, t, t).run();
    p = { id, nickname: null };
  } else {
    await env.DB.prepare('UPDATE players SET email = ?, name = ?, last_seen_at = ? WHERE id = ?').bind(String(c.email).slice(0, 254), String(c.name || '').slice(0, 100), t, p.id).run();
  }
  if (saved.anon) await env.DB.prepare('INSERT OR REPLACE INTO anon_links (anon_id, player_id, linked_at) VALUES (?,?,?)').bind(saved.anon, p.id, t).run();
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, player_id, created_at, expires_at) VALUES (?,?,?,?)').bind(await sha256(token), p.id, t, t + SESSION_DAYS * 86400).run();
  const res = back(saved.ret, 'ok');
  res.headers.append('Set-Cookie', cookie('toddy_session', token, { maxAge: SESSION_DAYS * 86400 }));
  return res;
}

async function playerFrom(request, env) {
  const token = parseCookies(request.headers.get('Cookie')).toddy_session;
  if (!token) return null;
  const row = await env.DB.prepare('SELECT p.id, p.nickname, p.avatar, p.show_on_boards, s.expires_at FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?').bind(await sha256(token)).first();
  return row && row.expires_at > now() ? row : null;
}

async function me(request, env) {
  const p = await playerFrom(request, env);
  if (!p) return json({ signedIn: false });
  return json({ signedIn: true, nickname: p.nickname, needsNickname: !p.nickname, avatar: p.avatar, showOnBoards: !!p.show_on_boards });
}

async function logout(request, env) {
  const token = parseCookies(request.headers.get('Cookie')).toddy_session;
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('toddy_session', '', { maxAge: 0 }) });
}

async function profile(request, env) {
  const p = await playerFrom(request, env);
  if (!p) return json({ error: 'Sign in first.' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const sets = [], vals = [];
  if (body.nickname !== undefined) {
    const n = cleanNickname(body.nickname);
    if (n.error) return json({ error: n.error }, 400);
    const taken = await env.DB.prepare('SELECT id FROM players WHERE nickname_key = ? AND id != ?').bind(n.key, p.id).first();
    if (taken) return json({ error: 'That nickname is taken.' }, 409);
    sets.push('nickname = ?', 'nickname_key = ?'); vals.push(n.nickname, n.key);
  }
  if (body.avatar !== undefined) {
    if (!Number.isInteger(body.avatar) || body.avatar < 0 || body.avatar >= AVATARS) return json({ error: 'Pick one of the avatars.' }, 400);
    sets.push('avatar = ?'); vals.push(body.avatar);
  }
  if (body.showOnBoards !== undefined) { sets.push('show_on_boards = ?'); vals.push(body.showOnBoards ? 1 : 0); }
  if (!sets.length) return json({ error: 'Nothing to change.' }, 400);
  await env.DB.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, p.id).run();
  return json({ ok: true });
}

// "Delete my data": removes the player and, through ON DELETE CASCADE, sessions and guest links (and later progress and scores).
async function deleteMe(request, env) {
  const p = await playerFrom(request, env);
  if (!p) return json({ error: 'Sign in first.' }, 401);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM anon_links WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM players WHERE id = ?').bind(p.id),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('toddy_session', '', { maxAge: 0 }) });
}
