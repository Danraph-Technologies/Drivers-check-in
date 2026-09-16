import Link from 'next/link';

/**
 * Link-based pagination row (no JavaScript needed, same style as the
 * period chips). Renders nothing for a single page. The page window shows
 * the first and last page plus the pages around the current one, with
 * everything in between collapsed to dots.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  totalItems,
  pageSize,
  extra = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  extra?: Record<string, string | undefined>;
}) {
  // Nothing to show on an empty list; the page's empty state covers it.
  if (totalItems === 0) return null;

  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  const wanted: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) wanted.push(p);
  }
  const items: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of wanted) {
    if (p - prev > 1) items.push('gap');
    items.push(p);
    prev = p;
  }

  const linkCls = (active: boolean) =>
    `inline-flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition ${
      active
        ? 'border-ink-900 bg-ink-900 text-white'
        : 'border-ink-200 bg-white text-ink-600 hover:border-ink-400'
    }`;

  // One page still shows the count so the list size is visible; the
  // page buttons themselves only appear when there is more than one page.
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pages">
      <p className="text-xs font-semibold text-ink-400">
        Showing {start} to {end} of {totalItems}
      </p>
      {totalPages <= 1 ? null : (
      <div className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkCls(false)}>
            Prev
          </Link>
        ) : null}
        {items.map((it, i) =>
          it === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-ink-300">
              ...
            </span>
          ) : (
            <Link
              key={it}
              href={hrefFor(it)}
              aria-current={it === page ? 'page' : undefined}
              className={linkCls(it === page)}
            >
              {it}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={linkCls(false)}>
            Next
          </Link>
        ) : null}
      </div>
      )}
    </nav>
  );
}
