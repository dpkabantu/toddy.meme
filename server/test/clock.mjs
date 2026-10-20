import assert from 'node:assert/strict';
import { nightKey, nightStartMs, nightEndMs, weekOfNight, validNightKey, shiftNight, lastNights } from '../clock.js';
import { bandPoints, RULES } from '../rules.js';
const t = (s) => Date.parse(s);
assert.equal(nightKey(t('2026-12-08T13:00:00Z')), '2026-12-08');      // exactly 18:30 India
assert.equal(nightKey(t('2026-12-08T12:59:59Z')), '2026-12-07');
assert.equal(nightKey(t('2026-12-09T12:59:59Z')), '2026-12-08');
assert.equal(nightKey(t('2026-12-09T13:00:00Z')), '2026-12-09');
assert.equal(nightKey(t('2026-12-31T20:00:00Z')), '2026-12-31'); assert.equal(nightKey(t('2027-01-01T05:00:00Z')), '2026-12-31');
assert.equal(nightStartMs('2026-12-08'), t('2026-12-08T13:00:00Z')); assert.equal(nightEndMs('2026-12-08'), t('2026-12-09T13:00:00Z'));
assert.equal(weekOfNight('2026-12-07'), '2026-W50'); assert.equal(weekOfNight('2026-12-13'), '2026-W50'); assert.equal(weekOfNight('2026-12-14'), '2026-W51');
assert.ok(validNightKey('2026-12-08') && !validNightKey('2026-02-30') && !validNightKey('x') && !validNightKey(5));
assert.equal(shiftNight('2026-12-01', -1), '2026-11-30'); assert.deepEqual(lastNights('2026-12-03', 3), ['2026-12-01', '2026-12-02', '2026-12-03']);
assert.deepEqual([0, 1, 2, 3].map(bandPoints), [8, 12, 16, 20]); assert.equal(bandPoints(9), 20); assert.equal(RULES.games.length, 3);
console.log('clock and rules ok');
