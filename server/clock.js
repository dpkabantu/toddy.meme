// The TODDY night clock. A "night" starts at 13:00 UTC (18:30 India time) and lasts 24 hours.
// The night keyed 2026-12-08 runs from 8 Dec 13:00 UTC to 9 Dec 13:00 UTC. All three games use this one clock.
import { isoWeek } from './lib/util.js';

export const NIGHT_START_HOUR_UTC = 13;
const H = 3600000, DAY = 24 * H;

// Night key (YYYY-MM-DD) for a moment in time.
export function nightKey(ms) { return new Date(ms - NIGHT_START_HOUR_UTC * H).toISOString().slice(0, 10); }
export function nightStartMs(key) { return Date.parse(key + 'T00:00:00Z') + NIGHT_START_HOUR_UTC * H; }
export function nightEndMs(key) { return nightStartMs(key) + DAY; }
export function validNightKey(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(Date.parse(key + 'T00:00:00Z')) && new Date(Date.parse(key + 'T00:00:00Z')).toISOString().slice(0, 10) === key; }
// Season week of a night = ISO week of the night's own date (a week is Monday night to Sunday night).
export function weekOfNight(key) { return isoWeek(Date.parse(key + 'T12:00:00Z')); }
export function shiftNight(key, days) { return new Date(Date.parse(key + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10); }
// Last 7 nights ending at key (oldest first), for streak strips.
export function lastNights(key, n = 7) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(shiftNight(key, -i)); return out; }
