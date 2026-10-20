// Scam Lab authoring helper. Cases are written in a compact form (see specs/*.mjs) and built into the full case files the game loads.
// Markup inside text: {clue|text} marks a clue; {clue|text|link} a link; {clue|text|count:600} a countdown.
// Nothing here runs in the browser. `node tools/scam-lab/build.mjs` runs it.

export function rt(s) {
  if (Array.isArray(s)) return s;
  const out = []; const re = /\{([a-z0-9_]+)\|([^|}]+)(?:\|([^}]*))?\}/g; let i = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push(s.slice(i, m.index));
    const o = { clue: m[1], text: m[2] };
    if (m[3] === 'link') o.link = true; else if (m[3] && m[3].startsWith('count:')) o.countdown = +m[3].slice(6);
    out.push(o); i = re.lastIndex;
  }
  if (i < s.length) out.push(s.slice(i));
  return out;
}

// "t: 2:14 AM" | "m: message" | "me: my reply" | "p: paragraph" | "foot: footer" | "sys: system line"
export function item(s) {
  const k = s.indexOf(':'); const tag = s.slice(0, k).trim(), body = s.slice(k + 1).trim();
  if (tag === 't') return { time: rt(body) };
  if (tag === 'm') return { msg: rt(body) };
  if (tag === 'me') return { from: 'me', msg: rt(body) };
  if (tag === 'p') return { p: rt(body) };
  if (tag === 'foot') return { foot: rt(body) };
  if (tag === 'sys') return { sys: rt(body) };
  throw new Error('unknown item tag ' + tag);
}
export const items = (a) => a.map(item);

const avatar = (a) => (a ? (Array.isArray(a) ? { glyph: a[0], ...(a[1] ? { clue: a[1] } : {}) } : a) : undefined);

// A chat screen (app 'chirp' = social/chat app, 'sms' = text messages)
export function chat({ app = 'chirp', name, sub, av, banner, context, items: its = [] }) {
  const s = { app, head: { name: rt(name), ...(sub ? { sub: rt(sub) } : {}), ...(av ? { avatar: avatar(av) } : {}) } };
  if (banner) s.banner = Array.isArray(banner) ? banner.map(rt).flat() : rt(banner);
  if (context) s.context = context;
  s.items = items(its);
  return s;
}
export function mail({ from, addr, subject, time = '9:12 AM', items: its }) {
  return { app: 'mail', head: { from: rt(from), addr: rt(addr), subject: rt(subject), time: rt(time) }, items: items(its) };
}
export function compare({ context, panels }) {
  return { app: 'compare', context, panels: panels.map((p) => ({ label: p.label, avatar: avatar(p.av), rows: p.rows.map(([k, v]) => ({ k, v: rt(v) })), ...(p.note ? { note: rt(p.note) } : {}) })) };
}

const STYLE = { win: ['safe', 'panic'], meh: ['safe', 'smug'], bad: ['drained', 'smug'], wolf: ['wolf', 'smug'], gen: ['safe', null] };
function outcomes(out) {
  const o = {};
  for (const [id, [style, stamp, line, says]] of Object.entries(out)) {
    const [scene, mirage] = STYLE[style]; o[id] = { scene, mirage, stamp, line };
    if (style === 'gen') o[id].toddy = 'happy'; else if (says) o[id].mirageSays = says;
  }
  return o;
}
const clueDefs = (c) => Object.fromEntries(Object.entries(c).map(([k, [label, s, lens, why]]) => [k, { label, strength: s === 's' ? 'strong' : 'harmless', lens, why }]));
const quick = ([q, opts, answer, explain]) => ({ q, options: opts.map((t, i) => ({ id: 'abcd'[i], text: t })), answer, explain });
const kit = (k) => k.map(([id, icon, label, title, rows]) => ({ id, icon, label, title, rows: rows.map(([kk, v, clue]) => ({ k: kk, v, ...(clue ? { clue } : {}) })) }));

export const wallet = ({ site, title, context, rows, note, buttons = ['Reject', 'Approve'] }) => ({ app: 'wallet', site: rt(site), title, context, rows: rows.map(([k, v]) => ({ k, v: rt(v) })), note: rt(note), buttons });

