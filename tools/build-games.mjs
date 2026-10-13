#!/usr/bin/env node
/* ============================================================
   TODDY games — catalog builder
   ------------------------------------------------------------
   games/catalog.json is the ONE list of games. This script
   writes the game cards into the pages from it, so adding a
   game never means hand-editing several pages:

     index.html        menu "Play" link (+ "new" dot date), home Play section
     games/index.html  the full games page (rows, filters, grid)
     sitemap.xml       one entry per game

   Usage
     node tools/build-games.mjs          validate + write the pages
     node tools/build-games.mjs --check  validate + fail if the pages are
                                         out of date (used by GitHub Actions)

   Output depends ONLY on catalog.json (never on today's date), so
   --check gives the same answer every day. Date-based things
   ("New" badges, the menu dot) are written as data-new-until="…"
   and switched off in the browser after that date.

   The site has no build step on Cloudflare: the generated HTML is
   committed, so pages work without JavaScript, stay fast, and keep
   the strict CSP (no inline scripts or styles).
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/* ---- Layout rules (the page grows by itself as games are added) ---- */
export const RULES = {
  HOME_MAX: 4,          // cards on the home page, ever
  NEW_DAYS: 21,         // "New" badge lasts this long after `added`
  NAV_DOT_DAYS: 7,      // gold dot on the menu "Play" link after a new game
  DAILY_ROW_MIN: 3,     // "Today's Dailies" row appears at this many daily games
  FILTERS_MIN: 6,       // filter buttons + "New this week" row appear at this many games
  PAGE_SIZE: 12,        // games shown before "Show more games"
  SEARCH_MIN: 20,       // search box appears at this many games
  QUICK_MINUTES: 3,     // "Under 3 min" filter
  CARD_W: 800, CARD_H: 450
};

const ALLOWED_KEYS = new Set(['id', 'title', 'path', 'status', 'category', 'daily', 'minutes',
  'orientation', 'meta', 'text', 'hubText', 'card', 'cardAlt', 'featured', 'added', 'updated']);
const STATUS = { beta: 'Beta', live: '', soon: 'Coming soon' };
const ORIENTATION = new Set(['upright', 'sideways', 'any']);

/* ---------------- helpers ---------------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))
  && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/* Width/height of a .webp (VP8, VP8L or VP8X), so a wrong-sized card
   picture is caught before it squashes the layout. */
function webpSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const n = b.readUInt32LE(21);
    return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/* ---------------- validation ---------------- */
