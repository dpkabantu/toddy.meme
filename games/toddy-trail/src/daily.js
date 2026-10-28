// TODDY Trail Daily Run: every player gets the same three levels and three goals on the same day (UTC date, so it needs no server).
import { mulberry, isBoss } from './levels.js';

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const dayNumber = (key) => Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);

// each goal counts from the plays of the day. info: { served, of, stars, boss, left (share of time left, 0..1) }
export const GOALS = {
  serve: { text: (n) => 'Serve ' + n + ' visitors', range: [14, 24], count: (i) => i.served },
  clear: { text: (n) => 'Clear ' + n + ' levels', range: [3, 5], count: (i) => (i.stars > 0 ? 1 : 0) },
  stars: { text: (n) => 'Earn ' + n + ' stars in today\'s plays', range: [6, 10], count: (i) => i.stars },
  clean: { text: (n) => 'Finish ' + n + (n === 1 ? ' level' : ' levels') + ' with 3 stars (no cup lost)', range: [1, 2], count: (i) => (i.stars === 3 ? 1 : 0) },
  fast: { text: (n) => 'Win ' + n + (n === 1 ? ' level' : ' levels') + ' with half the time left', range: [1, 2], count: (i) => (i.stars >= 2 && i.left >= 0.5 ? 1 : 0) },
  boss: { text: () => 'Clear a boss level (level 10 of a night)', range: [1, 1], count: (i) => (i.boss && i.stars > 0 ? 1 : 0) },
};

export function dailyPlan(key) {
  const rnd = mulberry(dayNumber(key) * 2654435761 + 12345);
  const jit = () => Math.floor(rnd() * 5) - 2;
  const levels = [12 + jit(), 34 + jit(), 56 + jit()].map((L) => (isBoss(L) ? L + 1 : L));   // an easier, a middle and a hard level, new ones every day
  const ids = Object.keys(GOALS).sort(() => rnd() - 0.5).slice(0, 3);
  const goals = ids.map((id) => { const [a, b] = GOALS[id].range; const target = a + Math.floor(rnd() * (b - a + 1)); return { id, target, text: GOALS[id].text(target) }; });
  return { key, salt: dayNumber(key), levels, goals };
}
