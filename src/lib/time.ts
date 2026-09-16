const LAGOS_TZ = 'Africa/Lagos';

/** Today's date in Lagos as yyyy-mm-dd. Never use the server clock directly for "today". */
export function lagosToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Current wall-clock time in Lagos as HH:mm (24h). */
export function lagosNowTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** Difference in whole days from the given date (yyyy-mm-dd) to today in Lagos. Negative = future. */
export function daysAgo(dateStr: string): number {
  const today = lagosToday();
  return Math.round(
    (new Date(today + 'T00:00:00Z').getTime() - new Date(dateStr + 'T00:00:00Z').getTime()) /
      86400000,
  );
}

/** Format yyyy-mm-dd for display, e.g. "Tue, 15 Sep 2026". */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr + 'T00:00:00Z'));
}

/** Format a UTC timestamp for display in Lagos time, e.g. "15 Sep 2026, 4:12 PM". */
export function formatDateTimeWAT(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** Format a UTC timestamp as Lagos wall-clock time only, e.g. "4:12 PM". */
export function formatTimeWAT(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** "1400" -> "2:00 PM". Input is HH:mm or HH:mm:ss in 24h. */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Current week (Monday to Sunday) in Lagos as [start, end], both yyyy-mm-dd. */
export function currentWeekRange(): [string, string] {
  const today = lagosToday();
  const d = new Date(today + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 = Sunday
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d.getTime() - daysToMonday * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

/** Format whole naira with thousands separators, e.g. 35000 -> "35,000". */
export function formatNaira(amount: number): string {
  return amount.toLocaleString('en-NG');
}

/** Monday of the week containing the given yyyy-mm-dd date. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  return new Date(d.getTime() - daysToMonday * 86400000).toISOString().slice(0, 10);
}

/** Dashboard/report period buckets. */
export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year';

export const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
];

const PERIOD_KEYS: string[] = PERIOD_OPTIONS.map((p) => p.key);

/** Read a period from search params, defaulting to today. */
export function parsePeriod(raw: string | undefined): Period {
  return PERIOD_KEYS.includes(raw ?? '') ? (raw as Period) : 'today';
}

/** Start and end date (yyyy-mm-dd, Lagos calendar) for a period. */
export function periodRange(period: Period): [string, string] {
  const today = lagosToday();
  const d = new Date(today + 'T00:00:00Z');
  switch (period) {
    case 'today':
      return [today, today];
    case 'yesterday': {
      const y = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
      return [y, y];
    }
    case 'week': {
      const dow = d.getUTCDay();
      const daysToMonday = dow === 0 ? 6 : dow - 1;
      const monday = new Date(d.getTime() - daysToMonday * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
    }
    case 'month': {
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    }
    case 'year': {
      const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
      return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
    }
  }
}

/** Human heading for a resolved range, e.g. "Tue, 15 Sep 2026" or "September 2026". */
export function periodHeading(period: Period | 'custom', from: string, to: string): string {
  switch (period) {
    case 'today':
    case 'yesterday':
      return formatDate(from);
    case 'week':
      return `${formatDate(from)} to ${formatDate(to)}`;
    case 'month':
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      }).format(new Date(from + 'T00:00:00Z'));
    case 'year':
      return from.slice(0, 4);
    case 'custom':
      return `${formatDate(from)} to ${formatDate(to)}`;
  }
}

/** Shorthand chip label under a heading, e.g. "Today", "This month". */
export function periodChipLabel(period: Period): string {
  return PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? 'Today';
}

/** Shift a yyyy-mm-dd date by n days. */
export function addDays(dateStr: string, n: number): string {
  return new Date(new Date(dateStr + 'T00:00:00Z').getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
}

/** Inclusive number of days between two yyyy-mm-dd dates. */
export function daysInclusive(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000,
  ) + 1;
}
