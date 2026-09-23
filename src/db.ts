import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function getDatabase(dbPath = './taxi-dispatch.sqlite') {
  const sqlite = new DatabaseSync(dbPath);
  
  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;');

  // Run migrations tracking with _migrations table
  sqlite.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at INTEGER);');
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const check = sqlite.prepare('SELECT id FROM _migrations WHERE id = ?').get(file);
      if (!check) {
        try {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          sqlite.exec(sql);
          sqlite.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(file, Math.floor(Date.now() / 1000));
          console.log(`[Database] Ran migration: ${file}`);
        } catch (err: any) {
          if (String(err).includes('duplicate column name')) {
            sqlite.prepare('INSERT OR IGNORE INTO _migrations (id, applied_at) VALUES (?, ?)').run(file, Math.floor(Date.now() / 1000));
          } else {
            console.error(`[Database] Error running migration ${file}:`, err);
          }
        }
      }
    }
  }

  // Adapter matching Cloudflare D1Database interface
  const d1 = {
    prepare(sql: string) {
      let boundParams: any[] = [];
      return {
        bind(...params: any[]) {
          boundParams = params;
          return this;
        },
        async all<T = any>() {
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...boundParams);
          return { results: results as T[] };
        },
        async first<T = any>(colName?: string) {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...boundParams);
          if (!row) return null;
          if (colName) return (row as any)[colName] as T;
          return row as T;
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...boundParams);
          return {
            meta: {
              changes: res.changes,
              last_row_id: Number(res.lastInsertRowid),
            },
          };
        },
      };
    },
    exec(sql: string) {
      sqlite.exec(sql);
    },
  };

  return { sqlite, d1 };
}
