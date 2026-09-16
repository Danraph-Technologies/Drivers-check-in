import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, drivers } from '@/db/schema';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

let _secret: Uint8Array | null = null;

function secret(): Uint8Array {
  if (!_secret) {
    const secretString = process.env.AUTH_SECRET;
    if (!secretString || secretString.length < 32) {
      throw new Error('AUTH_SECRET must be set and at least 32 characters long.');
    }
    _secret = new TextEncoder().encode(secretString);
  }
  return _secret;
}

export type SessionPayload = {
  sub: string; // users.id
  role: 'admin' | 'driver';
  name: string;
  driverId?: string;
  busLabel?: string;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
    } catch {
    return null;
  }
}

/** Require an admin session, or throw. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return session;
}

/** Require a driver session, or throw. */
export async function requireDriver(): Promise<SessionPayload & { driverId: string }> {
  const session = await getSession();
  if (!session || session.role !== 'driver' || !session.driverId) {
    throw new Error('Unauthorized');
  }
  return session as SessionPayload & { driverId: string };
}

/** Hash a PIN or password. PINs are strings so leading zeros survive. */
export function hashSecret(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifySecret(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function isLocked(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

export function lockRemainingMinutes(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
}

/** Atomic failed-attempt increment with lockout. Returns the new state. */
export async function registerFailedAttempt(table: 'drivers' | 'users', id: string) {
  if (table === 'drivers') {
    const rows = await db
      .update(drivers)
      .set({
        failedPinAttempts: sql`${drivers.failedPinAttempts} + 1`,
        lockedUntil: sql`CASE WHEN ${drivers.failedPinAttempts} + 1 >= ${MAX_ATTEMPTS} THEN now() + interval '${sql.raw(String(LOCK_MINUTES))} minutes' ELSE ${drivers.lockedUntil} END`,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, id))
      .returning({ failed: drivers.failedPinAttempts, lockedUntil: drivers.lockedUntil });
    return rows[0];
  }
  const rows = await db
    .update(users)
    .set({
      failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
      lockedUntil: sql`CASE WHEN ${users.failedLoginAttempts} + 1 >= ${MAX_ATTEMPTS} THEN now() + interval '${sql.raw(String(LOCK_MINUTES))} minutes' ELSE ${users.lockedUntil} END`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ failed: users.failedLoginAttempts, lockedUntil: users.lockedUntil });
  return rows[0];
}

/** Clear failure state after a successful login or PIN reset. */
export async function clearFailures(table: 'drivers' | 'users', id: string) {
  if (table === 'drivers') {
    await db
      .update(drivers)
      .set({ failedPinAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(drivers.id, id));
    return;
  }
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, id));
}

/** Normalize a Nigerian phone number to bare digits, e.g. "0803 123 4567" -> "08031234567". */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

export function isValidPhone(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 13;
}
