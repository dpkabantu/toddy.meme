// Scam Lab rules: scoring, case checking, ranks and streaks.
// Pure functions (no DOM), so a server can later replay a move log and check a score.

export const MAX = { evidence: 400, decision: 300, quick: 200, speed: 100 };
export const HINT_COST = 50;
const DECOY_COST = 50;

export const strongClues = (c, seen) => Object.keys(c.clues || {}).filter((k) => c.clues[k].strength === 'strong' && (!seen || seen.includes(k)));
export const decoyClues = (c, seen) => Object.keys(c.clues || {}).filter((k) => c.clues[k].strength === 'harmless' && (!seen || seen.includes(k)));

function speedPart(seconds, full, zero, max) {
  const s = Math.max(0, seconds || 0);
  const f = s <= full ? 1 : s >= zero ? 0 : (zero - s) / (zero - full);
  return Math.round(max * f);
}

function evidencePart(c, marks, seen, max = MAX.evidence) {
  const strong = strongClues(c, seen);
  const decoys = decoyClues(c, seen);
  const found = strong.filter((k) => marks[k] === 'flag');
  const missed = strong.filter((k) => marks[k] !== 'flag');
  const falseAlarms = decoys.filter((k) => marks[k] === 'flag');
  const base = strong.length ? Math.round((max * found.length) / strong.length) : max;
  const cost = strong.length ? DECOY_COST : 100; // genuine cases: false alarms are the whole test
  return { evidence: Math.max(0, base - cost * falseAlarms.length), found, missed, falseAlarms };
}

function decisionPart(c, decision) {
  if (decision && decision === c.best_action) return { decision: MAX.decision, decisionKind: 'best' };
  if ((c.acceptable_actions || []).includes(decision)) return { decision: 200, decisionKind: 'acceptable' };
  return { decision: 0, decisionKind: 'unsafe' };
}

/** Story cases (hunt, compare, duel, boss).
 * log = { marks, decision, quickAnswer, seconds, hints, seen?, board? } */
export function scoreCase(c, log) {
  const ev = evidencePart(c, log.marks || {}, log.seen);
  const dc = decisionPart(c, log.decision);
  let quick = 0; let quickRight = false;
  if (c.board) {
    const b = log.board || {};
    const verdictRight = b.verdict === c.board.answer;
    const picks = (b.picks || []).slice(0, c.board.pick);
    const goodPicks = picks.filter((k) => c.clues[k] && c.clues[k].strength === 'strong').length;
    quick = (verdictRight ? 100 : 0) + Math.round((100 * goodPicks) / c.board.pick);
    quickRight = verdictRight && goodPicks === c.board.pick;
  } else {
    quickRight = !!c.quick_check && log.quickAnswer === c.quick_check.answer;
    quick = quickRight ? MAX.quick : 0;
  }
  const speed = dc.decisionKind === 'unsafe' ? 0 : speedPart(log.seconds, 90, 300, MAX.speed);
  const hintCost = HINT_COST * Math.max(0, log.hints || 0);
  const total = Math.max(0, ev.evidence + dc.decision + quick + speed - hintCost);
  let stars = 0;
  if (dc.decisionKind !== 'unsafe') stars = 1;
  if (stars && ev.missed.length === 0 && ev.falseAlarms.length === 0) stars = 2;
  if (stars === 2 && dc.decisionKind === 'best' && quickRight) stars = 3;
  return { total, ...ev, ...dc, quick, quickRight, speed, hintCost, stars };
}

/** Inbox Rush. answers = {cardId: 'scam'|'safe'}; secondsLeft at the end. */
export function scoreRush(c, answers, secondsLeft, quickAnswer) {
  const right = c.cards.filter((k) => answers[k.id] === (k.scam ? 'scam' : 'safe'));
  const falseAlarms = c.cards.filter((k) => !k.scam && answers[k.id] === 'scam');
  const missed = c.cards.filter((k) => k.scam && answers[k.id] !== 'scam');
  const accuracy = Math.round((700 * right.length) / c.cards.length);
  const allAnswered = c.cards.every((k) => answers[k.id]);
  const speed = allAnswered ? Math.round(100 * Math.max(0, Math.min(1, secondsLeft / c.seconds))) : 0;
  const quickRight = quickAnswer === c.quick_check.answer;
  const quick = quickRight ? 200 : 0;
  const n = right.length; const all = c.cards.length;
  const stars = n === all && quickRight ? 3 : n >= all - 2 ? 2 : n >= Math.ceil(all * 0.6) ? 1 : 0;
  return { total: accuracy + speed + quick, accuracy, speed, quick, quickRight, right: right.map((k) => k.id), falseAlarms: falseAlarms.map((k) => k.id), missed: missed.map((k) => k.id), stars };
}

/** Daily Case: timed, no hints, no quick check. Speed counts more. */
export function scoreDaily(c, log) {
  const ev = evidencePart(c, log.marks || {}, null);
  const dc = decisionPart(c, log.decision);
  const speed = dc.decisionKind === 'unsafe' ? 0 : speedPart(log.seconds, 30, c.seconds || 90, 300);
  const total = Math.max(0, ev.evidence + dc.decision + speed);
  let stars = dc.decisionKind === 'unsafe' ? 0 : 1;
  if (stars && !ev.missed.length && !ev.falseAlarms.length) stars = 2;
  if (stars === 2 && dc.decisionKind === 'best') stars = 3;
  return { total, ...ev, ...dc, speed, quick: 0, hintCost: 0, stars };
}

