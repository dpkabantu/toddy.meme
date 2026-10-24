// TODDY: Moon Brew — Nights, trays, visitors and story lines.
import { rng, makeMask } from './core.js';
import { PACE, TIER } from './pace.js';

export const TRAYS_PER_NIGHT = 20;

export const NIGHTS = [
  {
    id: 'n1', name: 'Night 1', title: 'The Moon Watcher', visitor: 'milo', visitorName: 'Milo the owl', finale: 'cup',
    lines: [
      'Hoo… one small cup, Toddy. The moon is bright tonight.',
      'Milo settles on the counter and polishes his glasses.',
      'Milo: "Light first, then dark. My feathers like it that way."',
      'Milo taps the counter twice. "Same as last night?"',
      'Milo: "The moon rises a little later each night. Did you know?"',
      'Milo watches the window. "A cloud. No, just my glasses."',
      'Milo: "Your grinder sounds like a happy cricket."',
      'A bean in the corner is fast asleep. Milo chuckles.',
      'Milo: "Even beans get tired on the night shift."',
      'Milo counts the stars out loud and loses his place.',
      'Milo: "The brew tastes better when the moon is full."',
      'Milo dozes off waiting. Brew it before he snores.',
      'Milo wakes with a hoot. "Was I asleep? I was resting my eyes."',
      'Milo: "Three nights until the full moon, Toddy."',
      'Milo: "Two nights now. The sky is getting brighter."',
      'Milo leans close to the tray. "That one is stuck. Careful."',
      'Milo: "One night left. I have watched every moon for years."',
      'Milo fluffs his feathers. "The big night is almost here."',
      'Milo: "Tomorrow is the full moon. I will not sleep a wink."',
      'The full moon rises. Milo lifts his cup to the window.',
    ],
  },
  {
    id: 'n2', name: 'Night 2', title: 'The Sleepy Moth', visitor: 'moth', visitorName: 'The sleepy moth', finale: 'moon',
    lines: [
      'A moth circles the lamp. It wants something warm.',
      'The moth lands on the menu, right on "Moon Brew".',
      'Moth: "Mmm… is it morning? No? Good."',
      'The moth yawns so wide its antennae wobble.',
      'Moth: "The lamp is cozy. Your brew is cozier."',
      'Somebody left the ice tray out. The beans are chilly.',
      'Moth: "I fly all night. I need a little help to stay awake."',
      'The moth naps on the lamp shade. Its wings glow in the light.',
      'Moth: "Ice melts faster when you are busy. Like worries."',
      'Sugar cubes stick two beans together. Sweet, but heavy.',
      'Moth: "Two beans, one roll. Teamwork."',
      'The moth brought a friend. The friend is also asleep.',
      'Moth: "My grandmother loved this café. She said the brew glowed."',
      'The lamp flickers. The moth holds on tight.',
      'Moth: "One more cup and I could fly to the moon."',
      'Moth: "Do not tell Milo. I sleep through his moon talks."',
      'Rain taps the window. The moth stays inside tonight.',
      'Moth: "The sugar makes my wings feel lighter."',
      'The moth is wide awake now and humming.',
      'Moon Brew time. The moth sips from the lamp shade.',
    ],
  },
  {
    id: 'n3', name: 'Night 3', title: 'The Lost Star', visitor: 'star', visitorName: 'The lost star', finale: 'star',
    lines: [
      'A tiny star drifts through the door, glowing softly.',
      'Star: "I fell. I need to get home before sunrise."',
      'Spilled milk swirls on the tray. Beans turn when they roll over it.',
      'Star: "Your brew makes me shine brighter. Just a little."',
      'Star: "Up there, I am the third one from the moon."',
      'The star flickers. It needs a strong brew to shine.',
      'Star: "Milo told me about you. He said you never give up."',
      'Star: "The moth says hello. It is asleep again."',
      'The clock ticks louder. The star waits by the window.',
      'Star: "I can see my spot in the sky. It looks empty."',
      'Star: "Every cup gets me a little higher off the floor."',
      'The star glows so bright the lantern looks dim.',
      'Star: "Five hours to sunrise. We can do this."',
      'Star: "Four hours. Your paws are very fast."',
      'Star: "Three hours. The sky is turning purple."',
      'Star: "Two hours. I am floating now. Look!"',
      'Star: "One hour. Will you remember me?"',
      'Star: "I will shine over your café every night."',
      'The first birds wake up. One last cup.',
      'Last order before sunrise. Brew it perfect.',
    ],
  },
];

