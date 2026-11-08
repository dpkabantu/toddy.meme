// Tests for the accounts Worker. The real migration SQL runs on an in-memory SQLite shaped like Cloudflare D1;
// Google's token endpoint is faked. NOT covered here: the real Google screens and real Cloudflare D1 (see server/README.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { periodRange } from '../server/index.js';
import { cleanNickname } from '../server/nickname.js';
import { checkClaims } from '../server/google.js';
import { safeReturn, sign, unsign } from '../server/util.js';

function makeDB() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;'); for (const f of ['0001_accounts', '0002_progress', '0003_scores']) db.exec(fs.readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { for (const s of list) await s.run(); }, raw: db };
}
const ENV = () => ({ DB: makeDB(), GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'sec', SESSION_SECRET: 'x'.repeat(40) });
const ORIGIN = 'https://toddy.meme';
const get = (env, path, cookie) => worker.fetch(new Request(ORIGIN + path, { headers: cookie ? { Cookie: cookie } : {} }), env);
const post = (env, path, body, cookie, origin = ORIGIN, method = 'POST') => worker.fetch(new Request(ORIGIN + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body || {}) }), env);
const cookieOf = (res, name) => { for (const c of res.headers.getSetCookie()) if (c.startsWith(name + '=')) return c.split(';')[0]; return null; };
const idToken = (claims) => 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
function fakeGoogle(claims) {
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => { assert.equal(String(u), 'https://oauth2.googleapis.com/token'); const b = new URLSearchParams(init.body); assert.ok(b.get('code_verifier')); return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 }); };
  return () => { globalThis.fetch = real; };
}
const GOOD = { iss: 'https://accounts.google.com', aud: 'cid.apps.googleusercontent.com', exp: Date.now() / 1000 + 600, sub: 'g-123', email: 'mia@example.eu', email_verified: true, name: 'Mia Rossi' };

async function signIn(env, claims = GOOD, anon = 'a'.repeat(20)) {
  const s = await get(env, `/api/auth/google/start?anon=${anon}&return=/games/moon-brew/`);
  assert.equal(s.status, 302);
  const loc = new URL(s.headers.get('Location'));
  assert.equal(loc.hostname, 'accounts.google.com'); assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  const oauth = cookieOf(s, 'toddy_oauth'), state = loc.searchParams.get('state');
  const restore = fakeGoogle(claims);
  try {
    const cb = await get(env, `/api/auth/google/callback?code=abc&state=${state}`, oauth);
    return { cb, session: cookieOf(cb, 'toddy_session') };
  } finally { restore(); }
}

test('health works without setup and says accounts are off; other routes answer 503', async () => {
  const r = await get({}, '/api/health'); assert.deepEqual(await r.json(), { ok: true, accounts: false });
  assert.equal((await get({}, '/api/me')).status, 503);
});

test('sign-in: new player is created, session cookie is HttpOnly and Secure, return path kept, guest id linked', async () => {
  const env = ENV(); const { cb, session } = await signIn(env);
  assert.equal(cb.status, 302); assert.equal(cb.headers.get('Location'), '/games/moon-brew/?signin=ok');
  assert.ok(session);
  const sc = cb.headers.getSetCookie().find(c => c.startsWith('toddy_session=')); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Lax/);
  const row = env.DB.raw.prepare('SELECT * FROM players').get();
  assert.equal(row.email, 'mia@example.eu'); assert.equal(row.nickname, null); assert.ok(row.consent_at > 0);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM anon_links').get().n, 1);
  assert.notEqual(env.DB.raw.prepare('SELECT token_hash FROM sessions').get().token_hash, session.split('=')[1], 'only a hash of the cookie is stored');
  const me = await (await get(env, '/api/me', session)).json();
  assert.deepEqual(me, { signedIn: true, nickname: null, needsNickname: true, avatar: 0, showOnBoards: true });
  assert.equal((await (await get(env, '/api/me')).json()).signedIn, false);
});

test('second sign-in finds the same player (no duplicate)', async () => {
  const env = ENV(); await signIn(env); await signIn(env);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM players').get().n, 1);
});

test('callback refuses a wrong state, a missing cookie, a cancelled screen and bad claims', async () => {
  const env = ENV();
  const s = await get(env, '/api/auth/google/start'); const oauth = cookieOf(s, 'toddy_oauth');
  assert.match((await get(env, '/api/auth/google/callback?code=a&state=WRONG', oauth)).headers.get('Location'), /signin=failed/);
  assert.match((await get(env, '/api/auth/google/callback?code=a&state=x')).headers.get('Location'), /signin=expired/);
  assert.match((await get(env, '/api/auth/google/callback?error=access_denied', oauth)).headers.get('Location'), /signin=cancelled/);
  const state = new URL(s.headers.get('Location')).searchParams.get('state');
  for (const bad of [{ ...GOOD, aud: 'other' }, { ...GOOD, email_verified: false }, { ...GOOD, exp: 1 }, { ...GOOD, iss: 'https://evil.example' }]) {
    const restore = fakeGoogle(bad);
    try { assert.match((await get(env, `/api/auth/google/callback?code=a&state=${state}`, oauth)).headers.get('Location'), /signin=failed/); } finally { restore(); }
  }
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM players').get().n, 0, 'nobody was created');
});

