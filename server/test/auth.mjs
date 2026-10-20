// Sign-in tests with a fake Google. Run: node --no-warnings server/test/auth.mjs
// Real SQLite stands in for D1; Google's token server is faked. Real Google sign-in is only testable on the Cloudflare preview.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle } from '../index.js';
import { fakeD1 } from './fake-d1.mjs';
import { checkUsername, nameKey } from '../lib/names.js';
import { safeReturn } from '../auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(here, '..', 'migrations');
let bad = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };

const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON');
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(migDir, f), 'utf8'));
let NOW = Date.UTC(2026, 10, 2, 10, 0, 0);
const env = { DB: fakeD1(db), GOOGLE_CLIENT_ID: 'cid.apps.test', GOOGLE_CLIENT_SECRET: 'sek', ID_SALT: 'salt-for-tests', __NOW: () => NOW };
const ORIGIN = 'https://preview.example.dev';
const DAY = 86400000;

// ----- fake Google -----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
let googleMode = 'ok', googleUser = { sub: 'g-1', email: 'mira@example.com' }, lastTokenBody = null, nextNonce = null;
const deps = { fetch: async (url, init) => {
  lastTokenBody = Object.fromEntries(new URLSearchParams(init.body));
  if (googleMode === 'fail') return new Response('nope', { status: 400 });
  const claims = { iss: 'https://accounts.google.com', aud: 'cid.apps.test', sub: googleUser.sub, email: googleUser.email, email_verified: true, exp: Math.floor(NOW / 1000) + 3600, nonce: nextNonce };
  if (googleMode === 'badnonce') claims.nonce = 'other';
  if (googleMode === 'badaud') claims.aud = 'someone-else';
  if (googleMode === 'expired') claims.exp = Math.floor(NOW / 1000) - 10;
  if (googleMode === 'unverified') claims.email_verified = false;
  return new Response(JSON.stringify({ id_token: b64({ alg: 'RS256' }) + '.' + b64(claims) + '.sig' }), { status: 200 });
} };

// ----- tiny browser -----
function browser() {
  const jar = {};
  return {
    jar,
    async req(method, p, { body, origin = ORIGIN, header = 'toddy-passport', ct = 'application/json', cookies = true, ip = '1.2.3.4' } = {}) {
      const h = new Headers();
      if (cookies && Object.keys(jar).length) h.set('Cookie', Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '));
      if (method === 'POST') { if (origin) h.set('Origin', origin); if (header) h.set('X-Requested-With', header); if (ct) h.set('Content-Type', ct); }
      h.set('CF-Connecting-IP', ip);
      const r = await handle(new Request(ORIGIN + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), redirect: 'manual' }), env, deps);
      for (const c of r.headers.getSetCookie()) { const [kv, ...attrs] = c.split('; '); const [k, v] = [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]; if (attrs.some((a) => a === 'Max-Age=0')) delete jar[k]; else jar[k] = v; }
      return r;
    },
    async signInWithGoogle(user, { tamperState = false, dropCookie = false } = {}) {
      googleUser = user; googleMode = googleMode === 'ok' ? 'ok' : googleMode;
      const s = await this.req('GET', '/api/auth/google/start?return=/passport/');
      const loc = new URL(s.headers.get('Location')); nextNonce = loc.searchParams.get('nonce');
      const state = loc.searchParams.get('state');
      if (dropCookie) delete jar['__Host-tp_oauth'];
      return this.req('GET', '/api/auth/google/callback?code=abc&state=' + (tamperState ? 'WRONG' : state));
    },
    me: async function () { return (await this.req('GET', '/api/me')).json(); },
  };
}
const joinBody = (name, extra) => ({ username: name, adult: true, terms: '2026-10-draft', ...(extra || {}) });

