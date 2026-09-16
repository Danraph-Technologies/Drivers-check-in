import Link from 'next/link';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { drivers, users } from '@/db/schema';
import { confirmIdentityAndSetPin } from '@/app/actions/auth';
import { BrandMark } from '@/components/brand';
import { SubmitButton } from '@/components/submit-button';

export const metadata = { title: 'Create your PIN' };

export default async function PinSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const driverId = sp.driver ?? '';

  let name: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(driverId)) {
    const rows = await db
      .select({ name: users.name })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .where(eq(drivers.id, driverId));
    name = rows[0]?.name ?? null;
  }

  if (!name) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
        <BrandMark />
        <div
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>This link is not valid. Go back and enter your phone number again.</span>
        </div>
        <Link
          href="/login"
          className="btn btn-outline btn-block mt-5"
        >
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <BrandMark />

      <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-ink-900">First time sign in</h1>
      <p className="mt-2 text-base text-ink-500">
        Confirm your name and choose a PIN you will remember.
      </p>

      <div className="hero fade-up mt-6 rounded-2xl p-5 text-white">
        <p className="text-xs font-bold tracking-wide text-brand-100 uppercase">Is this you?</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{name}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-100">
          <BadgeCheck size={15} />
          Added by DanRaph management
        </p>
      </div>

      {sp.error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}

      <form action={confirmIdentityAndSetPin} className="mt-6 space-y-4">
        <input type="hidden" name="driverId" value={driverId} />
        <label className="block">
          <span className="label">Create your 4 digit PIN</span>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            placeholder="••••"
            required
            className="field field-lg text-center tracking-[0.6em]"
          />
        </label>
        <label className="block">
          <span className="label">Repeat the PIN</span>
          <input
            name="pin2"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            placeholder="••••"
            required
            className="field field-lg text-center tracking-[0.6em]"
          />
        </label>
        <p className="text-sm text-ink-500">
          Remember this PIN. Next time you sign in with your phone number and this PIN.
        </p>
        <SubmitButton className="btn btn-primary btn-block btn-lg" pendingLabel="Saving...">
          Save PIN and continue
        </SubmitButton>
      </form>
    </main>
  );
}