test('return path cannot leave our games (no open redirect)', () => {
  assert.equal(safeReturn('/games/moon-brew/'), '/games/moon-brew/');
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil', '/games/../x', '/other', undefined]) assert.equal(safeReturn(bad), '/games/');
});

test('signed values: tampering and expiry are rejected', async () => {
  const v = await sign({ a: 1, exp: Date.now() / 1000 + 60 }, 'k'); assert.equal((await unsign(v, 'k')).a, 1);
  assert.equal(await unsign(v, 'other'), null); assert.equal(await unsign(v.replace(/^./, 'Z'), 'k'), null);
  assert.equal(await unsign(await sign({ exp: 1 }, 'k'), 'k'), null);
});

test('nickname rules and profile changes', async () => {
  assert.ok(cleanNickname('Moon Fan 7').nickname); assert.ok(cleanNickname('ab').error); assert.ok(cleanNickname('a'.repeat(17)).error);
  for (const bad of ['Toddy Admin', 'free airdrop', 'x<script>', 'visit toddy.meme', 'sh1t head']) assert.ok(cleanNickname(bad).error, bad);
  const env = ENV(); const { session } = await signIn(env);
  assert.equal((await post(env, '/api/me/profile', { nickname: 'Moon Fan' })).status, 401);
  assert.equal((await post(env, '/api/me/profile', { nickname: 'Moon Fan' }, session, 'https://evil.example')).status, 403);
  assert.equal((await post(env, '/api/me/profile', { nickname: 'Moon Fan', avatar: 3 }, session)).status, 200);
  assert.equal((await post(env, '/api/me/profile', { avatar: 99 }, session)).status, 400);
  const me = await (await get(env, '/api/me', session)).json(); assert.equal(me.nickname, 'Moon Fan'); assert.equal(me.needsNickname, false); assert.equal(me.avatar, 3);
  const other = await signIn(env, { ...GOOD, sub: 'g-456', email: 'bo@example.eu' }, 'b'.repeat(20));
  const clash = await post(env, '/api/me/profile', { nickname: 'moon fan' }, other.session); assert.equal(clash.status, 409);
  assert.equal((await post(env, '/api/me/profile', { showOnBoards: false }, session)).status, 200);
  assert.equal((await (await get(env, '/api/me', session)).json()).showOnBoards, false);
});

test('logout ends the session; delete removes the player, sessions and guest links', async () => {
  const env = ENV(); const { session } = await signIn(env);
  await post(env, '/api/logout', {}, session); assert.equal((await (await get(env, '/api/me', session)).json()).signedIn, false);
  const again = await signIn(env);
  assert.equal((await post(env, '/api/me/delete', {}, again.session)).status, 200);
  for (const t of ['players', 'sessions', 'anon_links', 'progress', 'scores']) assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n, 0, t);
  assert.equal((await (await get(env, '/api/me', again.session)).json()).signedIn, false);
});

test('an expired session is not accepted', async () => {
  const env = ENV(); const { session } = await signIn(env);
  env.DB.raw.prepare('UPDATE sessions SET expires_at = 1').run();
  assert.equal((await (await get(env, '/api/me', session)).json()).signedIn, false);
});

test('claims check', () => { assert.equal(checkClaims(GOOD, { GOOGLE_CLIENT_ID: GOOD.aud }), null); });