// ===== start =====
let A = browser();
let r = await A.req('GET', '/api/auth/google/start?return=/passport/');
let loc = new URL(r.headers.get('Location'));
check(r.status === 302 && loc.origin === 'https://accounts.google.com', 'start: redirects to Google');
check(loc.searchParams.get('code_challenge_method') === 'S256' && loc.searchParams.get('code_challenge').length >= 43, 'start: uses PKCE (S256)');
check(loc.searchParams.get('scope') === 'openid email', 'start: asks for openid + email only (no name, no photo)');
check(loc.searchParams.get('redirect_uri') === ORIGIN + '/api/auth/google/callback' && loc.searchParams.get('client_id') === 'cid.apps.test', 'start: callback address is this site');
check(!!loc.searchParams.get('state') && !!loc.searchParams.get('nonce'), 'start: has state and nonce');
const sc = r.headers.getSetCookie()[0];
check(/^__Host-tp_oauth=/.test(sc) && /Secure/.test(sc) && /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\//.test(sc) && !/Domain=/.test(sc), 'start: cookie is __Host-, Secure, HttpOnly, SameSite=Lax');
check(r.headers.get('cache-control') === 'no-store', 'start: not cached');
const stored = db.prepare('SELECT state_hash FROM oauth_states').all();
check(stored.length === 1 && !JSON.stringify(stored).includes(loc.searchParams.get('state')), 'start: only a hash of the state is stored');
r = await handle(new Request(ORIGIN + '/api/auth/google/start'), { DB: env.DB }, deps);
check(r.status === 302 && /e=not_configured/.test(r.headers.get('Location')), 'start: without Google keys sends the player back with a friendly code');

// ===== callback safety =====
A = browser(); r = await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' }, { tamperState: true });
check(/e=expired/.test(r.headers.get('Location')) && db.prepare('SELECT COUNT(*) c FROM players').get().c === 0, 'callback: wrong state is refused');
A = browser(); r = await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' }, { dropCookie: true });
check(/e=expired/.test(r.headers.get('Location')), 'callback: missing browser cookie is refused (blocks login forgery)');
A = browser(); let s = await A.req('GET', '/api/auth/google/start'); loc = new URL(s.headers.get('Location')); nextNonce = loc.searchParams.get('nonce');
const st = loc.searchParams.get('state');
r = await A.req('GET', '/api/auth/google/callback?code=abc&state=' + st); const firstOk = /step=join/.test(r.headers.get('Location'));
A.jar['__Host-tp_oauth'] = st;                                             // the same state used a second time
r = await A.req('GET', '/api/auth/google/callback?code=abc&state=' + st);
check(firstOk && /e=expired/.test(r.headers.get('Location')), 'callback: a state can be used only once (replay refused)');
check(lastTokenBody.code_verifier && lastTokenBody.grant_type === 'authorization_code' && lastTokenBody.client_secret === 'sek', 'callback: sends the PKCE verifier and secret to Google, server side only');
A = browser(); s = await A.req('GET', '/api/auth/google/start'); loc = new URL(s.headers.get('Location')); nextNonce = loc.searchParams.get('nonce');
NOW += 11 * 60000; r = await A.req('GET', '/api/auth/google/callback?code=abc&state=' + loc.searchParams.get('state'));
check(/e=expired/.test(r.headers.get('Location')), 'callback: a sign-in older than 10 minutes is refused'); NOW -= 11 * 60000;
for (const [mode, code] of [['fail', 'failed'], ['badnonce', 'failed'], ['badaud', 'failed'], ['expired', 'failed'], ['unverified', 'email']]) {
  googleMode = mode; A = browser(); r = await A.signInWithGoogle({ sub: 'g-x', email: 'x@example.com' });
  check(new RegExp('e=' + code).test(r.headers.get('Location')) && !A.jar['__Host-tp_signup'] && !A.jar['__Host-tp_session'], 'callback: Google answer "' + mode + '" gives no account and no cookie');
}
googleMode = 'ok';
A = browser(); s = await A.req('GET', '/api/auth/google/callback?error=access_denied&state=x');
check(/e=cancelled/.test(s.headers.get('Location')), 'callback: player pressed Cancel at Google');

// ===== joining =====
A = browser(); r = await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
check(/step=join/.test(r.headers.get('Location')) && !!A.jar['__Host-tp_signup'] && !A.jar['__Host-tp_session'], 'new Google account: goes to the join step, no session yet');
let m = await A.me(); check(m.pending === true && m.signedIn === false && m.emailHint === 'm***@example.com' && !JSON.stringify(m).includes('mira@'), '/api/me while joining: shows only a masked email');
check(db.prepare('SELECT COUNT(*) c FROM players').get().c === 0, 'nothing is stored as a player until the join step is finished');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira', { adult: false }) }); check(r.status === 400 && (await r.json()).error === 'adult_required', 'join: without the 18+ tick no account is made');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira', { adult: 'true' }) }); check(r.status === 400, 'join: the 18+ tick must be a real yes');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira', { terms: 'old' }) }); check(r.status === 400 && (await r.json()).error === 'terms_required', 'join: terms must be the current version');
r = await A.req('POST', '/api/signup', { body: joinBody('ab') }); check(r.status === 400, 'join: username too short refused');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira', {}), header: null }); check(r.status === 403, 'join: request without our own header is refused (cross-site forgery)');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira'), origin: 'https://evil.example' }); check(r.status === 403, 'join: request from another website is refused');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira'), ct: 'text/plain' }); check(r.status === 403, 'join: request that is not JSON is refused');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira'), cookies: false }); check(r.status === 401, 'join: without the join cookie there is nothing to finish');
r = await A.req('POST', '/api/signup', { body: joinBody('Mira') }); let j = await r.json();
check(r.status === 200 && /^TDY-[0-9A-HJKMNP-TV-Z]{8}$/.test(j.passportId), 'join: account made with a Passport ID like ' + j.passportId);
const pid = j.passportId;
const row = db.prepare('SELECT * FROM players WHERE id=?').get(pid);
check(row.username === 'Mira' && row.adult_confirmed_at && row.terms_version === '2026-10-draft' && row.status === 'active' && row.signin_method === 'google' && /^2026-W\d\d$/.test(row.join_week), 'join: player row has name, 18+ date, terms version, join week');
const la = db.prepare('SELECT * FROM linked_accounts').all();
check(la.length === 1 && la[0].provider_hash.length === 64 && !JSON.stringify(la).includes('g-1') && !JSON.stringify(la).includes('mira@'), 'join: Google link stores only a salted hash, never the raw id or email');
check(db.prepare('SELECT email FROM player_contacts WHERE player_id=?').get(pid).email === 'mira@example.com', 'join: email is kept in its own table');
check(!!A.jar['__Host-tp_session'] && !A.jar['__Host-tp_signup'], 'join: logged in, join cookie removed');
const tokenInDb = db.prepare('SELECT token_hash FROM sessions').get().token_hash;
check(tokenInDb.length === 64 && tokenInDb !== A.jar['__Host-tp_session'], 'session: the database holds a hash, not the cookie value');
m = await A.me(); check(m.signedIn && m.passportId === pid && m.username === 'Mira' && !('email' in m), '/api/me: signed in, no email shown');
check(db.prepare('SELECT COUNT(*) c FROM trust_scores WHERE player_id=?').get(pid).c === 1, 'join: trust record started');

