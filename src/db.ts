import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export function getDatabase(dbPath?: string) {
  // On Vercel Serverless / Lambda, root file system is read-only.
  // SQLite must be placed in /tmp or use memory / environment override.
  const isVercel = Boolean(process.env.VERCEL);
  const resolvedDbPath = dbPath || (isVercel ? '/tmp/taxi-dispatch.sqlite' : './taxi-dispatch.sqlite');

  // If running on Vercel and existing seed database exists in project root, copy it over to /tmp once
  if (isVercel && resolvedDbPath.startsWith('/tmp/')) {
    try {
      const sourceDb = path.resolve(process.cwd(), 'taxi-dispatch.sqlite');
      if (fs.existsSync(sourceDb) && !fs.existsSync(resolvedDbPath)) {
        fs.copyFileSync(sourceDb, resolvedDbPath);
      }
    } catch (e) {
      console.warn('[Database] Could not copy initial db file to /tmp, will initialize freshly:', e);
    }
  }

  const sqlite = new DatabaseSync(resolvedDbPath);
  
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