// ---------------- Endless Nights (Night 4 and on) ----------------
// Every visitor: how the game names them, and a bank of 30 lines (3 arrivals, 24 for the middle trays, 3 goodbyes).
// A Night uses 20 of them: the arrival on tray 1, 18 from the middle bank (a fixed shuffle, so every player
// reads the same Night), a goodbye on tray 20. Places, names and money are European.
export const VISITORS = {
  milo: { name: 'Milo the owl', short: 'Milo' },
  moth: { name: 'The sleepy moth', short: 'The moth' },
  star: { name: 'The lost star', short: 'The star' },
  pip: { name: 'Pip the postman', short: 'Pip' },
  lumi: { name: 'Lumi the firefly', short: 'Lumi' },
  velvet: { name: 'Velvet the bat', short: 'Velvet' },
  inkwell: { name: 'Professor Inkwell', short: 'The professor' },
  biscuit: { name: 'Biscuit the baker', short: 'Biscuit' },
};
export const VISITOR_ORDER = ['milo', 'moth', 'star', 'pip', 'lumi', 'velvet', 'inkwell', 'biscuit'];
const NEW_VISITORS = ['pip', 'lumi', 'velvet', 'inkwell', 'biscuit']; // the visitors of Night 4, 5, 6, 7, 8, then round again

