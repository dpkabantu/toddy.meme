// TODDY Trail ENDLESS MODE: the rules live here and nowhere else (v1, chosen by Claude on 2026-10-23, owner can change any number).
// Change a number or a function and the next endless run uses it. Nothing else needs touching.
// A run: 3 hearts. Serve at least 60% of the visitors before the lanterns go out and the level is cleared (everyone = Perfect, bonus).
// Below that you lose a heart and get a NEW layout of the same level. No hearts left = the run ends. Every 5th level is an easier
// breather (levels 5, 15, 25, ...), every 10th is a boss (harder layout, tighter time; clearing it gives a heart back).
const special = (n) => (n % 10 === 0 ? 'boss' : n % 10 === 5 ? 'breather' : null);
export const ENDLESS = {
  lives: 3, passShare: 0.6, perfectBonus: 200, special,
  startLevel: 1,
  // Where each difficulty button starts (the run then climbs from there: level n draws from band floor((n-1)/6)).
  artDrinks: 7,   // drink pictures available (5 painted + 2 temporary recolours until real art arrives)
  // The same five difficulties for the diagonal levels (drinks per level: 3, 4, 5, 6, 7). Straight-step levels use at most 5 pictures.
  difficulties: [{ name: 'Easy', level: 1 }, { name: 'Medium', level: 13 }, { name: 'Hard', level: 19 }, { name: 'Very hard', level: 26 }, { name: 'Highly difficult', level: 31 }],

  // Which difficulty band (0 = easiest .. 5 = hardest in the pool) a level number draws from.
  tierFor: (n) => { const t = Math.min(5, Math.floor((n - 1) / 6)), k = special(n); return k === 'boss' ? Math.min(5, t + 1) : k === 'breather' ? Math.max(0, t - 1) : t; },

  // Time limit = (the solver's best time for the layout) x this factor, never below minSeconds.
  // Lower factor = harder. A first-time phone player tends to need about 4x the best time; 2.4x is "hard" (Level 20 sample).
  timeFactor: (n) => { const f = Math.max(2.4, 4.5 - (n - 1) * 0.07), k = special(n); return k === 'boss' ? Math.max(2.2, f - 0.3) : k === 'breather' ? f + 1 : f; },
  minSeconds: 20,

  // When does a level count as passed? At least passShare of the visitors served. (st.served is an array of booleans.)
  passed: (st) => st.served.filter(Boolean).length >= Math.ceil(st.served.length * 0.6),

  // After a failed level you lose a heart and 'retry' gives a NEW random layout for the same level number.
  onFail: 'retry',

  // Which floors a run may use: 101..105 are the five new endless floors, 2..7 the story floors (1 = the café, which has no obstacle picture).
  themes: [101, 102, 103, 104, 105, 2, 3, 5, 6, 7],

  // Breathers and bosses are set by special() at the top of this file.
};
