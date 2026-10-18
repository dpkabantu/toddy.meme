// Progress saved on this device only (browser storage). Nothing is sent anywhere.
const KEY = 'toddy.scamlab.v2';
const fresh = () => ({ settings: { sound: true, music: true, calm: false, big: false }, stars: {}, best: {}, rules: [], daily: {}, howto: false });

let data = fresh();
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  if (raw && typeof raw === 'object') data = { ...fresh(), ...raw, settings: { ...fresh().settings, ...(raw.settings || {}) } };
} catch (e) { /* storage blocked or empty: play still works, it just won't be remembered */ }

function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }

export const store = {
  get settings() { return data.settings; },
  set(key, value) { data.settings[key] = value; persist(); },
  stars(id) { return data.stars[id] || 0; },
  best(id) { return data.best[id] || 0; },
  totalStars() { return Object.values(data.stars).reduce((a, b) => a + b, 0); },
  played(id) { return id in data.stars; },
  record(id, stars, score) {
    data.stars[id] = Math.max(data.stars[id] || 0, stars);
    data.best[id] = Math.max(data.best[id] || 0, score);
    persist();
  },
  /** Collect a Golden Rule card. Returns true the first time. */
  addRule(id, text, from) {
    if (!text || data.rules.some((r) => r.text === text)) return false;
    data.rules.push({ id, text, from }); persist(); return true;
  },
  rules() { return data.rules.filter((r) => r && r.text); },
  daily(key) { return data.daily[key] || null; },
  recordDaily(key, score, stars) { if (!data.daily[key]) { data.daily[key] = { score, stars }; persist(); return true; } return false; },
  dailyKeys() { return Object.keys(data.daily); },
  get howto() { return data.howto; },
  set howto(v) { data.howto = v; persist(); },
  reset() { const s = data.settings; data = fresh(); data.settings = s; persist(); },
};
