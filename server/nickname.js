// Nicknames are what other players see. 3-16 letters, digits, spaces, "_" or "-"; no links, no blocked words.
// The word list below is a SMALL STARTER: the owner should review and extend it before launch.
const BLOCKED = ['admin', 'toddy', 'moderator', 'support', 'official', 'fuck', 'shit', 'bitch', 'cunt', 'nazi', 'porn', 'sex', 'rape', 'scam', 'wallet', 'airdrop', 'seed phrase', 'giveaway'];
export function cleanNickname(raw) {
  const n = String(raw || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 16) return { error: 'Use 3 to 16 characters.' };
  if (!/^[\p{L}\p{N} _-]+$/u.test(n)) return { error: 'Letters, numbers, spaces, _ and - only.' };
  const flat = n.toLowerCase().replace(/[0-9]/g, d => 'oizeasgtbg'[d]).replace(/[ _-]/g, '');
  if (BLOCKED.some(w => flat.includes(w.replace(/ /g, '')))) return { error: 'Please pick a different nickname.' };
  if (/https?|www|\.com|\.meme/i.test(n)) return { error: 'No links in nicknames.' };
  return { nickname: n, key: n.toLowerCase() };
}
