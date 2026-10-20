// TODDY Seasons server (Cloudflare Worker). Stage 1: health check only.
// Runs ONLY for /api/* (see wrangler.jsonc, run_worker_first). Everything else on toddy.meme is the static site.
// No cookies, no secrets, no player data in this stage.

import { googleStart, googleCallback, me, signup, changeUsername, logout, deleteMe, authStatus } from './auth.js';

export const EXPECTED_SCHEMA = '0002';
export const EXPECTED_TABLES = [
  'schema_migrations', 'seasons', 'rule_versions', 'games', 'season_games', 'players', 'linked_accounts',
  'device_signals', 'game_runs', 'points_ledger', 'daily_activity', 'weekly_summary', 'referrals',
  'quest_completions', 'contributions', 'trust_scores', 'trust_flags', 'admin_audit_log', 'final_standings',
  'privacy_requests', 'oauth_states', 'pending_signups', 'sessions', 'player_contacts', 'terms_versions', 'username_claims', 'rate_limits',
];

// The API is JSON only and must never be cached or framed.
const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

function json(status, body, extra) {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...(extra || {}) } });
}

async function health(env) {
  if (!env || !env.DB) return json(503, { ok: false, service: 'toddy-api', db: 'not configured' });
  try {
    const rows = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const have = new Set((rows.results || []).map((r) => r.name));
    const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
    let schema = null;
    if (have.has('schema_migrations')) {
      const r = await env.DB.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').first();
      schema = r ? r.version : null;
    }
    const ok = missing.length === 0 && schema !== null && schema >= EXPECTED_SCHEMA;
    return json(ok ? 200 : 503, { ok, service: 'toddy-api', db: 'connected', schema, expectedSchema: EXPECTED_SCHEMA, tables: EXPECTED_TABLES.length - missing.length, missing, auth: authStatus(env), time: new Date().toISOString() });
  } catch (e) {
    console.error('health check failed', e && e.message);     // detail stays in the Cloudflare logs, never in the answer
    return json(503, { ok: false, service: 'toddy-api', db: 'error' });
  }
}

export async function handle(request, env, deps) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/api' && !path.startsWith('/api/')) {
    // Not ours. In production this is never reached (the static site answers first), but stay safe.
    return env && env.ASSETS ? env.ASSETS.fetch(request) : json(404, { ok: false, error: 'not_found' });
  }
  if (path === '/api/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
    const res = await health(env);
    return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
  }
  const routes = {
    'GET /api/auth/google/start': googleStart,
    'GET /api/auth/google/callback': (r, e) => googleCallback(r, e, deps),
    'GET /api/me': me,
    'POST /api/signup': signup,
    'POST /api/me/username': changeUsername,
    'POST /api/auth/logout': logout,
    'POST /api/me/delete': deleteMe,
  };
  const fn = routes[request.method + ' ' + path];
  if (fn) return fn(request, env);
  if (Object.keys(routes).some((k) => k.endsWith(' ' + path))) return json(405, { ok: false, error: 'method_not_allowed' });
  return json(404, { ok: false, error: 'not_found' });
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) { console.error('unhandled', e && e.message); return json(500, { ok: false, error: 'server_error' }); }
  },
};