const BANK = {
  pip: {
    arrive: [
      'Pip the postman shuffles in, hat first. One letter, one coffee.',
      'Pip\u2019s satchel jingles. "Special delivery, Toddy. And a coffee."',
      'A tiny postman knocks. His hat says: night shift, like yours.',
    ],
    mid: [
      'Pip: "This letter has a crescent seal. Mysterious, no?"',
      'Pip: "I walked from Lisbon tonight. Only a little lost."',
      'Pip sorts letters by smell. Coffee goes first.',
      'Pip: "Return to sender? Never. I always find the café."',
      'Pip: "Seven letters, six addresses, one very warm cup."',
      'Pip\u2019s hat slides over his eyes. He keeps sorting.',
      'Pip: "A letter from Vienna smells like cinnamon."',
      'Pip: "I deliver to owls, moths and one grumpy cloud."',
      'Pip stamps a letter with his paw. Perfect aim.',
      'Pip: "My spines are for show. I am very soft."',
      'Pip: "Stamps are tiny moons. I collect them all."',
      'A letter slips from the satchel. Pip catches it with his nose.',
      'Pip: "Porto to Prague in one night. Coffee helps."',
      'Pip: "No password by message. Only mail. Honest."',
      'Pip: "Your café is on no map. I follow the smell."',
      'Pip hums a postman\u2019s tune. It has exactly three notes.',
      'Pip: "Rain on the route tonight. Letters stay dry in my hat."',
      'Pip: "Who writes to a moon? I deliver, I do not ask."',
      'Pip checks his watch. It runs on moonlight.',
      'Pip: "Mail never sleeps. I do, on the second shelf."',
      'Pip: "Signed, sealed, delivered. Best part of the night."',
      'Pip tips his hat to every bean that rolls by.',
      'Pip: "Ghent, Bruges, Antwerp. Waffles on every route."',
      'Pip: "One more tray and the sorting is done!"',
    ],
    last: [
      'Pip salutes. "Last letter delivered. It was addressed to you."',
      'Pip: "Final stop, Toddy. Your cup is the best address."',
      'Pip hands you a sealed envelope. Open it after the brew.',
    ],
  },
  lumi: {
    arrive: [
      'A soft glow bobs through the door. Lumi the firefly, shivering.',
      'Lumi: "Is this the café with warm cups? My light is low."',
      'Lumi lands on the lamp. Two lights, one very sleepy.',
    ],
    mid: [
      'Lumi: "My scarf is from a snowy night in Tallinn."',
      'Lumi glows brighter with every bean. Just a little.',
      'Lumi: "I light up fields. Tonight I light up your café."',
      'Lumi hides behind her scarf. "Is it okay to glow here?"',
      'Lumi: "The stars blink slowly. I blink fast. Hi."',
      'Lumi: "Warm coffee is how I charge my light."',
      'Lumi drifts over the tray and lights up the corners.',
      'Lumi: "I once lit a whole meadow in Tuscany."',
      'A little glow dances. Lumi is humming.',
      'Lumi: "Do not blow on me! I flicker."',
      'Lumi: "Fireflies never get lost. We just wander brightly."',
      'Lumi\u2019s light matches the lamp. Cosy.',
      'Lumi: "Tell Milo I said hello. He knows my glow."',
      'Lumi: "Slow beans, slow nights. I love them."',
      'Lumi: "My wings hum in C major. Listen!"',
      'Lumi lands on Toddy\u2019s tail. It is very comfy.',
      'Lumi: "The moon is jealous of my light. Shh."',
      'Lumi: "I counted forty stars on the way here."',
      'Lumi: "Is the cup ready? My glow is flickering."',
      'Lumi lights the way for the next bean.',
      'Lumi: "Warm cup, warm light. Best night in weeks."',
      'Lumi: "Everyone shines a little brighter with coffee."',
      'Lumi: "The meadow is quiet. This café is better."',
      'Lumi does a tiny loop-the-loop. Show-off.',
    ],
    last: [
      'Lumi glows gold. "Thank you, Toddy. I can fly home now."',
      'Lumi: "Last cup of the night. Make it shine!"',
      'Lumi leaves a trail of light on the counter. Goodnight.',
    ],
  },
  velvet: {
    arrive: [
      'Velvet swoops in, bow tie perfectly straight. "Good evening, Toddy."',
      'Velvet hangs from the lamp. "Upside down is my best angle."',
      'A bat with a red bow tie orders a very dark roast.',
    ],
    mid: [
      'Velvet: "I fly home to Transylvania at dawn. Slow coffee first."',
      'Velvet: "Darkness is my favourite roast."',
      'Velvet adjusts his bow tie. It was already straight.',
      'Velvet: "Everyone thinks bats are scary. We love tea parties."',
      'Velvet: "I navigate by echoes. Your grinder echoes nicely."',
      'Velvet hangs upside down. The beans look rather odd that way.',
      'Velvet: "Please, no garlic. And no sudden lights."',
      'Velvet: "Midnight is a very good hour."',
      'Velvet: "I once met a count. He did not tip."',
      'Velvet\u2019s ears twitch at every roll.',
      'Velvet: "One squeak means yes. Two means more coffee."',
      'Velvet: "A bat in a café. Quite the plot twist."',
      'Velvet: "My cave in Romania has no Wi-Fi. Bliss."',
      'Velvet folds his wings like a cape. Very theatrical.',
      'Velvet: "I read the stars by ear. They hum tonight."',
      'Velvet: "The moth is my cousin. We do not talk about it."',
      'Velvet: "Beans roll in the dark. I hear every one."',
      'Velvet: "Cosy cafés are better than caves. Slightly."',
      'Velvet yawns, showing very small, very polite fangs.',
      'Velvet: "Almost dawn. I feel it in my wings."',
      'Velvet: "Good brew. Serious brew. Bat-approved brew."',
      'Velvet flaps once. A napkin flies away. Oops.',
      'Velvet: "I would hang here all night. May I?"',
      'Velvet: "Nobody tips a bat in beans. I tip in squeaks."',
    ],
    last: [
      'Velvet bows deeply. "A magnificent brew. Until next midnight."',
      'Velvet: "The last cup of the night. I shall savour it."',
      'Velvet: "Dawn is coming. One more sip, then home."',
    ],
  },
  inkwell: {
    arrive: [
      'Professor Inkwell arrives. He left Vienna on Tuesday. It is Friday.',
      'A snail with a monocle clears his throat. Slowly. Very slowly.',
      'Professor Inkwell opens his book. "Chapter one: the perfect cup."',
    ],
    mid: [
      'Inkwell: "I am writing a book. Cafés of Europe, volume nine."',
      'Inkwell: "Speed is overrated. Flavour takes time."',
      'Inkwell adjusts his monocle. It fogs up from the steam.',
      'Inkwell: "Per page, one coffee stain. Per chapter, a smile."',
      'Inkwell: "I crossed the Alps for a cup like this."',
      'Inkwell: "Rome in spring, Prague in fog. This café, always."',
      'Inkwell: "Kindly do not rush the beans. They have feelings."',
      'Inkwell turns a page. The page turns itself back.',
      'Inkwell: "My shell is a library. Ask me anything."',
      'Inkwell: "A question: do beans dream of being coffee?"',
      'Inkwell: "I once spent a week on a single sip."',
      'Inkwell: "Footnote: the owl corrected my grammar."',
      'Inkwell: "There is wisdom at the bottom of every cup."',
      'Inkwell: "Note to self: bring a bigger notebook."',
      'Inkwell: "My slime trail is a literary device."',
      'Inkwell reads aloud. The beans listen politely.',
      'Inkwell: "In Lisbon they call this a bica. I call it bliss."',
      'Inkwell: "Patience, Toddy. The best trays take time."',
      'Inkwell: "I trust the lantern. It never rushes me."',
      'Inkwell: "Marginal note: Toddy\u2019s grinder is rather good."',
      'Inkwell: "Good puzzles are like good stories."',
      'Inkwell blinks slowly. It takes a full minute.',
      'Inkwell: "Almost at the final chapter. How exciting."',
      'Inkwell: "I shall dedicate a page to this café."',
    ],
    last: [
      'Inkwell closes his book. "The ending is perfect. Thank you."',
      'Inkwell: "Final chapter, final cup. A fine night\u2019s work."',
      'Inkwell: "I give this café five stars and a footnote."',
    ],
  },
  biscuit: {
    arrive: [
      'Biscuit hops in with flour on her nose. "Fresh croissants, Toddy!"',
      'Biscuit: "I baked all night. Now I need coffee!"',
      'A warm smell of butter fills the café. Biscuit has arrived.',
    ],
    mid: [
      'Biscuit: "These croissants come straight from Lyon. Okay, from my oven."',
      'Biscuit: "Coffee and croissants, the best team in Europe."',
      'Biscuit dusts flour on the tray. Just a little.',
      'Biscuit: "The secret ingredient is butter. And moonlight."',
      'Biscuit: "Two croissants for you, one for the moth."',
      'Biscuit bounces on the stool. Crumbs everywhere.',
      'Biscuit: "My grandmother baked in Vienna. She was strict."',
      'Biscuit: "Taste test! Tiny bite, big smile."',
      'Biscuit: "Free croissants for friends. Only friends."',
      'Biscuit twitches her nose. "Something is burning. Not here!"',
      'Biscuit: "Baking is just patient puzzle solving."',
      'Biscuit: "I rise at midnight. Like dough."',
      'Biscuit: "One more tray, one more croissant!"',
      'Biscuit: "Careful with the beans. Spilled coffee is sad."',
      'Biscuit hums while kneading the air. Very focused.',
      'Biscuit: "Cinnamon? My favourite. Sprinkle some on top."',
      'Biscuit: "Milk, sugar, butter. Basically a hug."',
      'Biscuit: "I counted my crumbs. All present!"',
      'Biscuit: "My ears are for hearing the oven ping."',
      'Biscuit: "Ding! That is the oven. Or your grinder?"',
      'Biscuit: "Best night shift ever, Toddy."',
      'Biscuit offers a tiny cookie to a bean. It declines.',
      'Biscuit: "A fresh batch is coming. Hold on!"',
      'Biscuit: "Warm hands, warm heart, warm coffee."',
    ],
    last: [
      'Biscuit cheers. "Perfect cup! Croissants are on me tonight."',
      'Biscuit: "Last tray, last croissant. Share it with me?"',
      'Biscuit hugs her apron. "Best bakery night ever. Thank you!"',
    ],
  },
};
const TITLES = {
  pip: ['The Midnight Mail', 'The Late Delivery', 'The Sealed Letter', 'The Postman\u2019s Round'],
  lumi: ['The Little Light', 'The Shy Glow', 'The Meadow Guest', 'The Lantern Fly'],
  velvet: ['The Velvet Hour', 'The Upside-Down Guest', 'The Cave Visitor', 'The Midnight Squeak'],
  inkwell: ['The Slow Professor', 'The Café Chronicle', 'The Footnote', 'The Last Chapter'],
  biscuit: ['The Midnight Baker', 'The Warm Batch', 'The Flour Cloud', 'The Buttery Night'],
};
// The first time each new piece shows up, the visitor says a line about it (tray 3 of that Night).
const SPECIAL_LINES = {
  'n4-3': 'Pip: "Cinnamon sticks. Nothing rolls through those."',
  'n5-3': 'Lumi: "A spinner bean! It turns when you grind."',
  'n6-3': 'Velvet: "Chocolate! Grind four beans. It melts."',
  'n7-3': 'Inkwell: "Moon doors. In one, out the other."',
  'n9-3': 'Pip: "Spoon gates. One way only, please."',
  'n11-3': 'Velvet: "Caramel turns beans the other way."',
  'n13-3': 'Biscuit: "Honey! Sticky. Tap again to free it."',
};