const TAP = 'Tap anything that looks odd to sniff it closer. Pin what is suspicious, clear what is harmless.';
const kitFrom = (k) => (Array.isArray(k) ? k : [
  ...(k.who ? [['profile', '🔍', k.who[0], k.who[1], k.who[2]]] : []),
  ...(k.link ? [['link', '🔗', k.link[0], k.link[1], k.link[2]]] : []),
  ...(k.adv ? [['source', '📖', 'Official advice', k.adv[0], k.adv[1]]] : []),
]);
// Fills in the standard actions, outcomes, what-ifs and hints so a case only needs its own words.
function expand(s) {
  if (s.type === 'rush') {
    return { ...s, intro: typeof s.intro === 'string' ? [s.intro, 'Swipe left if it is a scam, right if it is safe. Or tap the buttons.', 'Careful: some are honest. Do not cry wolf.'] : s.intro };
  }
  const o = { ...s };
  const duel = s.type === 'duel' || s.type === 'boss';
  if (typeof s.intro === 'string') o.intro = s.honest ? [s.intro, 'But some messages are real. Mirage loves it when you stop trusting the honest ones.', 'Sniff carefully. Then decide.'] : duel ? [s.intro, 'This time you can talk back. Pick your replies and sniff each message as it arrives.', 'Every chat ends with your choice. Choose wisely.'] : [s.intro, TAP, 'When you are sure, decide what to do.'];
  if (!s.actions && s.go) {
    if (s.honest) {
      o.actions = [['go_ahead', s.go], ['ignore', 'Ignore it'], ['block_report', 'Report it as a scam']]; o.best = 'go_ahead'; o.ok = ['ignore'];
      o.out = { go_ahead: ['gen', 'GENUINE', s.good], ignore: ['meh', 'SAFE', s.ignored || 'Nothing bad happened. It was a real message, and you stayed careful.', 'Fine. Next!'], block_report: ['wolf', 'FALSE ALARM', s.falseAlarm || 'That was a real message. When every message looks like a scam, the real ones get lost too.', 'If you trust nothing, I win anyway.'], ...s.out };
      o.whatif = { block_report: s.calm, ignore: 'Ignoring was safe. Recognising a real message is the skill: it asks for nothing secret and matches something you know.', ...s.whatif };
      o.hints = ['What is this message actually asking you to do?', []];
    } else {
      const noIgnore = duel || s.noIgnore;
      o.actions = [['go_ahead', s.go, !!s.trap && !duel], ...(noIgnore ? [] : [['ignore', 'Ignore it']]), ['verify', s.verify || 'Check it myself, on the official site or app'], ['block_report', s.report || 'Report it and delete it']];
      o.best = 'block_report'; o.ok = noIgnore ? ['verify'] : ['verify', 'ignore'];
      o.out = { block_report: ['win', s.stamp || 'REPORTED', s.win, s.winSays || 'Not my lovely scam!'], verify: ['win', 'CHECKED', s.checked, 'Hmph. They checked.'], ...(noIgnore ? {} : { ignore: ['meh', 'SAFE', s.ignored || 'You stayed safe. But the same scam is still landing on other people.', 'Fine. Next!'] }), go_ahead: ['bad', 'SCAMMED', s.lose, s.loseSays || 'Thanks for the details!'], ...s.out };
      o.whatif = { go_ahead: s.avoid, ...(noIgnore ? {} : { ignore: 'Reporting takes two taps and helps protect other people.' }), verify: 'Checking was smart. Reporting it as well helps protect other people.', ...s.whatif };
      if (!s.hints) o.hints = [s.nudge || 'Who is this from, and what do they want you to do?', Object.entries(s.clues).filter(([, v]) => v[1] === 's').map(([k]) => k)];
    }
  }
  if (s.kit) o.kit = kitFrom(s.kit);
  return o;
}

export function build(spec0) {
  const spec = expand(spec0);
  const c = { id: spec.id, type: spec.type, chapter: spec.chapter, difficulty: spec.diff || 2, title: spec.title };
  if (spec.type === 'rush') {
    c.seconds = spec.seconds || 60; c.intro = spec.intro;
    c.cards = spec.cards.map(([id, app, from, text, scam, why]) => ({ id, app, from, text, scam, why }));
    c.golden_rule = spec.rule; c.quick_check = quick(spec.quick); c.sources = spec.sources; c.checked_on = spec.checked_on;
    return c;
  }
  c.disguise = spec.honest ? null : (spec.disguise || 'support');
  if (spec.disguise2) c.disguise2 = spec.disguise2;
  c.intro = spec.intro; c.notify = { app: spec.notify[0], from: spec.notify[1], text: spec.notify[2] };
  if (spec.decide_q) c.decide_q = spec.decide_q;
  c.screen = spec.screen;
  if (spec.duel) {
    const nodes = {};
    for (const [nid, n] of Object.entries(spec.duel.nodes)) {
      nodes[nid] = { ...(n.rename ? { rename: n.rename } : {}), ...(n.disguise ? { disguise: n.disguise } : {}), say: items(n.say), replies: n.replies.map(([text, to]) => (to.startsWith('!') ? { text, end: to.slice(1) } : { text, next: to })) };
    }
    c.duel = { start: spec.duel.start || 'n1', nodes };
  }
  c.clues = clueDefs(spec.clues);
  c.actions = spec.actions.map((a) => (Array.isArray(a) ? { id: a[0], label: a[1], ...(a[2] ? { trap: true } : {}) } : a));
  c.best_action = spec.best; c.acceptable_actions = spec.ok || [];
  if (spec.trap) { const [title, url, ask, go, back] = spec.trap; c.trap = { title, url, ask, go, back }; }
  c.outcomes = outcomes(spec.out);
  c.what_if = spec.whatif || {};
  c.golden_rule = spec.rule; if (spec.board) c.board = spec.board; else c.quick_check = quick(spec.quick);
  c.hints = { nudge: spec.hints[0], glow_order: spec.hints[1] };
  c.sources = spec.sources; c.checked_on = spec.checked_on;
  if (spec.kit) c.kit = kit(spec.kit);
  return c;
}
