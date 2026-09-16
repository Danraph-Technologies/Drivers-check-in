'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { requireDriver, hashSecret, verifySecret } from '@/lib/auth';
import { pinSchema } from '@/lib/validation';
import type { ActionResult } from '@/app/actions/trips';

export async function changeOwnPinAction(formData: FormData): Promise<ActionResult> {
  const session = await requireDriver();
  const currentPin = String(formData.get('currentPin') ?? '');
  const newPin = String(formData.get('newPin') ?? '');
  const newPin2 = String(formData.get('newPin2') ?? '');

  const parsedNew = pinSchema.safeParse(newPin);
  if (!parsedNew.success) return { ok: false, error: 'The new PIN must be exactly 4 digits.' };
  if (newPin !== newPin2) return { ok: false, error: 'The two new PINs do not match.' };

  const rows = await db
    .select({ pinHash: drivers.pinHash })
    .from(drivers)
    .where(eq(drivers.id, session.driverId));
  const driver = rows[0];
  if (!driver?.pinHash) return { ok: false, error: 'Driver not found.' };
  if (!verifySecret(currentPin, driver.pinHash)) {
    return { ok: false, error: 'Your current PIN is not correct.' };
  }

  await db
    .update(drivers)
    .set({ pinHash: hashSecret(newPin), updatedAt: new Date() })
    .where(eq(drivers.id, session.driverId));
  return { ok: true };
}
