// Makes the paste-safe copy of a migration for the Cloudflare dashboard Console, whose text box flattens
// line breaks: no comments, one line. Run: node server/make-paste.mjs   (writes server/paste/*.paste.sql)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export function toPaste(sql) {
  return sql.split('\n').map((l) => l.replace(/--.*$/, '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() + '\n';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(path.join(root, 'paste'), { recursive: true });
  for (const f of readdirSync(path.join(root, 'migrations')).filter((x) => x.endsWith('.sql')).sort()) {
    const out = toPaste(readFileSync(path.join(root, 'migrations', f), 'utf8'));
    writeFileSync(path.join(root, 'paste', f.replace('.sql', '.paste.sql')), out);
    console.log(f, '->', out.length, 'characters on one line');
  }
}
