// Turns a short Daily Quickie entry (specs/daily-a.mjs, daily-b.mjs) into the case object the game and the server use.
import { chat, mail } from './author.mjs';

const STD_ACTIONS = [
  { id: 'go_ahead', label: 'Do what it asks' },
  { id: 'ignore', label: 'Ignore it' },
  { id: 'verify', label: 'Check in the official app or with the person' },
  { id: 'block_report', label: 'Block and report it' },
];
const defs = (c) => Object.fromEntries(Object.entries(c).map(([k, [label, s, lens, why]]) => [k, { label, strength: s === 's' ? 'strong' : 'harmless', lens, why }]));

// Markup for a clue that is not defined becomes plain text (names and subjects often prove nothing, so they need no clue).
const strip = (v, ids) => (typeof v === 'string' ? v.replace(/\{([a-z0-9_]+)\|([^|}]+)(?:\|[^}]*)?\}/g, (m, id, t) => (ids.has(id) ? m : t)) : Array.isArray(v) ? v.map((x) => strip(x, ids)) : v);

export function buildDaily(e0, checkedOn) {
  const ids = new Set(Object.keys(e0.clues));
  const e = { ...e0 };
  for (const k of ['name', 'sub', 'banner', 'from', 'addr', 'subject', 'time', 'items']) if (e[k] !== undefined) e[k] = strip(e[k], ids);
  if (e.av && e.av[1] && !ids.has(e.av[1])) e.av = [e.av[0]];
  const scam = !!e.scam;
  const screen = e.app === 'mail'
    ? { ...mail({ from: e.from, addr: e.addr, subject: e.subject, time: e.time, items: e.items }), ...(e.ctx ? { context: e.ctx } : {}) }
    : chat({ app: e.app, name: e.name, sub: e.sub, av: e.av, banner: e.banner, context: e.ctx, items: e.items });
  return {
    id: e.id, type: 'hunt', daily: true, template: e.id, title: `Daily Quickie · ${e.title}`, seconds: 90,
    disguise: scam ? (e.disguise || 'support') : null, intro: [],
    notify: { app: e.notify[0], from: e.notify[1], text: e.notify[2] }, screen, clues: defs(e.clues), actions: STD_ACTIONS,
    best_action: scam ? 'block_report' : 'go_ahead', acceptable_actions: scam ? ['verify', 'ignore'] : ['ignore', 'verify'],
    outcomes: scam ? {
      block_report: { scene: 'safe', mirage: 'panic', stamp: 'BLOCKED', line: 'Blocked and reported. That trick won’t reach anyone else today.', mirageSays: 'Not again!' },
      verify: { scene: 'safe', mirage: 'panic', stamp: 'CHECKED', line: 'Checking the real way showed it was fake.', mirageSays: 'They checked!' },
      ignore: { scene: 'safe', mirage: 'smug', stamp: 'SAFE', line: 'You stayed safe, but it’s still out there.', mirageSays: 'Next!' },
      go_ahead: { scene: 'drained', mirage: 'smug', stamp: 'TRICKED', line: e.lose || 'That one was a scam. In real life, the money would be gone.', mirageSays: 'Gotcha!' },
    } : {
      go_ahead: { scene: 'safe', mirage: null, stamp: 'GENUINE', line: 'It was genuine. Spotting the honest ones matters too.', toddy: 'happy' },
      ignore: { scene: 'safe', mirage: null, stamp: 'SAFE', line: 'It was genuine, so nothing bad happened.', toddy: 'happy' },
      verify: { scene: 'safe', mirage: null, stamp: 'CHECKED', line: 'You checked, and it was genuine. Careful and correct.', toddy: 'happy' },
      block_report: { scene: 'wolf', mirage: 'smug', stamp: 'FALSE ALARM', line: 'That one was honest. Crying wolf makes the real warnings easier to miss.', mirageSays: 'Trust nothing? I win anyway.' },
    },
    what_if: {}, golden_rule: e.rule, hints: { nudge: '', glow_order: [] },
    sources: e.sources || ['ftc-phishing', 'ftc-bank-call'], checked_on: checkedOn,
  };
}

// Problems with one built daily case: every placed clue defined, every defined clue placed, a sensible strong/harmless mix.
export function checkDaily(c) {
  const out = [];
  const placed = new Set([...JSON.stringify(c.screen).matchAll(/"clue":"([a-z0-9_]+)"/g)].map((m) => m[1]));
  for (const k of placed) if (!c.clues[k]) out.push(`${c.id}: placed clue "${k}" has no definition`);
  for (const k of Object.keys(c.clues)) if (!placed.has(k)) out.push(`${c.id}: clue "${k}" is defined but not placed`);
  const strong = Object.values(c.clues).filter((x) => x.strength === 'strong').length, harmless = Object.keys(c.clues).length - strong;
  if (c.disguise && (strong < 3 || harmless < 1)) out.push(`${c.id}: a scam needs 3+ strong clues and 1+ harmless (has ${strong}/${harmless})`);
  if (!c.disguise && (strong || harmless < 3)) out.push(`${c.id}: an honest case needs 0 strong and 3+ harmless (has ${strong}/${harmless})`);
  return out;
}
