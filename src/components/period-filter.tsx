import Link from 'next/link';
import { PERIOD_OPTIONS, type Period } from '@/lib/time';

/**
 * Row of period chips (Today / Yesterday / This week / This month / This year,
 * plus an optional Custom entry). Pure links, so it works without JavaScript.
 */
export function PeriodFilter({
  basePath,
  current,
  allowCustom = false,
  customFrom,
  customTo,
  extra = {},
}: {
  basePath: string;
  current: Period | 'custom';
  allowCustom?: boolean;
  customFrom?: string;
  customTo?: string;
  extra?: Record<string, string | undefined>;
}) {
  const hrefFor = (key: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
    q.set('period', key);
    if (key === 'custom' && customFrom && customTo) {
      q.set('from', customFrom);
      q.set('to', customTo);
    }
    return `${basePath}?${q.toString()}`;
  };

  const chip = (key: string, label: string, active: boolean) => (
    <Link
      key={key}
      href={hrefFor(key)}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
        active
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-400'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {PERIOD_OPTIONS.map((p) => chip(p.key, p.label, current === p.key))}
      {allowCustom ? chip('custom', 'Custom', current === 'custom') : null}
    </div>
  );
}