export function validate(catalog, { root = ROOT, checkFiles = true } = {}) {
  const errors = [];
  const err = (g, msg) => errors.push(`${g && g.id ? g.id : '(game)'}: ${msg}`);
  if (!catalog || typeof catalog.categories !== 'object' || !Array.isArray(catalog.games)) {
    return ['catalog.json needs "categories" (object) and "games" (list)'];
  }
  const ids = new Set();
  let featured = 0;
  for (const g of catalog.games) {
    for (const k of Object.keys(g)) if (!ALLOWED_KEYS.has(k)) err(g, `unknown field "${k}" (typo?)`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id || '')) err(g, 'id must be lowercase-with-dashes');
    if (ids.has(g.id)) err(g, 'id used twice'); ids.add(g.id);
    if (!(g.status in STATUS)) err(g, `status must be one of ${Object.keys(STATUS).join(', ')}`);
    if (!(g.category in catalog.categories)) err(g, `category must be one of ${Object.keys(catalog.categories).join(', ')}`);
    if (typeof g.daily !== 'boolean') err(g, 'daily must be true or false');
    if (!(typeof g.minutes === 'number' && g.minutes > 0 && g.minutes < 120)) err(g, 'minutes must be a number like 2');
    if (!ORIENTATION.has(g.orientation)) err(g, 'orientation must be upright, sideways or any');
    for (const k of ['title', 'meta', 'text', 'cardAlt']) {
      if (typeof g[k] !== 'string' || !g[k].trim()) err(g, `${k} is required`);
      else if (/[<>]/.test(g[k])) err(g, `${k} must be plain text (no HTML)`);
    }
    if (typeof g.title === 'string' && g.title.length > 28) err(g, 'title is too long for a card (max 28)');
    if (typeof g.text === 'string' && g.text.length > 110) err(g, 'text is too long for a home card (max 110)');
    if (g.hubText !== undefined && (typeof g.hubText !== 'string' || g.hubText.length > 160)) err(g, 'hubText must be text up to 160 characters');
    if (g.featured !== undefined && typeof g.featured !== 'boolean') err(g, 'featured must be true or false');
    if (g.featured) featured++;
    if (!isDate(g.added)) err(g, 'added must be a date like 2026-10-20');
    if (g.updated !== undefined && (!isDate(g.updated) || g.updated < g.added)) err(g, 'updated must be a date on/after added');
    if (g.path !== `/games/${g.id}/`) err(g, `path must be /games/${g.id}/`);
    if (checkFiles) {
      if (g.status !== 'soon' && !existsSync(join(root, 'games', g.id || '_', 'index.html'))) err(g, `games/${g.id}/index.html is missing`);
      const card = join(root, String(g.card || '').replace(/^\//, ''));
      if (!/^\/assets\/games\/[a-z0-9-]+\.webp$/.test(g.card || '')) err(g, 'card must be /assets/games/<name>.webp');
      else if (!existsSync(card)) err(g, `card picture ${g.card} is missing`);
      else {
        const s = webpSize(card);
        if (!s) err(g, `${g.card} is not a readable .webp`);
        else if (s.w !== RULES.CARD_W || s.h !== RULES.CARD_H) err(g, `${g.card} is ${s.w}x${s.h}, must be ${RULES.CARD_W}x${RULES.CARD_H}`);
        else if (statSync(card).size > 150 * 1024) err(g, `${g.card} is over 150 KB (keep cards light for phones)`);
      }
    }
  }
  if (featured > 1) errors.push('only one game can be "featured" (the home page lead card)');
  return errors;
}

/* ---------------- ordering ---------------- */
/* Newest first; games added the same day keep their catalog order. */
const byNewest = (list) => list.map((g, i) => [g, i])
  .sort((a, b) => (a[0].added < b[0].added ? 1 : a[0].added > b[0].added ? -1 : a[1] - b[1]))
  .map(([g]) => g);

export function plan(catalog) {
  const all = catalog.games;
  const playable = byNewest(all.filter((g) => g.status !== 'soon'));
  const soon = all.filter((g) => g.status === 'soon');
  /* Home: the featured (daily) game leads, then the newest, max HOME_MAX. */
  const lead = playable.find((g) => g.featured);
  const home = (lead ? [lead, ...playable.filter((g) => g !== lead)] : playable).slice(0, RULES.HOME_MAX);
  const dailies = playable.filter((g) => g.daily);
  const newest = playable.length ? playable[0].added : null;
  return {
    playable, soon, home, dailies,
    showDailyRow: dailies.length >= RULES.DAILY_ROW_MIN,
    showFilters: playable.length >= RULES.FILTERS_MIN,
    showNewRow: playable.length >= RULES.FILTERS_MIN,
    showMore: playable.length > RULES.PAGE_SIZE,
    showSearch: playable.length >= RULES.SEARCH_MIN,
    navNewUntil: newest ? addDays(newest, RULES.NAV_DOT_DAYS) : null
  };
}

/* ---------------- HTML ---------------- */
function card(g, { indent, lazy = true, hub = false, fetchHigh = false }) {
  const i = indent;
  const soon = g.status === 'soon';
  const tags = [];
  if (STATUS[g.status]) tags.push(`<span class="game-tag${soon ? ' is-soon' : ''}">${STATUS[g.status]}</span>`);
  if (!soon) tags.push(`<span class="game-tag is-new" data-new-until="${addDays(g.added, RULES.NEW_DAYS)}">New</span>`);
  tags.push(`<span class="game-meta">${esc(g.meta)}</span>`);
  const text = hub && g.hubText ? g.hubText : g.text;
  const data = hub
    ? ` data-category="${esc(g.category)}" data-daily="${g.daily}" data-minutes="${g.minutes}" data-search="${esc((g.title + ' ' + g.meta + ' ' + text).toLowerCase())}"`
    : '';
  const tag = soon ? 'div' : 'a';
  const href = soon ? '' : ` href="${g.path}"`;
  const img = `<img width="${RULES.CARD_W}" height="${RULES.CARD_H}"${lazy ? ' loading="lazy"' : ''}${fetchHigh ? ' fetchpriority="high"' : ''} decoding="async" src="${g.card}"\n${i}     alt="${esc(g.cardAlt)}" />`;
  return [
    `${i}<${tag} class="game-card${soon ? ' is-soon' : ''}"${href}${data}>`,
    `${i}  ${img}`,
    `${i}  <span class="game-card-body">`,
    `${i}    <span class="game-card-tags">${tags.join('')}</span>`,
    `${i}    <span class="game-card-title">${esc(g.title)}</span>`,
    `${i}    <span class="game-card-text">${esc(text)}</span>`,
    soon ? '' : `${i}    <span class="game-card-cta">Play now <span aria-hidden="true">&rarr;</span></span>`,
    `${i}  </span>`,
    `${i}</${tag}>`
  ].filter(Boolean).join('\n');
}

export function renderNav(p) {
  const dot = p.navNewUntil ? ` data-new-until="${p.navNewUntil}"` : '';
  return `    <li><a href="#play" class="nav-play"${dot} title="Play TODDY games">Play<span class="nav-new-dot" aria-hidden="true"></span></a></li>`;
}

export function renderHome(p) {
  const total = p.playable.length;
  const label = total > p.home.length ? `See all ${total} games` : 'See all games';
  const row = p.home.length > 2 ? ' play-row' : '';
  return [
    `    <div class="play-grid${row}" data-count="${p.home.length}">`,
    p.home.map((g) => card(g, { indent: '      ' })).join('\n'),
    '    </div>',
    `    <p class="play-all-wrap"><a class="play-all" href="/games/">${label} <span aria-hidden="true">&rarr;</span></a></p>`
  ].join('\n');
}

export function renderHub(p, catalog) {
  const I = '  ';
  const out = [];
  const row = (id, title, games) => {
    out.push(`${I}<section class="games-section" aria-labelledby="${id}" data-row="${id}">`);
    out.push(`${I}  <h2 class="games-h2" id="${id}">${title}</h2>`);
    out.push(`${I}  <div class="play-grid play-row">`);
    out.push(games.map((g) => card(g, { indent: `${I}    ` })).join('\n'));
    out.push(`${I}  </div>`);
    out.push(`${I}</section>`);
  };
  if (p.showDailyRow) row('games-daily', '<span aria-hidden="true">☕</span> Today&rsquo;s Dailies', p.dailies);
  if (p.showNewRow) {
    const fresh = p.playable.slice(0, 3);
    row('games-new', '<span aria-hidden="true">✨</span> New this week', fresh);
  }
  const extras = p.showFilters || p.showDailyRow;
  out.push(`${I}<section class="games-section" aria-labelledby="games-all">`);
  out.push(`${I}  <h2 class="games-h2${extras ? '' : ' sr-only'}" id="games-all">All games</h2>`);
  if (p.showSearch) {
    out.push(`${I}  <label class="games-search"><span class="sr-only">Search games</span><input type="search" id="games-search" placeholder="Search games" autocomplete="off" /></label>`);
  }
  if (p.showFilters) {
    const cats = Object.entries(catalog.categories)
      .filter(([k]) => p.playable.some((g) => g.category === k));
    const btn = (f, label, on) => `${I}    <button type="button" class="games-filter" data-filter="${f}" aria-pressed="${on}">${label}</button>`;
    out.push(`${I}  <div class="games-filters" role="group" aria-label="Show games by type">`);
    out.push(btn('all', 'All', true));
    for (const [k, label] of cats) out.push(btn(`category:${k}`, esc(label), false));
    if (p.dailies.length) out.push(btn('daily', 'Daily', false));
    if (p.playable.some((g) => g.minutes <= RULES.QUICK_MINUTES)) out.push(btn('quick', `Under ${RULES.QUICK_MINUTES} min`, false));
    out.push(`${I}  </div>`);
  }
  out.push(`${I}  <div class="play-grid games-grid" id="games-grid" data-count="${p.playable.length}" data-page-size="${RULES.PAGE_SIZE}" data-quick="${RULES.QUICK_MINUTES}">`);
  out.push(p.playable.map((g, n) => card(g, { indent: `${I}    `, hub: true, lazy: n >= 2 })).join('\n'));
  out.push(`${I}  </div>`);
  out.push(`${I}  <p class="games-empty" id="games-empty" hidden>No games match. Try another filter.</p>`);
  if (p.showMore) out.push(`${I}  <p class="games-more-wrap"><button type="button" class="play-all games-more" id="games-more" hidden>Show more games</button></p>`);
  out.push(`${I}  <p class="sr-only" id="games-status" aria-live="polite"></p>`);
  out.push(`${I}</section>`);
  if (p.soon.length) {
    out.push(`${I}<section class="games-section" aria-labelledby="games-soon">`);
    out.push(`${I}  <h2 class="games-h2" id="games-soon"><span aria-hidden="true">🔜</span> Coming soon</h2>`);
    out.push(`${I}  <div class="play-grid">`);
    out.push(p.soon.map((g) => card(g, { indent: `${I}    ` })).join('\n'));
    out.push(`${I}  </div>`);
    out.push(`${I}</section>`);
  }
  return out.join('\n');
}

export function renderSitemap(p) {
  const hubMod = p.playable.reduce((m, g) => ((g.updated || g.added) > m ? (g.updated || g.added) : m), '0000-00-00');
  const url = (loc, mod, pri) => `  <url>\n    <loc>https://toddy.meme${loc}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
  return [url('/games/', hubMod, '0.8'), ...p.playable.map((g) => url(g.path, g.updated || g.added, '0.7'))].join('\n');
}

/* Replace the text between <!-- GAMES:NAME:START --> and <!-- GAMES:NAME:END --> */
function inject(src, name, body, file) {
  const re = new RegExp(`(<!-- GAMES:${name}:START[^>]*-->)[\\s\\S]*?(\\n[ \\t]*<!-- GAMES:${name}:END -->)`);
  if (!re.test(src)) throw new Error(`${file}: marker GAMES:${name} not found`);
  return src.replace(re, (_, a, b) => a + '\n' + body + b);
}

/* ---------------- main ---------------- */
function main() {
  const catalog = JSON.parse(read('games/catalog.json'));
  const errors = validate(catalog);
  if (errors.length) {
    console.error('games/catalog.json has problems:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
  const p = plan(catalog);
  const targets = {
    'index.html': (s, f) => inject(inject(s, 'NAV', renderNav(p), f), 'HOME', renderHome(p), f),
    'games/index.html': (s, f) => inject(s, 'HUB', renderHub(p, catalog), f),
    'sitemap.xml': (s, f) => inject(s, 'SITEMAP', renderSitemap(p), f)
  };
  let stale = [];
  for (const [file, fn] of Object.entries(targets)) {
    const before = read(file);
    const after = fn(before, file);
    if (before !== after) {
      if (CHECK) stale.push(file); else { writeFileSync(join(ROOT, file), after); console.log('updated', file); }
    }
  }
  if (CHECK && stale.length) {
    console.error('Out of date (run `node tools/build-games.mjs` and commit): ' + stale.join(', '));
    process.exit(1);
  }
  console.log(`${p.playable.length} games, ${p.soon.length} coming soon. Home shows ${p.home.length}.` +
    `${CHECK ? ' Pages are up to date.' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
