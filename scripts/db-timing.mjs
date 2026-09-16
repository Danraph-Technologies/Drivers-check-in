// Times sequential + parallel queries against the pooled London DB.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL);
await sql`SELECT 1`; // wake
for (const label of ['warm 1', 'warm 2', 'warm 3']) {
  const t0 = performance.now();
  await sql`SELECT count(*) FROM users`;
  console.log(`${label}: ${Math.round(performance.now() - t0)} ms`);
}
const t0 = performance.now();
const [a, b] = await Promise.all([sql`SELECT 1`, sql`SELECT 2`]);
console.log(`2 parallel: ${Math.round(performance.now() - t0)} ms (${a.length + b.length} rows)`);
