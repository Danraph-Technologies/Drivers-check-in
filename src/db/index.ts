import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Lazily create the Drizzle client so importing this module never throws at build time. */
export function getDb() {
  if (!_db) {
    // Prefer the pooled connection (PgBouncer): it is what Neon recommends for
    // serverless runtimes, and what we set on Vercel. Falls back to DATABASE_URL.
    const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    }
    _db = drizzle(neon(connectionString), { schema });
  }
  return _db;
}

// Convenience export: most call sites just use `db`. The proxy defers
// initialization until the first query.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
