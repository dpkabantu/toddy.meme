// TODDY Trail level plan: which layout, how much time, which look, for every level number. Pure logic (no screen), so it is tested in Node.
// 7 story nights x 10 levels = levels 1..70, then endless nights (Night 8, 9, ...) forever. Level 10 of every night is a boss.
// Layouts come from the two pre-checked pools (every layout was proven winnable by the real rules). They are sorted by one difficulty score,
// and level L takes the layout at its place on that line, so each level is a little harder than the one before.
// Everything is seeded by the level number: Night 3 Level 4 is the same for every player and a retry gives the same level.
import { STEPS_PER_SEC } from './core.js';
import { pickFloor, obstacleForPainted, OBSTACLE_LIST } from './floors.js';

export const PER_NIGHT = 10, STORY_NIGHTS = 7, STORY_LEVELS = PER_NIGHT * STORY_NIGHTS;
export const LEVEL_ID = 1000;   // the id the rules module registers the current level under
const WHO = ['milo', 'pip', 'velvet', 'lumi', 'biscuit', 'drizzle', 'pebble', 'bao', 'nova', 'maple', 'cosmo', 'fizz', 'tilly', 'pearl', 'gus'];
const W = 9;

export const NIGHT_INFO = {
  1: { name: 'Opening Night', tell: 'Light the lamp, open the café, and bring everyone their drink.', music: 1, weather: { none: 5, wind: 5 } },
  2: { name: 'Terrace Night', tell: 'A breezy terrace: tables and parasols are in the way. Brew a new cup at the golden ring.', music: 2, weather: { none: 4, wind: 6 } },
  3: { name: 'Market Night', tell: 'Market lane: mind the rolling tea cart.', music: 3, weather: { none: 4, wind: 3, rain: 3 } },
  4: { name: 'Rainy Night', tell: 'Rain! Puddles are slippery and make Toddy slide one extra step.', music: 4, weather: { rain: 6, storm: 4 } },
  5: { name: 'Library Night', tell: 'Quiet library: shutters open and close, so wait for the green light.', music: 5, weather: { none: 6, wind: 2, rain: 2 } },
  6: { name: 'Moon Bridge Night', tell: 'Moon bridge: Nox the night thief snatches a cup if you pass too close.', music: 6, weather: { wind: 4, storm: 3, none: 3 } },
  7: { name: 'Street Party Night', tell: 'Street party: everything at once!', music: 7, weather: { none: 2, wind: 2, rain: 3, storm: 3 } },
};
const ENDLESS_MUSIC = [2, 3, 5, 6, 4, 7];
export const nightName = (n) => (NIGHT_INFO[n] ? NIGHT_INFO[n].name : 'Endless Night ' + n);
export const nightTell = (n) => (NIGHT_INFO[n] ? NIGHT_INFO[n].tell : 'The nights never end. Every level is a little harder than the one before.');
export const nightOf = (L) => Math.floor((L - 1) / PER_NIGHT) + 1;
export const posInNight = (L) => ((L - 1) % PER_NIGHT) + 1;
export const levelOf = (night, pos) => (night - 1) * PER_NIGHT + pos;
export const isBoss = (L) => L % PER_NIGHT === 0;
export const isStory = (L) => L <= STORY_LEVELS;

export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (L, salt) => (Math.imul(L + 1, 2654435761) ^ Math.imul((salt | 0) + 977, 40503)) >>> 0;
const shuffle = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickWeighted = (rnd, table) => { const ks = Object.keys(table), tot = ks.reduce((s, k) => s + table[k], 0); let r = rnd() * tot; for (const k of ks) { r -= table[k]; if (r < 0) return k; } return ks[0]; };

// ---- the pool, sorted by difficulty ----
let ALL = null;
export function mergePools(straight, diag) {
  const hz = (l) => (l.cart ? 1 : 0) + (l.thief ? 1 : 0) + (l.shutters && l.shutters.length ? 1 : 0) + (l.puddles && l.puddles.length ? 1 : 0);
  const out = [];
  for (const l of straight) { const nd = new Set(l.cups).size; out.push({ ...l, nd, hz: hz(l), fromDiag: false, skillBest: Math.round(l.best * 0.85) }); }   // diagonal steps save about 15 to 25 percent; 15 keeps the estimate on the safe (slower) side
  for (const l of diag) out.push({ ...l, nd: l.nd || new Set(l.cups).size, hz: hz(l), fromDiag: true, skillBest: l.best });
  for (const l of out) l.score = l.tier * 100 + l.visitors.length * 6 + l.best / 4 + l.hz * 3 + l.nd * 4;
  out.sort((a, b) => a.score - b.score || a.best - b.best);
  return out;
}
export function loadAll() {
  if (!ALL) ALL = Promise.all([import('./endless-pool.js'), import('./endless-diag-pool.js')]).then(([a, b]) => mergePools(a.POOL, b.POOL));
  return ALL;
}