const nightCache = {};
// Night n (0 = Night 1). Nights 1-3 are the written story; from Night 4 on, a Night is built from the visitor bank.
export function nightInfo(n) {
  if (n < NIGHTS.length) return NIGHTS[n];
  if (nightCache[n]) return nightCache[n];
  const k = n - NIGHTS.length;
  const v = NEW_VISITORS[k % NEW_VISITORS.length];
  const round = Math.floor(k / NEW_VISITORS.length);
  const b = BANK[v];
  const R = rng(n * 7919 + 13);
  const mid = b.mid.slice();
  for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; }
  const lines = [b.arrive[round % b.arrive.length], ...mid.slice(0, 18), b.last[round % b.last.length]];
  for (const key of Object.keys(SPECIAL_LINES)) { const [kn, kt] = key.slice(1).split('-').map(Number); if (kn === n + 1) lines[kt - 1] = SPECIAL_LINES[key]; }
  const base = TITLES[v][round % TITLES[v].length];
  const info = {
    id: 'n' + (n + 1), name: 'Night ' + (n + 1), title: round >= 4 ? `${base} ${['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(8, Math.floor(round / 4) - 1)]}` : base,
    visitor: v, visitorName: VISITORS[v].name, finale: ['cup', 'moon', 'star', 'heart', 'face'][k % 5], lines,
  };
  nightCache[n] = info;
  return info;
}

