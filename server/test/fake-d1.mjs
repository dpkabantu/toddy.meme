// A small look-alike of Cloudflare D1 on top of real SQLite (node:sqlite), for tests only.
export function fakeD1(db) {
  const stmt = (sql, args) => {
    const o = {
      bind(...a) { return stmt(sql, a); },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
      _run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    };
    return o;
  };
  return {
    prepare: (sql) => stmt(sql, []),
    // D1 batches are all-or-nothing, like this
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((s) => s._run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
