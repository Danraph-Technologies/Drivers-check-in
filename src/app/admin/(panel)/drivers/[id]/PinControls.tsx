'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/** Shows a generated PIN once, with a copy button. */
export function PinReveal({ pin }: { pin: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-xs font-bold tracking-wide text-amber-800 uppercase">New PIN</span>
      <span className="text-2xl font-extrabold tracking-[0.35em] text-amber-900">{pin}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pin);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // clipboard blocked; the PIN stays visible
          }
        }}
        className="btn btn-outline btn-sm ml-auto"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Confirm dialog wrapper for the PIN reset button. */
export function ResetPinButton({ resetAction }: { resetAction: () => Promise<string | null> }) {
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              'Reset this PIN? The driver will use this new PIN with their phone number to sign in.',
            )
          ) {
            return;
          }
          setBusy(true);
          setError(null);
          const newPin = await resetAction();
          if (newPin) {
            setPin(newPin);
          } else {
            setError('Could not reset the PIN. Try again.');
          }
          setBusy(false);
        }}
        className="btn btn-dark"
      >
        <KeyRound size={15} />
        {busy ? 'Resetting...' : 'Reset driver PIN'}
      </button>
      {pin ? <PinReveal pin={pin} /> : null}
      {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}