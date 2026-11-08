// What Moon Brew keeps in an account, and how a device and the account are merged. Pure functions, no browser needed.
// Rule: merging never makes anything worse (stars and scores only go up, days played are only added).
// Settings (sound, calm, look...) stay on the device. Daily run logs stay on the device too (they are big).
export function toSynced(save) {
  const daily = {};
  for (const [k, v] of Object.entries(save.daily || {})) daily[k] = { stars: v.stars, time: v.time, bumps: v.bumps, score: v.score };
  return { stars: { ...(save.stars || {}) }, daily, endlessBest: save.endlessBest || 0, postcards: [...(save.postcards || [])], intros: { ...(save.intros || {}) } };
}
export function merge(local, remote) {
  const r = remote && typeof remote === 'object' ? remote : {};
  const stars = { ...(local.stars || {}) };
  for (const [k, v] of Object.entries(r.stars || {})) if (Number.isFinite(v) && v > (stars[k] || 0)) stars[k] = v;
  const daily = { ...(local.daily || {}) };
  for (const [k, v] of Object.entries(r.daily || {})) if (!daily[k] || (v && v.score > (daily[k].score || 0))) daily[k] = daily[k] && daily[k].log ? daily[k] : v;
  const intros = { ...(local.intros || {}) };
  for (const [k, v] of Object.entries(r.intros || {})) if (v) intros[k] = 1;
  const postcards = [...new Set([...(local.postcards || []), ...(Array.isArray(r.postcards) ? r.postcards : [])])];
  return { stars, daily, endlessBest: Math.max(local.endlessBest || 0, Number(r.endlessBest) || 0), postcards, intros };
}
// true when `a` holds something `b` lacks (so the account needs a fresh save)
export function differs(a, b) { return JSON.stringify(sortKeys(toSyncedLike(a))) !== JSON.stringify(sortKeys(toSyncedLike(b))); }
function toSyncedLike(x) { return { stars: x.stars || {}, daily: Object.fromEntries(Object.entries(x.daily || {}).map(([k, v]) => [k, v && v.score])), endlessBest: x.endlessBest || 0, postcards: [...(x.postcards || [])].sort(), intros: x.intros || {} }; }
function sortKeys(o) { return Array.isArray(o) ? o.map(sortKeys) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])])) : o; }
