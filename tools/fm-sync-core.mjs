#!/usr/bin/env node
// Copies the Full Moon rules from the server copy (server/games/full-moon-core.js) into the game (games/full-moon/src/game.js),
// so the phone and the server always run the very same code. A test (server/test/games.mjs) checks they match.
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const core = fs.readFileSync(root + 'server/games/full-moon-core.js', 'utf8').replace(/\s+$/, '');
const names = [...core.matchAll(/^export (?:const|function) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
const body = core.replace(/^export /gm, '');
const gp = root + 'games/full-moon/src/game.js', g = fs.readFileSync(gp, 'utf8');
const open = 'const C = (function(){', a = g.indexOf(open) + open.length, b = g.indexOf('\n})();\n', a);
if (a < open.length || b < 0) throw new Error('markers not found in game.js');
fs.writeFileSync(gp, g.slice(0, a) + '\n' + body + '\n\nreturn {' + names.join(',') + '};' + g.slice(b));
console.log('synced ' + names.length + ' names into game.js');
