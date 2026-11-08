// Toddy accounts Worker (step 1): Google sign-in, session, profile, delete. Runs only for /api/* (see wrangler.jsonc).
// Scores and progress arrive in step 2. Nothing here handles passwords or wallets.
import { json, cookie, parseCookies, sign, unsign, randomToken, sha256, safeReturn, isAnonId } from './util.js';
import { startParams, exchange } from './google.js';
import { cleanNickname } from './nickname.js';

const GAMES = ['moon-brew', 'full-moon', 'scam-lab'], MAX_PROGRESS = 65536;
// A score above this cannot be real for that game (plausibility only; scores are "saved", not "verified", until a replay check exists).
const MAX_SCORE = { 'moon-brew': 30000, 'scam-lab': 200000, 'full-moon': 2000000 }; // moon-brew: total stars, scam-lab: total points, full-moon: one run
const BOARD_SIZE = 20;
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
      const bm = path.match(/^\/api\/leaderboard\/([a-z-]+)$/);
      if (bm && request.method === 'GET') return leaderboard(request, env, bm[1], url);
      const gm = path.match(/^\/api\/progress\/([a-z-]+)$/);
      if (gm && request.method === 'GET') return getProgress(request, env, gm[1]);
      if (request.method !== 'POST' && !(gm && request.method === 'PUT')) return json({ error: 'Not found' }, 404);
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Blocked' }, 403);
      if (gm) return putProgress(request, env, gm[1]);
      if (path === '/api/logout') return logout(request, env);
      if (path === '/api/score') return postScore(request, env);
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
    env.DB.prepare('DELETE FROM scores WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM progress WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM sessions WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM anon_links WHERE player_id = ?').bind(p.id),
    env.DB.prepare('DELETE FROM players WHERE id = ?').bind(p.id),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('toddy_session', '', { maxAge: 0 }) });
}

// Saved progress: the game merges what is on the device with what is here, then saves the result. Last save wins.
async function getProgress(request, env, game) {
  const p = await playerFrom(request, env);
  if (!p) return json({ error: 'Sign in first.' }, 401);
  if (!GAMES.includes(game)) return json({ error: 'Unknown game.' }, 404);
  const row = await env.DB.prepare('SELECT data, updated_at FROM progress WHERE player_id = ? AND game = ?').bind(p.id, game).first();
  return json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null });
}
async function putProgress(request, env, game) {
  const p = await playerFrom(request, env);
  if (!p) return json({ error: 'Sign in first.' }, 401);
  if (!GAMES.includes(game)) return json({ error: 'Unknown game.' }, 404);
  const text = await request.text();
  if (text.length > MAX_PROGRESS) return json({ error: 'Too big.' }, 413);
  let body; try { body = JSON.parse(text); } catch { return json({ error: 'Bad request.' }, 400); }
  if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) return json({ error: 'Bad request.' }, 400);
  await env.DB.prepare('INSERT INTO progress (player_id, game, data, updated_at) VALUES (?,?,?,?) ON CONFLICT(player_id, game) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .bind(p.id, game, JSON.stringify(body.data), now()).run();
  return json({ ok: true });
}

// ---------- Daily scores and leaderboards ----------
const ymd = (d) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
const dayToDate = (n) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100));
export function periodRange(period, today = new Date()) {
  const t = ymd(today);
  if (period === 'daily') return [t, t];
  if (period === 'weekly') { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return [ymd(d), t]; } // Monday to today
  if (period === 'monthly') return [Math.floor(t / 100) * 100 + 1, t];
  return null;
}
async function postScore(request, env) {
  const p = await playerFrom(request, env);
  if (!p) return json({ error: 'Sign in first.' }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  if (!b || !GAMES.includes(b.game)) return json({ error: 'Unknown game.' }, 404);
  const score = b.score, day = b.day, today = new Date();
  if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE[b.game]) return json({ error: 'Score not accepted.' }, 400);
  const lo = new Date(today.getTime() - 86400000), hi = new Date(today.getTime() + 86400000); // one day either side: players live in every time zone
  if (!Number.isInteger(day) || day < ymd(lo) || day > ymd(hi) || !(day % 100 >= 1 && day % 100 <= 31)) return json({ error: 'Day not accepted.' }, 400);
  await env.DB.prepare('INSERT INTO scores (player_id, game, day, score, created_at) VALUES (?,?,?,?,?) ON CONFLICT(player_id, game, day) DO UPDATE SET score = MAX(score, excluded.score)')
    .bind(p.id, b.game, day, score, now()).run();
  return json({ ok: true });
}
async function leaderboard(request, env, game, url) {
  if (!GAMES.includes(game)) return json({ error: 'Unknown game.' }, 404);
  const range = periodRange(url.searchParams.get('period') || 'daily');
  if (!range) return json({ error: 'Unknown period.' }, 400);
  const rows = (await env.DB.prepare(`SELECT p.id AS id, p.nickname AS nickname, p.avatar AS avatar, MAX(s.score) AS score, MIN(s.created_at) AS first
      FROM scores s JOIN players p ON p.id = s.player_id
      WHERE s.game = ? AND s.day >= ? AND s.day <= ? AND p.show_on_boards = 1 AND p.nickname IS NOT NULL
      GROUP BY p.id ORDER BY score DESC, first ASC LIMIT ?`).bind(game, range[0], range[1], 500).all()).results;
  const me = await playerFrom(request, env);
  const entries = rows.slice(0, BOARD_SIZE).map((r, i) => ({ rank: i + 1, nickname: r.nickname, avatar: r.avatar, score: r.score, you: !!me && r.id === me.id }));
  const idx = me ? rows.findIndex(r => r.id === me.id) : -1;
  return json({ period: url.searchParams.get('period') || 'daily', entries, you: idx >= 0 ? { rank: idx + 1, score: rows[idx].score } : null, note: 'Saved scores, not yet verified.' });
}
