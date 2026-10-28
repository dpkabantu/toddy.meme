// TODDY Trail saved progress and settings. Stays on this device only (localStorage); every read and write is wrapped, because storage can be blocked.
// Guests need nothing else: no account, no wallet. A Passport can read these numbers later through the shared systems.
import { PER_NIGHT, STORY_LEVELS, nightOf } from './levels.js';
import { dayKey, dailyPlan, GOALS } from './daily.js';

const KEY = 'trailV2';
const DEFAULT_SETTINGS = { music: true, sfx: true, speed: 'Quick', floors: 'random', weather: 'full', unlockAll: false };
let P = null;
const fresh = () => ({ v: 1, stars: {}, best: {}, settings: { ...DEFAULT_SETTINGS }, daily: null, streak: { count: 0, last: '' }, seenIntro: {} });
function load() {
  if (P) return P;
  try { const raw = JSON.parse(localStorage.getItem(KEY)); P = raw && raw.v === 1 ? { ...fresh(), ...raw, settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) } } : fresh(); } catch (_) { P = fresh(); }
  return P;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (_) { /* storage optional */ } }

export const settings = () => load().settings;
export function setSetting(k, v) { load().settings[k] = v; save(); }
export function resetAll() { P = fresh(); save(); }
export const starsOf = (L) => load().stars[L] || 0;
export const bestOf = (L) => load().best[L] || 0;
export function highestCleared() { let h = 0; for (const k of Object.keys(load().stars)) if (load().stars[k] > 0) h = Math.max(h, +k); return h; }
export const isUnlocked = (L) => L === 1 || load().settings.unlockAll || L <= highestCleared() + 1;
export const nextLevel = () => Math.min(highestCleared() + 1, 100000);
export const nightStars = (n) => { let s = 0; for (let p = 1; p <= PER_NIGHT; p++) s += starsOf((n - 1) * PER_NIGHT + p); return s; };
export const totalStars = () => Object.values(load().stars).reduce((a, b) => a + b, 0);
export const nightsUnlocked = () => nightOf(highestCleared() + 1);   // highest night the player can open
export const seenIntro = (n) => !!load().seenIntro[n];
export function markIntro(n) { load().seenIntro[n] = 1; save(); }

// result of one play: returns { newBest, starsGained, firstClear }
export function recordResult(L, stars, score) {
  load();
  const before = P.stars[L] || 0, first = before === 0 && stars > 0;
  if (stars > before) P.stars[L] = stars;
  const newBest = score > (P.best[L] || 0); if (newBest) P.best[L] = score;
  save(); return { newBest, first, gained: Math.max(0, stars - before) };
}

// ---- the Daily Run: three levels and three goals, the same for everyone on the same (UTC) day ----
export function todaysDaily() {
  load(); const key = dayKey(), plan = dailyPlan(key);
  if (!P.daily || P.daily.key !== key) { P.daily = { key, done: [0, 0, 0], stars: [0, 0, 0], goals: {}, rewarded: false }; save(); }
  return { plan, state: P.daily, streak: currentStreak() };
}
export function currentStreak() {
  load(); const key = dayKey(), y = dayKey(new Date(Date.now() - 86400000));
  return P.streak.last === key || P.streak.last === y ? P.streak.count : 0;
}
// call after every finished play (story, endless or daily): counts towards today's goals
export function recordPlay(info) {
  const { plan, state } = todaysDaily();
  for (const g of plan.goals) {
    const def = GOALS[g.id]; const add = def.count(info); if (add) state.goals[g.id] = Math.min(g.target, (state.goals[g.id] || 0) + add);
  }
  save();
}
export function recordDailyLevel(i, stars) {
  const { state } = todaysDaily(); let finished = false;
  if (stars > 0) { state.done[i] = 1; state.stars[i] = Math.max(state.stars[i], stars); }
  if (state.done.every(Boolean) && !state.rewarded) {
    state.rewarded = true; const key = dayKey(), y = dayKey(new Date(Date.now() - 86400000));
    P.streak = { count: P.streak.last === y ? P.streak.count + 1 : 1, last: key }; finished = true;
  }
  save(); return finished;
}
export const goalsDone = () => { const { plan, state } = todaysDaily(); return plan.goals.filter((g) => (state.goals[g.id] || 0) >= g.target).length; };
export { STORY_LEVELS };
