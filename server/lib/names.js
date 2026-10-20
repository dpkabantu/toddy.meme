// Usernames and Passport IDs.

// Rules (owner delegated the choice, 2026-10-20): 3 to 20 characters, letters, digits and underscore, at least one letter.
// Same name check ignores capitals, underscores and the look-alikes i/l/1, 0/o and 5/s, so nobody can copy a name with a tiny change.
const LOOKALIKE = { 0: 'o', 1: 'l', i: 'l', 5: 's' };
export function nameKey(display) {
  return display.toLowerCase().replace(/_/g, '').replace(/[01i5]/g, (c) => LOOKALIKE[c]);
}
const RESERVED_EXACT = new Set(['toddy', 'admin', 'administrator', 'moderator', 'support', 'staff', 'official', 'system', 'team', 'root', 'null', 'undefined', 'guest', 'anonymous'].map(nameKey));
const RESERVED_PREFIX = ['admin', 'moderator', 'official', 'staff', 'support', 'toddyteam', 'toddyofficial', 'toddyadmin', 'toddysupport', 'toddystaff'].map(nameKey);
// A short starter list of unacceptable words. It is reviewed by a person before public launch; the admin rename tool arrives in Stage 5.
const BLOCKED = ['nazi', 'hitler', 'fuck', 'shit', 'cunt', 'nigg', 'fagg', 'rape', 'porn'].map(nameKey);

export function checkUsername(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'username_invalid' };
  const display = raw.trim();
  if (display.length < 3 || display.length > 20) return { ok: false, error: 'username_length' };
  if (!/^[A-Za-z0-9_]+$/.test(display)) return { ok: false, error: 'username_characters' };
  if (!/[A-Za-z]/.test(display) || display.startsWith('_') || display.endsWith('_')) return { ok: false, error: 'username_shape' };
  const key = nameKey(display);
  if (RESERVED_EXACT.has(key) || RESERVED_PREFIX.some((p) => key.startsWith(p)) || BLOCKED.some((w) => key.includes(w))) return { ok: false, error: 'username_not_allowed' };
  return { ok: true, display, key };
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';     // no I, L, O, U: nothing that looks alike
export function newPassportId() {
  const b = crypto.getRandomValues(new Uint8Array(8)); let s = '';
  for (const x of b) s += ALPHABET[x % 32];
  return 'TDY-' + s;
}
export function newReferralCode() {
  const b = crypto.getRandomValues(new Uint8Array(8)); let s = '';
  for (const x of b) s += ALPHABET[x % 32];
  return s;
}
