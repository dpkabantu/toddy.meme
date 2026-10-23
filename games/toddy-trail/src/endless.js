// TODDY Trail endless mode: builds one random level from the pre-checked pool (endless-pool.js, made by tools/gen-endless.mjs).
// Every layout in the pool was proven winnable by the real game rules. On top of that each run is varied at random in ways that
// cannot change winnability: mirror left/right, swap the three drinks around, new faces for the visitors and a random floor,
// so a player cannot learn the order of levels. The recipe of every level is returned so a run can be rebuilt exactly.
const W = 9;
const WHO = ['milo', 'pip', 'velvet', 'lumi', 'biscuit', 'drizzle', 'pebble', 'bao', 'nova', 'maple', 'cosmo', 'fizz', 'tilly'];
let poolPromise = null;
export function loadPool() { return poolPromise || (poolPromise = import('./endless-pool.js').then((m) => m.POOL)); }

const shuffle = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// rnd: a function returning [0,1). Default is crypto-based so every run differs; pass a seeded one in tests.
export const cryptoRnd = () => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (_) { return Math.random(); } };

export function makeLevel(n, pool, cfg, rnd = cryptoRnd, force = {}) {
  const tier = cfg.tierFor(n);
  let cand = pool.filter((l) => l.tier === tier);
  if (!cand.length) { const tiers = [...new Set(pool.map((l) => l.tier))].sort((a, b) => a - b); const t = tiers.reduce((b, x) => (Math.abs(x - tier) < Math.abs(b - tier) ? x : b), tiers[0]); cand = pool.filter((l) => l.tier === t); }
  const idx = force.index !== undefined ? force.index : Math.floor(rnd() * cand.length), base = cand[idx];
  const mirror = force.mirror !== undefined ? force.mirror : rnd() < 0.5;
  const perm = force.perm || shuffle(rnd, [0, 1, 2]);              // drink d becomes perm[d]
  const theme = force.theme || cfg.themes[Math.floor(rnd() * cfg.themes.length)];
  const mx = (x) => (mirror ? W - 1 - x : x);
  const pt = ([x, y]) => [mx(x), y];
  const def = {
    id: 1000, name: 'Endless', w: base.w, h: base.h, start: { ...base.start }, cups: base.cups.map((d) => perm[d]),
    seconds: Math.max(cfg.minSeconds, Math.ceil((base.best / 4) * cfg.timeFactor(n))),
    tables: base.tables.map(pt),
    brew: base.brew.map((b) => ({ x: mx(b.x), y: b.y, drink: perm[b.drink] })),
    visitors: base.visitors.map((v) => ({ who: WHO[Math.floor(rnd() * WHO.length)], sx: mx(v.sx), sy: v.sy, bx: mx(v.bx), by: v.by, want: perm[v.want] })),
  };
  if (base.shutters) def.shutters = base.shutters.map((s) => ({ ...s, x: mx(s.x) }));
  if (base.cart) def.cart = { ...base.cart, path: base.cart.path.map(pt) };
  if (base.thief) def.thief = { ...base.thief, path: base.thief.path.map(pt) };
  if (base.puddles) def.puddles = base.puddles.map(pt);
  return { def, theme, recipe: { n, tier, index: idx, mirror, perm, theme }, best: base.best };
}
