// Season 1 points rules. ONE versioned place; every point stored in the ledger carries RULES.version.
// All numbers are PLACEHOLDERS until the owner signs off the Season rules (Stage 8). Changing a number means a NEW version string.
export const RULES = {
  version: 's1-draft-2',
  versionNumber: 2,                   // the number stored in rule_versions
  nightMax: 20,                       // most one game can give for one night
  bandShare: [0.4, 0.6, 0.8, 1],      // share of nightMax for performance band 0..3
  weeklyCapPerGame: 140,              // most gameplay points one game can give per week (7 x 20)
  activeNight: 12,                    // once per night, for finishing any valid run
  allRounderWeek: 15,                 // 3 or more valid nights in EACH of the 3 games in a week
  allRounderNights: 3,
  consistency: { 5: 40, 7: 60 },      // nights played in a week -> bonus (highest reached only)
  games: ['moon-brew', 'full-moon', 'scam-lab'],
  seasonId: 'season-1',
  seasonMax: 10000,                   // most one person can hold in a season (all sources)
  rawDeleteAfter: '2027-05-29',       // move logs are deleted on this date (privacy)
  graceMs: 20 * 60000,                // a run started in a night may finish up to 20 minutes after it ends
  names: { 'moon-brew': 'Moon Brew', 'full-moon': 'Full Moon', 'scam-lab': 'Scam Lab' },
  bandNames: ['Played', 'Bronze', 'Silver', 'Gold'],
};
export const bandPoints = (band) => Math.round(RULES.nightMax * (RULES.bandShare[Math.max(0, Math.min(3, band | 0))] || 0));