// First-time coaching (owner rule 2026-10-14: show, don't tell). No cards to read: Toddy rings the
// bean (or piece) that matters and one short line (8 words or fewer) appears. `on` is the target:
// 'first' = first bean of the solution, 'sleepy' / 'ice' / 'pair' = that piece, 'milk' = a bean whose
// path crosses milk. Shown once per player; replays of the tray stay clean.
export const INTROS = {
  'n1-1': { on: 'first', line: 'Tap a bean. It rolls where it points.' },
  'n1-3': { on: 'first', line: 'Grind the glowing colour first.' },
  'n1-4': { on: 'sleepy', line: 'Sleepy bean! Tap once to wake it.' },
  'n2-1': { on: 'ice', line: 'Ice melts as you grind beans.' },
  'n2-10': { on: 'pair', line: 'Sugar pairs roll together.' },
  'n3-1': { on: 'milk', line: 'Milk turns a bean to its right.' },
  'n4-3': { on: 'wall', line: 'Cinnamon sticks stay put. Roll around them.' },
  'n5-3': { on: 'spin', line: 'Spinner beans turn every time you grind.' },
  'n6-3': { on: 'choc', line: 'Chocolate melts after four beans.' },
  'n7-3': { on: 'portal', line: 'Moon doors: in one, out the twin.' },
  'n9-3': { on: 'gate', line: 'Spoon gates: pass only the spoon way.' },
  'n11-3': { on: 'caramel', line: 'Caramel turns beans the other way.' },
  'n13-3': { on: 'honey', line: 'Honey sticks. Tap again to free it.' },
};