// ---------- ranks ----------
// 48 cases × 3 stars = 144. Night Guardian needs most of the game at 2–3 stars.
export const RANKS = [
  { id: 1, name: 'Rookie', stars: 0 },
  { id: 2, name: 'Sniffer', stars: 9 },
  { id: 3, name: 'Detective', stars: 30 },
  { id: 4, name: 'Scam Hunter', stars: 70 },
  { id: 5, name: 'Night Guardian', stars: 120 },
];
export function rankFor(stars) { return [...RANKS].reverse().find((r) => stars >= r.stars); }
export function nextRank(stars) { return RANKS.find((r) => r.stars > stars) || null; }

// ---------- daily streak: one missed day per 7 days is forgiven ----------
export function streak(dayNumbers, today) {
  const days = new Set(dayNumbers);
  let d = days.has(today) ? today : today - 1; // today not played yet doesn't break it
  let count = 0; let lastForgive = Infinity;
  while (true) {
    if (days.has(d)) { count += 1; d -= 1; continue; }
    if (count > 0 && days.has(d - 1) && lastForgive - d >= 7) { lastForgive = d; d -= 1; continue; }
    break;
  }
  return count;
}

// ---------- case checker ----------
const placed = (x, out = new Set()) => {
  if (Array.isArray(x)) x.forEach((y) => placed(y, out));
  else if (x && typeof x === 'object') { if (x.clue) out.add(x.clue); Object.values(x).forEach((y) => placed(y, out)); }
  return out;
};

/** Returns a list of problems; an empty list means the case is complete. */
export function checkCase(c) {
  const p = [];
  for (const k of ['id', 'type', 'title', 'golden_rule', 'sources']) if (c[k] == null) p.push(`missing ${k}`);
  if (!Array.isArray(c.sources) || !c.sources.length) p.push('no sources');
  if (c.type === 'rush') {
    if (!c.cards || c.cards.length < 5) p.push('rush needs at least 5 cards');
    else {
      if (!c.cards.some((k) => k.scam) || !c.cards.some((k) => !k.scam)) p.push('rush needs both scam and genuine cards');
      for (const k of c.cards) for (const f of ['id', 'from', 'text', 'why']) if (!k[f]) p.push(`card ${k.id}: missing ${f}`);
    }
    if (!c.quick_check || !c.quick_check.options.some((o) => o.id === c.quick_check.answer)) p.push('quick_check answer not among options');
    return p;
  }
  for (const k of ['clues', 'actions', 'best_action', 'outcomes', 'screen']) if (c[k] == null) p.push(`missing ${k}`);
  if (p.length) return p;
  for (const [k, v] of Object.entries(c.clues)) {
    for (const f of ['label', 'lens', 'why', 'strength']) if (!v[f]) p.push(`clue ${k}: missing ${f}`);
    if (!['strong', 'harmless'].includes(v.strength)) p.push(`clue ${k}: bad strength`);
  }
  const used = placed([c.screen, c.duel]);
  for (const k of Object.keys(c.clues)) if (!used.has(k)) p.push(`clue ${k}: not placed anywhere`);
  for (const k of used) if (!c.clues[k]) p.push(`placed clue ${k} has no definition`);
  const ids = c.actions.map((a) => a.id);
  if (!ids.includes(c.best_action)) p.push('best_action not in actions');
  for (const a of c.acceptable_actions || []) if (!ids.includes(a)) p.push(`acceptable ${a} not in actions`);
  const endings = new Set(c.actions.filter((a) => !a.goto).map((a) => a.id));
  if (c.duel) {
    const nodes = c.duel.nodes;
    if (!nodes[c.duel.start]) p.push('duel start node missing');
    for (const [nid, n] of Object.entries(nodes)) {
      if (!n.replies || !n.replies.length) p.push(`node ${nid}: no replies`);
      for (const r of n.replies || []) {
        if (r.next && !nodes[r.next]) p.push(`node ${nid}: reply goes to missing node ${r.next}`);
        if (r.end) { endings.add(r.end); if (!ids.includes(r.end)) p.push(`node ${nid}: ending ${r.end} is not an action`); }
        if (!r.next && !r.end) p.push(`node ${nid}: reply leads nowhere`);
      }
    }
    // every node reachable and every path ends
    const seen = new Set(); const stack = [c.duel.start];
    while (stack.length) { const id = stack.pop(); if (seen.has(id) || !nodes[id]) continue; seen.add(id); nodes[id].replies.forEach((r) => r.next && stack.push(r.next)); }
    for (const nid of Object.keys(nodes)) if (!seen.has(nid)) p.push(`node ${nid}: unreachable`);
  }
  for (const a of c.actions) if (a.goto === 'duel' && !c.duel) p.push(`action ${a.id}: goes to a chat that doesn't exist`);
  for (const e of endings) if (!c.outcomes[e]) p.push(`ending ${e}: no outcome (never reaches a debrief)`);
  if (c.board) {
    if (!c.board.verdicts.some((v) => v.id === c.board.answer)) p.push('board answer not among verdicts');
    if (strongClues(c).length < c.board.pick) p.push('board asks for more picks than strong clues');
  } else if (!c.daily && (!c.quick_check || !c.quick_check.options.some((o) => o.id === c.quick_check.answer))) p.push('quick_check answer not among options');
  return p;
}

export function caseWarnings(c) { return c.checked_on ? [] : [`${c.id}: sources not yet verified${c.check_note ? ` (${c.check_note})` : ''}`]; }
