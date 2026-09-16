import Link from 'next/link';
import { ArrowLeft, ShieldCheck, TriangleAlert } from 'lucide-react';
import { loginAdmin } from '@/app/actions/auth';
import { BrandMark } from '@/components/brand';
import { SubmitButton } from '@/components/submit-button';

export const metadata = { title: 'Management sign in' };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* Brand side */}
      <section className="panel-dark relative hidden flex-col justify-between p-10 lg:flex">
        <BrandMark size="lg" onDark />

        <div>
          <span className="chip chip-info border-white/10 bg-white/10 text-brand-100">
            <ShieldCheck size={14} />
            Management access
          </span>
          <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-tight text-white">
            Every trip your drivers filed, on one screen.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-300">
            See who loaded today, the routes, seats and money generated. The call list of drivers
            who have not reported is right there.
          </p>
        </div>

        <p className="text-xs text-ink-400">DanRaph Transport, Enugu</p>
      </section>

      {/* Form side */}
      <section className="flex items-center justify-center px-5 py-10 lg:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="fade-up mt-8 lg:mt-0">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Admin sign in</h2>
            <p className="mt-1.5 text-sm text-ink-500">
              Use the email and password for your management account.
            </p>

            {sp.error ? (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
              >
                <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                <span>{sp.error}</span>
              </div>
            ) : null}

            <form action={loginAdmin} className="mt-6 space-y-4">
              <label className="block">
                <span className="label">Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="field field-lg"
                />
              </label>
              <label className="block">
                <span className="label">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                  className="field field-lg"
                />
              </label>
              <SubmitButton className="btn btn-dark btn-block btn-lg" pendingLabel="Signing in...">
                Sign in
              </SubmitButton>
            </form>

            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"
            >
              <ArrowLeft size={15} />
              Driver sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}