test('progress: needs sign-in, own pages only, known games, size limit; save and load; delete removes it', async () => {
  const env = ENV(); const { session } = await signIn(env);
  const put = (game, data, c = session, o = ORIGIN) => post(env, '/api/progress/' + game, { data }, c, o, 'PUT');
  assert.equal((await get(env, '/api/progress/moon-brew')).status, 401);
  assert.equal((await put('moon-brew', { stars: {} }, null)).status, 401);
  assert.equal((await put('moon-brew', { stars: {} }, session, 'https://evil.example')).status, 403);
  assert.equal((await put('not-a-game', {})).status, 404);
  assert.equal((await put('moon-brew', [1])).status, 400);
  assert.equal((await put('moon-brew', { blob: 'x'.repeat(70000) })).status, 413);
  assert.deepEqual(await (await get(env, '/api/progress/moon-brew', session)).json(), { data: null });
  assert.equal((await put('moon-brew', { stars: { '1-1': 3 }, endlessBest: 460 })).status, 200);
  assert.equal((await put('moon-brew', { stars: { '1-1': 3, '1-2': 2 } })).status, 200);
  const got = await (await get(env, '/api/progress/moon-brew', session)).json();
  assert.deepEqual(got.data, { stars: { '1-1': 3, '1-2': 2 } });
  await put('scam-lab', { best: 12 });
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM progress').get().n, 2);
  const other = await signIn(env, { ...GOOD, sub: 'g-9', email: 'z@example.eu' }, 'c'.repeat(20));
  assert.deepEqual(await (await get(env, '/api/progress/moon-brew', other.session)).json(), { data: null }, 'players never see each other');
  assert.equal((await post(env, '/api/me/delete', {}, session)).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM progress').get().n, 0);
});

const today = () => { const d = new Date(); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
test('period ranges: daily, Monday-to-today, calendar month', () => {
  const d = new Date(Date.UTC(2026, 10, 8)); // Sunday 8 Nov 2026
  assert.deepEqual(periodRange('daily', d), [20261108, 20261108]);
  assert.deepEqual(periodRange('weekly', d), [20261102, 20261108]);
  assert.deepEqual(periodRange('monthly', d), [20261101, 20261108]);
  assert.deepEqual(periodRange('weekly', new Date(Date.UTC(2026, 10, 2))), [20261102, 20261102]);
  assert.equal(periodRange('yearly', d), null);
});

test('scores: only plausible, only recent, best of the day kept; boards show nicknames only, ranked, with your own rank', async () => {
  const env = ENV();
  const a = await signIn(env, GOOD, 'a'.repeat(20)), b = await signIn(env, { ...GOOD, sub: 'g-2', email: 'bo@example.eu', name: 'Bo Private' }, 'b'.repeat(20)), c = await signIn(env, { ...GOOD, sub: 'g-3', email: 'cy@example.eu' }, 'c'.repeat(20));
  const sc = (who, body, origin) => post(env, '/api/score', body, who.session, origin);
  assert.equal((await post(env, '/api/score', { game: 'moon-brew', day: today(), score: 500 })).status, 401);
  assert.equal((await sc(a, { game: 'moon-brew', day: today(), score: 500 }, 'https://evil.example')).status, 403);
  for (const bad of [{ game: 'moon-brew', day: today(), score: 30001 }, { game: 'moon-brew', day: today(), score: 0 }, { game: 'moon-brew', day: today(), score: 12.5 }, { game: 'moon-brew', day: 20200101, score: 5 }, { game: 'nope', day: today(), score: 5 }])
    assert.ok((await sc(a, bad)).status >= 400, JSON.stringify(bad));
  for (const [who, nick] of [[a, 'Aria'], [b, 'Bobby'], [c, 'Cyrus']]) await post(env, '/api/me/profile', { nickname: nick }, who.session);
  await sc(a, { game: 'moon-brew', day: today(), score: 700 }); await sc(a, { game: 'moon-brew', day: today(), score: 650 }); // lower later score never replaces
  await sc(b, { game: 'moon-brew', day: today(), score: 900 }); await sc(c, { game: 'moon-brew', day: today(), score: 900 }); await sc(c, { game: 'scam-lab', day: today(), score: 300 });
  env.DB.raw.prepare("UPDATE scores SET created_at = CASE player_id WHEN (SELECT id FROM players WHERE nickname = 'Bobby') THEN 100 ELSE 200 END WHERE game = 'moon-brew' AND score = 900").run(); // make the tie order certain
  const board = await (await get(env, '/api/leaderboard/moon-brew?period=daily', a.session)).json();
  assert.deepEqual(board.entries.map(e => [e.rank, e.nickname, e.score]), [[1, 'Bobby', 900], [2, 'Cyrus', 900], [3, 'Aria', 700]], 'tie: earlier score ranks first');
  assert.equal(board.entries.find(e => e.you).nickname, 'Aria'); assert.deepEqual(board.you, { rank: 3, score: 700 });
  const raw = JSON.stringify(board); for (const secret of ['example.eu', 'Private', 'Mia', 'g-2']) assert.ok(!raw.includes(secret), 'no private data on boards: ' + secret);
  assert.equal((await (await get(env, '/api/leaderboard/scam-lab?period=weekly')).json()).entries.length, 1, 'boards are per game and readable by guests');
  assert.equal((await get(env, '/api/leaderboard/moon-brew?period=forever')).status, 400);
  await post(env, '/api/me/profile', { showOnBoards: false }, b.session);
  assert.deepEqual((await (await get(env, '/api/leaderboard/moon-brew?period=monthly')).json()).entries.map(e => e.nickname), ['Cyrus', 'Aria'], 'hidden players are not listed');
  await post(env, '/api/me/delete', {}, c.session);
  assert.deepEqual((await (await get(env, '/api/leaderboard/moon-brew?period=daily')).json()).entries.map(e => e.nickname), ['Aria']);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM scores WHERE game = 'scam-lab'").get().n, 0, 'delete removes scores');
});