const SHAPES = ['rect', 'circle', 'diamond', 'heart', 'rect', 'face', 'moon', 'circle', 'cup', 'diamond'];

// How many beans tray t of Night n has. A straight climb inside each Night (a bigger Night starts and ends higher),
// so that no tray is ever lighter than the one before it, whatever its shape.
export function beansFor(n, t) {
  let lo, hi;
  if (n < 3) { lo = [6, 10, 14][n]; hi = [52, 60, 66][n]; }
  else { const L = Math.min(n - 2, 10); lo = 16 + Math.round(L * 1.2); hi = 66 + Math.round(L * 0.6); }
  return Math.round(lo + (hi - lo) * (t - 1) / (TRAYS_PER_NIGHT - 1));
}
const cellCount = (shape, size) => makeMask(shape, size, size).flat().filter(Boolean).length;

// Tray settings for night n (0 = Night 1), tray t (1..20). Tutorial 1-2, easy 3-5, medium 6-12, hard 13-19, finale 20.
export function trayConfig(n, t) {
  const band = t <= 5 ? 'easy' : t <= 12 ? 'medium' : t <= 19 ? 'hard' : 'finale';
  const L = Math.max(0, Math.min(n - 2, 12)); // how far past Night 3 we are (0 for Nights 1-3)
  let tight, ticket, pick;
  if (band === 'easy') { tight = 0.6; ticket = t < 3 ? 0 : 3; pick = t < 3 ? 1 : 4; }
  else if (band === 'medium') { tight = 0.8; ticket = 4; pick = 10; }
  else if (band === 'hard') { tight = 0.9; ticket = 5; pick = 20; }
  else { tight = 0.92; ticket = 5; pick = 20; }
  if (n === 2 && band === 'hard') ticket = 6;
  if (band === 'finale') ticket = n >= 2 ? 6 : 5;
  if (n === 0 && t === 3) ticket = 2; // first ticket: just two colours
  if (n >= 3) { tight = Math.min(0.95, +(tight + 0.005 * L).toFixed(3)); ticket = Math.min(8, ticket + Math.floor(L / 3)); pick = Math.min(22, pick + (L >= 4 ? 2 : 0)); }

  // the pieces on the tray
  let sleepy = 0, ice = 0, iceAt = 3, pairs = 0, swirls = 0, walls = 0, spin = 0, portals = 0, choc = 0, gates = 0, caramel = 0, honey = 0;
  if (n === 0 && t >= 8) sleepy = Math.min(3, 1 + Math.floor((t - 8) / 4));
  if (n === 0 && t === 4) sleepy = 1; // a small surprise in tray 4
  if (n >= 1) { ice = Math.min(3, 1 + Math.floor(t / 7)); iceAt = 3 + Math.floor(t / 8); sleepy = t > 4 ? 1 + Math.floor(t / 10) : 0; }
  if (n === 1 && t >= 10) pairs = 1 + Math.floor((t - 10) / 4);
  if (n >= 2) { pairs = t > 3 ? 1 + Math.floor(t / 9) : 0; swirls = t < 5 ? 1 : t < 12 ? 2 : 3; }
  if (n >= 3) { // Night 3's recipe is the floor; every Night adds a little, and new pieces arrive one at a time
    sleepy = Math.min(4, sleepy + Math.floor(L / 4)); ice = Math.min(5, ice + Math.floor(L / 4));
    pairs = Math.min(5, pairs + Math.floor(L / 3)); swirls = Math.min(6, swirls + Math.floor(L / 3));
    walls = t < 3 ? 0 : Math.min(8, 1 + Math.floor((t - 3) / 5) + Math.floor(L / 2)); // cinnamon: Night 4
    spin = L >= 2 && t >= 3 ? 1 : 0;                                                  // spinner bean: Night 5
    portals = L >= 4 && t >= 3 ? (L >= 6 && t >= 10 ? 2 : 1) : 0;                    // moon doors: Night 7
    choc = L >= 3 && t >= 3 ? Math.min(t < 8 ? 1 : 2, 1 + Math.floor((L - 3) / 5) + (t >= 12 ? 1 : 0)) : 0;     // chocolate block: Night 6
    gates = L >= 6 && t >= 3 ? Math.min(t < 8 ? 1 : 2, 1 + Math.floor((L - 6) / 4) + (t >= 12 ? 1 : 0)) : 0;    // spoon gate: Night 9
    caramel = L >= 8 && t >= 3 ? Math.min(t < 8 ? 1 : 2, 1 + Math.floor((L - 8) / 4) + (t >= 12 ? 1 : 0)) : 0;  // caramel swirl: Night 11
    honey = L >= 10 && t >= 3 ? Math.min(t < 8 ? 1 : 2, 1 + Math.floor((L - 10) / 4) + (t >= 12 ? 1 : 0)) : 0;  // honey drop: Night 13
  }

  // shape and size: the smallest tray that holds the beans (and the pieces) comfortably
  let shape = SHAPES[(t + n * 3) % SHAPES.length];
  if (band === 'easy') shape = t % 2 ? 'rect' : 'circle';
  if (band === 'finale') shape = nightInfo(n).finale;
  const beans = beansFor(n, t);
  const pieceCells = swirls + walls + portals * 2 + choc + gates + caramel;
  const roomy = (sh, size) => cellCount(sh, size) * 0.9 - pieceCells >= beans;
  let size = 4;
  const small = (sh) => sh === 'moon' || sh === 'face' || sh === 'heart' || sh === 'star' || sh === 'cup';
  if (n === 0 && t === 1) size = 4; // 5 beans, 4 free: first tap always works
  else {
    if (small(shape) && size < 7) size = 7;
    while (size < 10 && !roomy(shape, size)) size++;
    if (!roomy(shape, size)) shape = 'rect';
    while (size < 10 && !roomy(shape, size)) size++;
    // a Night after the third also starts on a bigger board
    if (n >= 3) size = Math.min(10, Math.max(size, 6 + Math.min(3, Math.floor(L / 2))));
  }
  if (shape === 'cup' && size < 7) shape = 'rect';
  if (small(shape) && size < 7) shape = 'circle';

  const cfg = { w: size, h: size, shape, fill: 0.9, beans, tight, ticket, pick, seed: n === 0 && t === 1 ? 1005 : (n + 1) * 1000 + t, sleepy, ice, iceAt, pairs, swirls, walls, spin, portals, choc, gates, caramel, honey, band };
  if (n === 0 && t === 1) { cfg.fill = 0.3; cfg.tight = 0.2; cfg.pick = 1; delete cfg.beans; }
  return cfg;
}

