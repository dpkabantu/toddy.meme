// TODDY Trail floors: the twelve painted scenes plus endless plain-colour floors with patterns drawn in code.
// Pictures only: nothing here touches the game rules. Plain floors are mid-tones with low contrast, so the visitors, obstacles and the gold glow always stay readable.

export const PAINTED = [1, 2, 3, 4, 5, 6, 7, 101, 102, 103, 104, 105];
// the obstacle picture that belongs to each painted scene: [file key, height in cells]
export const OBSTACLE = { 101: ['planter', 1.45], 102: ['suitcases', 1.75], 103: ['rope', 1.3], 104: ['snowman', 1.55], 105: ['telescope', 1.7], 2: ['table', 1.85], 3: ['crates', 1.45], 4: ['barrel', 1.2], 5: ['shelf', 1.35], 6: ['post', 1.3], 7: ['speaker', 1.6] };
export const OBSTACLE_LIST = Object.values(OBSTACLE);
export const obstacleForPainted = (id) => OBSTACLE[id] || OBSTACLE[2];

// name, tone A, tone B
export const PLAIN = [
  ['Teal', '#2f6f73', '#2a6568'], ['Plum', '#5b3a6e', '#533466'], ['Slate', '#3f5b7a', '#3a5471'], ['Forest', '#35684a', '#306043'],
  ['Grey', '#6b6670', '#625d68'], ['Indigo', '#4a4a8c', '#444485'], ['Brick', '#7a4a42', '#704239'], ['Ocean', '#2f6490', '#2a5b85'],
  ['Olive', '#66723a', '#5d6935'], ['Mocha', '#6b4e3d', '#624636'], ['Rose', '#8a4d66', '#7f465e'], ['Sand', '#8a7a55', '#7f704d'],
  ['Midnight', '#2d3a66', '#28345d'], ['Moss', '#4f6a3c', '#486236'],
];
export const PATTERNS = ['Tiles', 'Stripes', 'Planks', 'Diamonds', 'Dots', 'Weave'];

// Three random numbers are always used, so the same level number gives the same floor whatever the floor setting says.
export function pickFloor(rnd, mode) {
  const a = rnd(), b = rnd(), c = rnd(), d = rnd();
  const painted = { kind: 'painted', id: PAINTED[Math.floor(a * PAINTED.length)] };
  const plain = { kind: 'plain', c: Math.floor(b * PLAIN.length), p: Math.floor(c * PATTERNS.length) };
  const kind = mode === 'painted' ? 'painted' : mode === 'plain' ? 'plain' : (d < 0.5 ? 'painted' : 'plain');
  return kind === 'painted' ? painted : plain;
}
export const floorName = (f) => (f.kind === 'painted' ? 'Painted scene ' + f.id : PLAIN[f.c][0] + ' ' + PATTERNS[f.p].toLowerCase());

// Draws a plain floor: w x h cells with the top-left corner at (ox, oy).
export function drawPlainFloor(ctx, ox, oy, cell, w, h, f) {
  const [, c1, c2] = PLAIN[f.c], pat = PATTERNS[f.p];
  const X = (x) => ox + x * cell, Y = (y) => oy + y * cell;
  ctx.fillStyle = c1; ctx.fillRect(ox, oy, cell * w, cell * h);
  ctx.fillStyle = c2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (pat === 'Tiles') { if ((x + y) % 2) ctx.fillRect(X(x), Y(y), cell, cell); }
    else if (pat === 'Stripes') { if (x % 2) ctx.fillRect(X(x), Y(y), cell, cell); }
    else if (pat === 'Planks') { if (y % 2) ctx.fillRect(X(x), Y(y), cell, cell); }
    else if (pat === 'Weave') { if ((x + y) % 2) ctx.fillRect(X(x), Y(y), cell, cell); }
    else if (pat === 'Diamonds') { ctx.beginPath(); ctx.moveTo(X(x) + cell / 2, Y(y) + cell * 0.12); ctx.lineTo(X(x) + cell * 0.88, Y(y) + cell / 2); ctx.lineTo(X(x) + cell / 2, Y(y) + cell * 0.88); ctx.lineTo(X(x) + cell * 0.12, Y(y) + cell / 2); ctx.closePath(); ctx.fill(); }
    else if (pat === 'Dots') { ctx.beginPath(); ctx.arc(X(x) + cell / 2, Y(y) + cell / 2, cell * 0.2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.lineWidth = 1;
  if (pat === 'Planks') {   // staggered joints between the boards
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.beginPath();
    for (let y = 0; y < h; y++) for (let x = (y % 2 ? 0 : 1); x <= w; x += 2) { ctx.moveTo(X(x) + (y % 2 ? cell * 0.5 : 0), Y(y)); ctx.lineTo(X(x) + (y % 2 ? cell * 0.5 : 0), Y(y + 1)); }
    ctx.stroke();
  }
  if (pat === 'Weave') {   // little stitches that make the squares look woven
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const horiz = (x + y) % 2 === 0; for (let k = 1; k <= 3; k++) { if (horiz) { ctx.moveTo(X(x) + cell * 0.12, Y(y) + (cell * k) / 4); ctx.lineTo(X(x) + cell * 0.88, Y(y) + (cell * k) / 4); } else { ctx.moveTo(X(x) + (cell * k) / 4, Y(y) + cell * 0.12); ctx.lineTo(X(x) + (cell * k) / 4, Y(y) + cell * 0.88); } } }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.beginPath();
  for (let x = 0; x <= w; x++) { ctx.moveTo(X(x), oy); ctx.lineTo(X(x), oy + h * cell); }
  for (let y = 0; y <= h; y++) { ctx.moveTo(ox, Y(y)); ctx.lineTo(ox + w * cell, Y(y)); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,190,.55)'; ctx.lineWidth = 3; ctx.strokeRect(ox, oy, cell * w, cell * h);
}
