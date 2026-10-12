// TODDY: Moon Brew — Nights, trays, visitors and story lines.
import { rng } from './core.js';

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

// New-piece tips shown the first time a piece appears.
export const INTROS = {
  'n1-1': { title: 'Tap a bean', text: 'It rolls the way its tip points. Clear the whole tray into the grinder.' },
  'n1-3': { title: 'Order ticket', text: 'The beans at the top show which colours to grind first, left to right. The glowing one is next. Follow the order for a Perfect Brew and the 3rd star. Wrong colour? You can still clear the tray, just without the 3rd star.' },
  'n1-6': { title: 'Watch for bumps', text: 'A blocked bean bumps and cracks. Three bumps and the brew is burnt.' },
  'n1-8': { title: 'Sleepy bean', text: 'It wears a nightcap. Tap once to wake it, then it can roll.' },
  'n2-1': { title: 'Ice cube', text: 'A frozen bean cannot move. Each bean you grind melts the ice by one.' },
  'n2-10': { title: 'Sugar pair', text: 'A sugar cube sticks two beans together. Tap either one and both roll. Both paths must be clear.' },
  'n3-1': { title: 'Milk swirl', text: 'A bean that rolls over spilled milk turns a quarter turn to its right and keeps going.' },
};

const SHAPES = ['rect', 'circle', 'diamond', 'heart', 'rect', 'face', 'moon', 'circle', 'cup', 'diamond'];

// Tray settings for night n (0..2), tray t (1..20).
export function trayConfig(n, t) {
  // Tutorial 1-2, easy 3-5, medium 6-12, hard 13-19, finale 20.
  const band = t <= 5 ? 'easy' : t <= 12 ? 'medium' : t <= 19 ? 'hard' : 'finale';
  let size, fill, tight, ticket, pick;
  if (band === 'easy') { size = 4 + Math.floor((t - 1) / 2); fill = 0.55 + 0.02 * t; tight = 0.6; ticket = t < 3 ? 0 : 3; pick = t < 3 ? 1 : 4; }
  else if (band === 'medium') { size = 6 + Math.floor((t - 6) / 3); fill = 0.68 + 0.01 * (t - 6); tight = 0.8; ticket = 4; pick = 10; }
  else if (band === 'hard') { size = 8 + Math.floor((t - 13) / 3); fill = 0.8; tight = 0.9; ticket = 5; pick = 20; }
  else { size = 10; fill = 0.78; tight = 0.9; ticket = 5; pick = 20; }
  if (n === 0 && t === 1) { size = 4; fill = 0.42; tight = 0.5; }
  if (n > 0 && band !== 'finale') size += 1;
  if (n === 0 && band === 'finale') size = 9;
  size = Math.min(10, size);
  if (n === 2 && band === 'hard') ticket = 6;

  let shape = SHAPES[(t + n * 3) % SHAPES.length];
  if (band === 'easy') shape = t % 2 ? 'rect' : 'circle';
  if (band === 'finale') shape = NIGHTS[n].finale;
  if (shape === 'cup' && size < 7) shape = 'rect';
  if ((shape === 'moon' || shape === 'face' || shape === 'heart' || shape === 'star') && size < 7) shape = 'circle';

  const cfg = { w: size, h: size, shape, fill, tight, ticket, pick, seed: (n + 1) * 1000 + t, sleepy: 0, ice: 0, iceAt: 3, pairs: 0, swirls: 0, band };
  if (n === 0 && t >= 8) cfg.sleepy = Math.min(3, 1 + Math.floor((t - 8) / 4));
  if (n >= 1) { cfg.ice = Math.min(3, 1 + Math.floor(t / 7)); cfg.iceAt = 3 + Math.floor(t / 8); cfg.sleepy = t > 4 ? 1 + Math.floor(t / 10) : 0; }
  if (n === 1 && t >= 10) cfg.pairs = 1 + Math.floor((t - 10) / 4);
  if (n === 2) { cfg.pairs = t > 3 ? 1 + Math.floor(t / 9) : 0; cfg.swirls = t < 5 ? 1 : t < 12 ? 2 : 3; }
  return cfg;
}

export function dailyNumber(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
export function dailyConfig(d = new Date()) {
  const n = dailyNumber(d);
  const R = rng(n);
  const shapes = ['rect', 'circle', 'moon', 'cup', 'diamond', 'heart', 'face', 'star'];
  return { w: 8, h: 8, shape: shapes[Math.floor(R() * shapes.length)], fill: 0.78, tight: 0.9, ticket: 5, pick: 12,
    sleepy: 1, ice: 1, iceAt: 4, pairs: 1, swirls: R() < 0.5 ? 1 : 0, seed: n, band: 'daily', daily: n,
    visitor: ['milo', 'moth', 'star'][n % 3] };
}

// Endless Brew: tray k of a run gets steadily harder.
export function endlessConfig(runSeed, k) {
  const size = Math.min(10, 5 + Math.floor(k / 2));
  const shapes = ['rect', 'circle', 'diamond', 'heart', 'face', 'moon', 'cup', 'star'];
  const R = rng(runSeed + k * 31);
  let shape = shapes[Math.floor(R() * shapes.length)];
  if (size < 7 && shape !== 'rect' && shape !== 'diamond') shape = 'circle';
  return { w: size, h: size, shape, fill: Math.min(0.8, 0.62 + 0.02 * k), tight: Math.min(0.9, 0.6 + 0.04 * k), pick: Math.min(12, 3 + k),
    ticket: Math.min(6, 3 + Math.floor(k / 3)), sleepy: k >= 2 ? Math.min(3, 1 + Math.floor(k / 5)) : 0,
    ice: k >= 3 ? Math.min(3, 1 + Math.floor(k / 6)) : 0, iceAt: 3, pairs: k >= 4 ? Math.min(3, 1 + Math.floor(k / 6)) : 0,
    swirls: k >= 5 ? Math.min(3, 1 + Math.floor((k - 5) / 4)) : 0, seed: (runSeed + k * 7717) >>> 0, band: 'endless' };
}

export const ENDLESS_LINES = [
  'Endless Brew. The café never closes tonight.',
  'Another tray slides onto the counter.',
  'The beans keep coming. Toddy keeps smiling.',
  'Milo peeks in: "Still brewing?"',
  'The moth snores on the lamp shade.',
  'A star winks through the window.',
];