// Which of the 12 tries at each tray is used, so that tray 20 is never easier than tray 19 and every Night ramps up
// (worked out once by tools/pace_trays.mjs and kept in src/pace.js; a missing entry means the first try).

// The badge every tray carries: 0 Easy, 1 Medium, 2 Hard, 3 Expert, from the tray's difficulty number (core.difficulty).
export const TIER_NAMES = ['Easy', 'Medium', 'Hard', 'Expert'];
export const tierOf = (d) => (d < 45 ? 0 : d < 90 ? 1 : d < 140 ? 2 : 3);
export function trayTier(n, t) { const row = TIER[n] || TIER[Math.max(...Object.keys(TIER).map(Number))]; return row ? Number(row[t - 1]) : 2; }
export function seedFor(n, t) { const k = (PACE[n] && PACE[n][t - 1]) || 0; return trayConfig(n, t).seed + k * 100003; }
// The tray settings with the chosen try, ready for generate().
export function trayLevelConfig(n, t) { const c = trayConfig(n, t); return { ...c, seed: n === 0 && t === 1 ? c.seed : seedFor(n, t) }; }

export function dailyNumber(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
export function dailyConfig(d = new Date()) {
  const n = dailyNumber(d);
  const R = rng(n);
  const shapes = ['rect', 'circle', 'moon', 'cup', 'diamond', 'heart', 'face', 'star'];
  return { w: 8, h: 8, shape: shapes[Math.floor(R() * shapes.length)], fill: 0.78, tight: 0.9, ticket: 5, pick: 12,
    sleepy: 1, ice: 1, iceAt: 4, pairs: 1, swirls: R() < 0.5 ? 1 : 0, seed: n, band: 'daily', daily: n,
    visitor: VISITOR_ORDER[n % VISITOR_ORDER.length] };
}

// Endless Brew: tray k of a run gets steadily harder.
export function endlessConfig(runSeed, k, pieces = {}) {
  const size = Math.min(10, 5 + Math.floor(k / 2));
  const shapes = ['rect', 'circle', 'diamond', 'heart', 'face', 'moon', 'cup', 'star'];
  const R = rng(runSeed + k * 31);
  let shape = shapes[Math.floor(R() * shapes.length)];
  if (size < 7 && shape !== 'rect' && shape !== 'diamond') shape = 'circle';
  return { w: size, h: size, shape, fill: Math.min(0.8, 0.62 + 0.02 * k), tight: Math.min(0.9, 0.6 + 0.04 * k), pick: Math.min(12, 3 + k),
    ticket: Math.min(6, 3 + Math.floor(k / 3)), sleepy: k >= 2 ? Math.min(3, 1 + Math.floor(k / 5)) : 0,
    ice: k >= 3 ? Math.min(3, 1 + Math.floor(k / 6)) : 0, iceAt: 3, pairs: k >= 4 ? Math.min(3, 1 + Math.floor(k / 6)) : 0,
    swirls: k >= 5 ? Math.min(3, 1 + Math.floor((k - 5) / 4)) : 0, seed: (runSeed + k * 7717) >>> 0, band: 'endless',
    // special pieces only once the player has met them in the story (Night 4, 5, 7)
    walls: pieces.walls && k >= 6 ? Math.min(5, 1 + Math.floor((k - 6) / 4)) : 0, spin: pieces.spin && k >= 8 ? 1 : 0, portals: pieces.portals && k >= 10 ? 1 : 0,
    choc: pieces.choc && k >= 7 ? Math.min(2, 1 + Math.floor((k - 7) / 6)) : 0, gates: pieces.gates && k >= 9 ? 1 : 0,
    caramel: pieces.caramel && k >= 11 ? 1 : 0, honey: pieces.honey && k >= 12 ? 1 : 0 };
}

export const ENDLESS_LINES = [
  'Endless Brew. The café never closes tonight.',
  'Another tray slides onto the counter.',
  'The beans keep coming. Toddy keeps smiling.',
  'Milo peeks in: "Still brewing?"',
  'The moth snores on the lamp shade.',
  'A star winks through the window.',
];
