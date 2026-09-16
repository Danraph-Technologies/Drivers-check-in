import Link from 'next/link';
import type { ReactNode } from 'react';

/** Labeled form field wrapper used across admin and driver forms. */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass = 'field';
export const inputLgClass = 'field field-lg';

export const primaryButtonClass = 'btn btn-primary btn-block btn-lg';
export const secondaryButtonClass = 'btn btn-outline btn-block btn-lg';

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="chip chip-bad w-full rounded-xl px-4 py-3 text-sm">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="status" className="chip chip-ok w-full rounded-xl px-4 py-3 text-sm">
      {message}
    </div>
  );
}

/** Section heading with an optional right-hand action and a soft rule. */
export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {backLabel ?? 'Back'}
          </Link>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Metric tile: label, big value, optional hint and icon. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'plain' | 'brand' | 'amber' | 'dark';
}) {
  const tones = {
    plain: 'card',
    brand: 'card border-brand-200 bg-gradient-to-b from-brand-50 to-white',
    amber: 'card border-amber-200 bg-gradient-to-b from-amber-50 to-white',
    dark: 'panel-dark border border-ink-900 text-white',
  } as const;

  return (
    <div className={`${tones[tone]} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-bold tracking-wide uppercase ${
            tone === 'dark' ? 'text-ink-300' : 'text-ink-500'
          }`}
        >
          {label}
        </span>
        {icon ? (
          <span className={tone === 'dark' ? 'text-brand-300' : 'text-brand-600'} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${
          tone === 'dark' ? 'text-white' : 'text-ink-900'
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className={`mt-1 text-xs ${tone === 'dark' ? 'text-ink-400' : 'text-ink-500'}`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white/70 px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink-500">{children}</p>
    </div>
  );
}

/** Small helper for a right-aligned money cell. */
export function Naira({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      <span className="text-ink-400">&#8358;</span>
      {value.toLocaleString('en-NG')}
    </span>
  );
}