// ---- time ----
// A skilled player (not the solver) needs: the best route a little slower (x1.2), plus a moment to decide at every stop (about 0.75 s = 3.75 steps at Quick speed),
// plus one tap per leg of the route. The limit is that time times a margin that shrinks level by level: 3.4 on level 1 down to about 1.7 on level 70 and 1.4 deep in the endless nights.
export const STOP_STEPS = 3.75;
export const marginFor = (L) => Math.max(1.4, 3.4 - 0.025 * (L - 1)) - (isBoss(L) ? 0.1 : 0);   // never below 1.3: even the hardest boss leaves a skilled player a clear 30 percent of slack
export function skillSteps(e) {
  const stops = e.visitors.length + e.brew.length + Math.ceil(e.skillBest / 8);
  return e.skillBest * 1.2 + stops * STOP_STEPS;
}
export const limitSteps = (e, L) => Math.max(20 * STEPS_PER_SEC, Math.ceil(skillSteps(e) * marginFor(L)));

// ---- which layout ----
export function layoutIndex(all, L, rnd) {
  const N = all.length;
  if (L <= STORY_LEVELS) return Math.round(((L - 1) / (STORY_LEVELS - 1)) * 0.88 * (N - 1));   // strictly climbing
  const lo = Math.floor(0.7 * (N - 1)); return lo + Math.floor(rnd() * (N - lo));            // endless nights: the hardest third, in a repeatable shuffle
}

// ---- build one level ----
// opts: { floorMode: 'random' | 'painted' | 'plain', salt: 0 (daily levels use the date) }
export function buildLevel(all, L, opts = {}) {
  const salt = opts.salt || 0, rnd = mulberry(seedOf(L, salt));
  const idx = layoutIndex(all, L, rnd), base = all[idx];
  const mirror = rnd() < 0.5, perm = shuffle(rnd, [0, 1, 2, 3, 4, 5, 6]);
  const mx = (x) => (mirror ? W - 1 - x : x), pt = ([x, y]) => [mx(x), y];
  const night = nightOf(L), info = NIGHT_INFO[night];
  const floor = pickFloor(rnd, opts.floorMode || 'random');
  const obR = rnd();   // always drawn, so changing the floor setting never changes the rest of the level
  const ob = floor.kind === 'painted' ? obstacleForPainted(floor.id) : OBSTACLE_LIST[Math.floor(obR * OBSTACLE_LIST.length)];
  const wk = pickWeighted(rnd, isBoss(L) ? { storm: 6, rain: 2, wind: 2 } : info ? info.weather : { none: 2, wind: 3, rain: 3, storm: 2 });
  const weather = { rain: wk === 'rain' || wk === 'storm', storm: wk === 'storm', wind: wk === 'wind' || wk === 'rain' || wk === 'storm' ? rnd() < (wk === 'wind' ? 1 : 0.5) : false };
  const music = isBoss(L) ? 'boss' : info ? info.music : ENDLESS_MUSIC[(night - 8) % ENDLESS_MUSIC.length];
  const steps = limitSteps(base, L);
  const def = {
    id: LEVEL_ID, name: nightName(night) + ' · Level ' + posInNight(L), w: base.w, h: base.h, diag: true,
    start: { ...base.start }, cups: base.cups.map((d) => perm[d]), seconds: Math.ceil(steps / STEPS_PER_SEC),
    tables: base.tables.map(pt), brew: base.brew.map((b) => ({ x: mx(b.x), y: b.y, drink: perm[b.drink] })),
    visitors: base.visitors.map((v) => ({ who: WHO[Math.floor(rnd() * WHO.length)], sx: mx(v.sx), sy: v.sy, bx: mx(v.bx), by: v.by, want: perm[v.want] })),
  };
  if (base.shutters) def.shutters = base.shutters.map((s) => ({ ...s, x: mx(s.x) }));
  if (base.cart) def.cart = { ...base.cart, path: base.cart.path.map(pt) };
  if (base.thief) def.thief = { ...base.thief, path: base.thief.path.map(pt) };
  if (base.puddles) def.puddles = base.puddles.map(pt);
  return { def, meta: { L, night, pos: posInNight(L), boss: isBoss(L), floor, ob, weather, music, idx, best: base.best, skillBest: base.skillBest, skill: Math.ceil(skillSteps(base)), limit: def.seconds * STEPS_PER_SEC, margin: marginFor(L), diffScore: base.score, visitors: def.visitors.length, hazards: base.hz } };
}

// ---- stars ----
// 1 star: at least 60 percent of the visitors served. 2 stars: everyone served. 3 stars: everyone served and no cup lost.
export function starsFor(st) {
  const n = st.served.length, c = st.served.filter(Boolean).length;
  if (c === n) return st.spills + st.snatched === 0 ? 3 : 2;
  return c >= Math.ceil(n * 0.6) ? 1 : 0;
}
