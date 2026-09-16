'use client';

import { useState } from 'react';
import { RotateCcw, Trash2, TriangleAlert } from 'lucide-react';

export function VoidButton({ tripId, voided }: { tripId: string; voided: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-5 hairline pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn btn-sm ${voided ? 'btn-outline' : 'btn-danger'}`}
      >
        {voided ? <RotateCcw size={14} /> : <Trash2 size={14} />}
        {voided ? 'Restore report' : 'Void report'}
      </button>

      {open ? (
        <div className="fade-up mt-3 max-w-md space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
          <label className="block">
            <span className="label">
              {voided ? 'Note for restoring' : 'Reason for voiding'}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              minLength={3}
              className="field"
              placeholder={
                voided ? 'Why is this report being restored?' : 'Why is this report being voided?'
              }
            />
          </label>
          {error ? (
            <p className="flex items-start gap-1.5 text-sm font-medium text-red-700">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch(`/admin/api/trips/${tripId}/void`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ voided, reason: reason.trim() }),
                });
                const data = (await res.json()) as { ok: boolean; error?: string };
                if (data.ok) {
                  window.location.reload();
                  return;
                }
                setError(data.error ?? 'Something went wrong.');
              } catch {
                setError('Network problem. Try again.');
              }
              setBusy(false);
            }}
            className={`btn ${voided ? 'btn-primary' : 'btn-danger'}`}
          >
            {busy ? 'Working...' : voided ? 'Confirm restore' : 'Confirm void'}
          </button>
        </div>
      ) : null}
    </div>
  );
}