// ===== same person returns =====
let A2 = browser(); r = await A2.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
m = await A2.me(); check(/\/passport\//.test(r.headers.get('Location')) && !/step=join/.test(r.headers.get('Location')) && m.passportId === pid, 'same Google account again: same Passport, straight in');
check(db.prepare('SELECT COUNT(*) c FROM players').get().c === 1, 'one person, one Passport');
r = await browser().req('GET', '/api/auth/google/start?return=//evil.example'); const lo = new URL(r.headers.get('Location'));
check(lo.origin === 'https://accounts.google.com', 'start with a bad return address still works');
const rs = db.prepare('SELECT return_to FROM oauth_states ORDER BY created_at DESC, rowid DESC LIMIT 1').get();
check(rs.return_to === '/passport/' && safeReturn('https://evil.example') === '/passport/' && safeReturn('/a/../b') === '/passport/' && safeReturn('/games/') === '/games/', 'return address: only plain paths on this site (no open redirect)');

// ===== usernames =====
check(nameKey('Mira') === nameKey('mIRA') && nameKey('M_ira') === nameKey('mira') && nameKey('Pa5ta') === nameKey('Pasta') && nameKey('B0b') === nameKey('Bob') && nameKey('Mira') === nameKey('Mlra') && nameKey('Mira') !== nameKey('Mara'), 'name check ignores capitals, underscores and look-alike digits');
check(!checkUsername('admin').ok && !checkUsername('Toddy').ok && !checkUsername('Official_Team').ok && !checkUsername('Adm1n').ok && checkUsername('ToddyFan').ok, 'reserved names blocked, ordinary names with Toddy allowed');
check(!checkUsername('12345').ok && !checkUsername('_mira').ok && !checkUsername('mi ra').ok && !checkUsername('mirä').ok && !checkUsername('a'.repeat(21)).ok && checkUsername('Mira_7').ok, 'username shape rules');
check(!checkUsername('NaZi_boy').ok, 'blocked-word list works');
const B = browser(); await B.signInWithGoogle({ sub: 'g-2', email: 'bo@example.com' });
r = await B.req('POST', '/api/signup', { body: joinBody('mira') }); check(r.status === 409 && (await r.json()).error === 'username_taken', 'B cannot take "mira" while A has "Mira"');
r = await B.req('POST', '/api/signup', { body: joinBody('M1ra') }); check(r.status === 409, 'B cannot take "M1ra" (look-alike of Mira)');
r = await B.req('POST', '/api/signup', { body: joinBody('Mlra') });
check(r.status === 409, 'B cannot take "Mlra" (look-alike of Mira)');
r = await B.req('POST', '/api/signup', { body: joinBody('Bo_Bear') }); check(r.status === 200, 'B joins as Bo_Bear'); const bPid = (await r.json()).passportId;
check(bPid !== pid, 'B has a different Passport');

// rename: A has just joined, so one free change in the first 24 hours
r = await A.req('POST', '/api/me/username', { body: { username: 'MiraMoon' } }); j = await r.json();
check(r.status === 200 && j.username === 'MiraMoon' && db.prepare('SELECT username FROM players WHERE id=?').get(pid).username === 'MiraMoon', 'rename: one free change in the first 24 hours');
r = await A.req('POST', '/api/me/username', { body: { username: 'MiraSun' } }); j = await r.json();
check(r.status === 429 && j.error === 'username_cooldown' && !!j.nextAt, 'rename: the next change must wait 30 days (shows the date)');
r = await B.req('POST', '/api/signup', { body: joinBody('Mira') }).catch(() => null);
r = await B.req('POST', '/api/me/username', { body: { username: 'Mira' } }); j = await r.json();
check((r.status === 409 && j.error === 'username_taken') || r.status === 429, 'B cannot take A\'s old name "Mira" while it is reserved for A');
const bFirst = db.prepare('SELECT claimed_at FROM username_claims WHERE player_id=? AND is_current=1').get(bPid).claimed_at;
NOW += 31 * DAY;                                   // sessions last 30 days, so both sign in again
const B2 = browser(); await B2.signInWithGoogle({ sub: 'g-2', email: 'bo@example.com' });
const A3 = browser(); await A3.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
r = await B2.req('POST', '/api/me/username', { body: { username: 'Mira' } }); j = await r.json();
check(r.status === 200 && j.username === 'Mira', 'after 30 days A\'s old name is free and B can take it (B was past their cooldown too)');
r = await A3.req('POST', '/api/me/username', { body: { username: 'MiraMoon' } });
check(r.status === 200, 'A can change again after 30 days (case-only change keeps the name)');
r = await A3.req('POST', '/api/me/username', { body: { username: 'Mira' } }); j = await r.json();
check(r.status === 429 && j.error === 'username_cooldown' || r.status === 409, 'A cannot take the name B now holds');
r = await A.req('POST', '/api/me/username', { body: { username: 'x' }, header: null }); check(r.status === 403, 'rename: needs our own header');
r = await browser().req('POST', '/api/me/username', { body: { username: 'Nobody' } }); check(r.status === 401, 'rename: needs to be signed in');
void bFirst;

// ===== sign out, session, delete =====
const sid = A.jar['__Host-tp_session'];
r = await A.req('POST', '/api/auth/logout', { body: {} }); check(r.status === 200 && !A.jar['__Host-tp_session'], 'sign out clears the cookie');
const ghost = browser(); ghost.jar['__Host-tp_session'] = sid; m = await ghost.me(); check(m.signedIn === false, 'sign out: the old cookie no longer works');
A = browser(); await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
const exp = browser(); await A.me(); NOW += 31 * DAY; m = await A.me(); check(m.signedIn === false, 'a session older than 30 days expires'); NOW -= 31 * DAY;
A = browser(); await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
r = await A.req('POST', '/api/me/delete', { body: { confirm: 'no' } }); check(r.status === 400, 'delete: needs the word DELETE');
r = await A.req('POST', '/api/me/delete', { body: { confirm: 'DELETE' } }); check(r.status === 200, 'delete: done');
check(db.prepare('SELECT COUNT(*) c FROM player_contacts WHERE player_id=?').get(pid).c === 0 && db.prepare('SELECT COUNT(*) c FROM linked_accounts WHERE player_id=?').get(pid).c === 0 && db.prepare('SELECT COUNT(*) c FROM sessions WHERE player_id=?').get(pid).c === 0 && db.prepare('SELECT COUNT(*) c FROM username_claims WHERE player_id=?').get(pid).c === 0, 'delete: email, Google link, sessions and username are gone');
const gone = db.prepare('SELECT username,status FROM players WHERE id=?').get(pid);
check(gone.username === null && gone.status === 'removed' && db.prepare("SELECT COUNT(*) c FROM privacy_requests WHERE player_id=? AND type='delete'").get(pid).c === 1, 'delete: record kept without a name, deletion logged');
A = browser(); r = await A.signInWithGoogle({ sub: 'g-1', email: 'mira@example.com' });
check(/step=join/.test(r.headers.get('Location')), 'after deleting, the same Google account starts fresh (a new Passport, not the old one)');

// ===== abuse =====
let limitedAt = 0; const att = browser();
for (let i = 1; i <= 25; i++) { const x = await att.req('GET', '/api/auth/google/start', { ip: '9.9.9.9' }); if (/e=rate/.test(x.headers.get('Location') || '') && !limitedAt) limitedAt = i; }
check(limitedAt > 0 && limitedAt <= 22, 'too many sign-in starts from one address are slowed down (stopped at attempt ' + limitedAt + ')');
const other = await browser().req('GET', '/api/auth/google/start', { ip: '8.8.8.8' }); check(/accounts\.google\.com/.test(other.headers.get('Location')), 'another address is not affected');
r = await browser().req('GET', '/api/me'); const mm = await r.json(); check(r.headers.get('cache-control') === 'no-store' && mm.signInAvailable === true && mm.termsVersion === '2026-10-draft', '/api/me: not cached; says sign-in is available');
r = await browser().req('PUT', '/api/me'); check(r.status === 405, 'wrong method gets 405');
r = await handle(new Request(ORIGIN + '/api/health'), env); const hb = await r.json();
check(r.status === 200 && hb.ok && hb.schema === '0003' && hb.auth.googleClientSecret === true && !JSON.stringify(hb).includes('sek') && !JSON.stringify(hb).includes('salt-for-tests'), 'health: reports whether keys are set (yes/no only, never the values)');

console.log(bad ? 'PROBLEMS: ' + bad : 'auth tests ok'); if (bad) process.exitCode = 1;
