import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import ChangePinForm from './ChangePinForm';

export const metadata = { title: 'Change PIN' };

export default function DriverSettingsPage() {
  return (
    <main>
      <Link
        href="/driver"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
      >
        <ArrowRight size={14} className="rotate-180" />
        Home
      </Link>

      <header className="mb-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-900 text-white">
          <ShieldCheck size={20} />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900">Change my PIN</h1>
        <p className="mt-1 text-sm text-ink-500">
          This is the 4 digit PIN you use with your phone number to sign in.
        </p>
      </header>

      <div className="card p-5">
        <ChangePinForm />
      </div>

      <p className="mt-4 text-center text-xs text-ink-400">
        Forgot your PIN? Ask the admin to reset it for you.
      </p>
    </main>
  );
}