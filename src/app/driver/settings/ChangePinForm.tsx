'use client';

import { useState } from 'react';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { changeOwnPinAction } from './actions';

export default function ChangePinForm() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const pinInput =
    'field field-lg text-center tracking-[0.6em]';

  return (
    <form
      action={async (formData: FormData) => {
        setSaving(true);
        setError(null);
        const result = await changeOwnPinAction(formData);
        if (result.ok) {
          setSaved(true);
        } else {
          setError(result.error);
        }
        setSaving(false);
      }}
      className="space-y-4"
    >
      {saved ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800"
        >
          <BadgeCheck size={17} />
          Your PIN has been changed.
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <label className="block">
        <span className="label">Current PIN</span>
        <input
          name="currentPin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          placeholder="••••"
          required
          className={pinInput}
        />
      </label>
      <label className="block">
        <span className="label">New PIN</span>
        <input
          name="newPin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          placeholder="••••"
          required
          className={pinInput}
        />
      </label>
      <label className="block">
        <span className="label">Repeat new PIN</span>
        <input
          name="newPin2"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          placeholder="••••"
          required
          className={pinInput}
        />
      </label>
      <button type="submit" disabled={saving} className="btn btn-primary btn-block btn-lg">
        {saving ? 'Saving...' : 'Change PIN'}
      </button>
    </form>
  );
}