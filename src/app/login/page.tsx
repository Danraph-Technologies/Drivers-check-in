import Link from 'next/link';
import { KeyRound, MapPin, Phone, Route, TriangleAlert } from 'lucide-react';
import { loginWithPhone } from '@/app/actions/auth';
import { BrandMark } from '@/components/brand';
import { SubmitButton } from '@/components/submit-button';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; phone?: string; name?: string; step?: string }>;
}) {
  const sp = await searchParams;
  const pinStep = sp.step === 'pin' && sp.phone;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 lg:px-8">
      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand side */}
        <section className="hidden lg:block">
          <BrandMark size="lg" />
          <h1 className="mt-8 text-5xl leading-[1.05] font-extrabold tracking-tight text-ink-900">
            Report your trip
            <br />
            <span className="text-brand-600">after you land.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-600">
            No more phone calls asking if you loaded. File one short report when you reach your
            destination and management sees it straight away.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              { icon: <Phone size={18} />, text: 'Sign in with your phone number and PIN' },
              { icon: <Route size={18} />, text: 'From, to, seats, amount, times' },
              { icon: <MapPin size={18} />, text: 'Your location is stamped when you save' },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-base text-ink-700">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  {item.icon}
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </section>

        {/* Form side */}
        <section className="w-full">
          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="card fade-up mt-6 p-6 sm:p-7 lg:mt-0">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-white">
                <KeyRound size={19} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-ink-900">Driver sign in</h2>
                <p className="text-sm text-ink-500">
                  {pinStep ? 'Enter your PIN to continue' : 'Use the phone number the admin saved'}
                </p>
              </div>
            </div>

            {sp.error ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              >
                <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                <span>{sp.error}</span>
              </div>
            ) : null}

            {pinStep ? (
              <form action={loginWithPhone} className="space-y-4">
                <input type="hidden" name="phone" value={sp.phone} />
                <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
                    Signing in as
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-ink-900">{sp.name}</p>
                </div>
                <label className="block">
                  <span className="label">Your 4 digit PIN</span>
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="off"
                    placeholder="••••"
                    autoFocus
                    required
                    className="field field-lg text-center tracking-[0.6em]"
                  />
                </label>
                <SubmitButton className="btn btn-primary btn-block btn-lg" pendingLabel="Signing in...">
                  Sign in
                </SubmitButton>
                <Link
                  href="/login"
                  className="block text-center text-sm font-semibold text-ink-500 hover:text-ink-800"
                >
                  Use a different phone number
                </Link>
              </form>
            ) : (
              <form action={loginWithPhone} className="space-y-4">
                <label className="block">
                  <span className="label">Phone number</span>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    defaultValue={sp.phone}
                    placeholder="0803 123 4567"
                    required
                    className="field field-lg"
                  />
                </label>
                <SubmitButton className="btn btn-primary btn-block btn-lg" pendingLabel="Checking...">
                  Continue
                </SubmitButton>
                <p className="text-center text-sm text-ink-500">
                  First time here? You will choose your own PIN next.
                </p>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-ink-400">
            DanRaph Transport, Enugu
            <span className="mx-1.5 text-ink-300">&middot;</span>
            <Link href="/admin/login" className="font-semibold hover:text-ink-700">
              Management sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}