// TODDY Trail ENDLESS MODE: the rules live here and nowhere else. EVERY value below is a PLACEHOLDER, so the platform runs,
// but none of it is decided. Change a number or a function and the next endless run uses it. Nothing else needs touching.
export const ENDLESS = {
  startLevel: 1,

  // Which difficulty band (0 = easiest .. 5 = hardest in the pool) a level number draws from.
  tierFor: (n) => Math.min(5, Math.floor((n - 1) / 6)),

  // Time limit = (the solver's best time for the layout) x this factor, never below minSeconds.
  // Lower factor = harder. A first-time phone player tends to need about 4x the best time; 2.4x is "hard" (Level 20 sample).
  timeFactor: (n) => Math.max(2.4, 4.5 - (n - 1) * 0.07),
  minSeconds: 20,

  // When does a level count as passed? Placeholder: serve everyone, like the story nights. (st.served is an array of booleans.)
  passed: (st) => st.won,

  // After a failed level: 'retry' gives a NEW random layout for the same level number; 'end' ends the run.
  onFail: 'retry',

  // Which floors a run may use: 101..105 are the five new endless floors, 2..7 the story floors (1 = the café, which has no obstacle picture).
  themes: [101, 102, 103, 104, 105, 2, 3, 5, 6, 7],

  // Special levels, e.g. { every: 5, ... }. Not used yet: no breathers, no bosses.
  breather: null,
  boss: null,
};
