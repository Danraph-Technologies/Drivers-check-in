import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '../src/db/schema';

// Load .env manually so the script works outside Next.js.
try {
  const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
} catch {
  // no .env file; rely on real environment variables
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  if (!email || !password || password.length < 8) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 chars) must be set');
  }

  const db = drizzle(neon(url));
  const existing = await db.select({ id: users.id }).from(users);
  if (existing.length > 0) {
    console.log('Database already has users. Seed skipped.');
    return;
  }

  await db.insert(users).values({
    role: 'admin',
    name,
    email: email.trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
  });
  console.log(`Admin created: ${email}`);
  console.log('Sign in on the Admin tab, then create your buses and drivers.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
