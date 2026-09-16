'use server';

import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { users, drivers, buses } from '@/db/schema';
import {
  createSession,
  destroySession,
  getSession,
  hashSecret,
  verifySecret,
  isLocked,
  lockRemainingMinutes,
  registerFailedAttempt,
  clearFailures,
} from '@/lib/auth';
import { adminLoginSchema, pinSchema, phoneSchema } from '@/lib/validation';

export async function loginWithPhone(formData: FormData) {
  const phone = String(formData.get('phone') ?? '');
  const pin = String(formData.get('pin') ?? '');
  const parsedPhone = phoneSchema.safeParse(phone);
  if (!parsedPhone.success) {
    redirect('/login?error=Enter+your+phone+number');
  }

  const rows = await db
    .select({
      driverId: drivers.id,
      userId: users.id,
      name: users.name,
      isActive: users.isActive,
      status: drivers.status,
      pinHash: drivers.pinHash,
      lockedUntil: drivers.lockedUntil,
      busLabel: buses.label,
    })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
    .where(eq(drivers.phone, parsedPhone.data));

  const driver = rows[0];
  if (!driver) {
    redirect('/login?error=This+phone+number+is+not+registered.+Ask+the+admin');
  }
  if (!driver.isActive || driver.status !== 'active') {
    redirect('/login?error=This+account+is+not+active.+Contact+the+admin');
  }

  // No PIN yet: go to identity confirmation, then PIN creation.
  if (!driver.pinHash) {
    redirect(`/login/setup?driver=${driver.driverId}`);
  }

  // Step 1: phone only. Show the PIN step on the same page.
  if (!pin) {
    redirect(
      `/login?step=pin&phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(driver.name)}`,
    );
  }

  if (isLocked(driver.lockedUntil)) {
    const mins = lockRemainingMinutes(driver.lockedUntil!);
    redirect(`/login?error=Too+many+attempts.+Try+again+in+${mins}+minute(s)`);
  }

  if (!/^\d{4}$/.test(pin)) {
    redirect('/login?error=Enter+your+4+digit+PIN');
  }

  if (!verifySecret(pin, driver.pinHash)) {
    await registerFailedAttempt('drivers', driver.driverId);
    redirect('/login?error=Wrong+phone+number+or+PIN');
  }

  await clearFailures('drivers', driver.driverId);
  await createSession({
    sub: driver.userId,
    role: 'driver',
    name: driver.name,
    driverId: driver.driverId,
    busLabel: driver.busLabel ?? undefined,
  });
  redirect('/driver');
}

export async function confirmIdentityAndSetPin(formData: FormData) {
  const driverId = String(formData.get('driverId') ?? '');
  const pin = String(formData.get('pin') ?? '');
  const pin2 = String(formData.get('pin2') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(driverId)) {
    redirect('/login?error=Invalid+link');
  }
  if (pin !== pin2) {
    redirect(`/login/setup?driver=${driverId}&error=The+two+PINs+do+not+match`);
  }
  const parsedPin = pinSchema.safeParse(pin);
  if (!parsedPin.success) {
    redirect(`/login/setup?driver=${driverId}&error=PIN+must+be+exactly+4+digits`);
  }

  const rows = await db
    .select({
      driverId: drivers.id,
      pinHash: drivers.pinHash,
      isActive: users.isActive,
      status: drivers.status,
    })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId));
  const driver = rows[0];
  if (!driver || driver.pinHash) {
    redirect('/login?error=This+account+already+has+a+PIN.+Sign+in+with+it');
  }
  if (!driver.isActive || driver.status !== 'active') {
    redirect('/login?error=This+account+is+not+active.+Contact+the+admin');
  }

  await db
    .update(drivers)
    .set({ pinHash: hashSecret(pin), updatedAt: new Date() })
    .where(eq(drivers.id, driverId));

  const uRows = await db
    .select({ userId: users.id, name: users.name, busLabel: buses.label })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
    .where(eq(drivers.id, driverId));
  const u = uRows[0];

  await createSession({
    sub: u.userId,
    role: 'driver',
    name: u.name,
    driverId,
    busLabel: u.busLabel ?? undefined,
  });
  redirect('/driver');
}

export async function loginAdmin(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    redirect('/admin/login?error=Enter+your+email+and+password');
  }
  const { email, password } = parsed.data;

  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.email, email)));
  const admin = rows[0];
  if (!admin) {
    redirect('/admin/login?error=Wrong+email+or+password');
  }
  if (!admin.isActive) {
    redirect('/admin/login?error=This+account+is+not+active.+Contact+another+admin');
  }
  if (isLocked(admin.lockedUntil)) {
    const mins = lockRemainingMinutes(admin.lockedUntil!);
    redirect(`/admin/login?error=Too+many+attempts.+Try+again+in+${mins}+minute(s)`);
  }
  if (!admin.passwordHash || !verifySecret(password, admin.passwordHash)) {
    await registerFailedAttempt('users', admin.id);
    redirect('/admin/login?error=Wrong+email+or+password');
  }

  await clearFailures('users', admin.id);
  await createSession({ sub: admin.id, role: 'admin', name: admin.name });
  redirect('/admin');
}

/** Sign out and land on the right sign-in screen for the role. */
export async function logout() {
  const session = await getSession();
  await destroySession();
  redirect(session?.role === 'admin' ? '/admin/login' : '/login');
}