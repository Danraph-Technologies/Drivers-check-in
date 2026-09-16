'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/**
 * Submit button for any server-action form. Disables itself and shows a
 * spinner while the action is pending, so double clicks never fire twice.
 */
export function SubmitButton({
  children,
  className = 'btn btn-primary',
  pendingLabel = 'Working...',
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
