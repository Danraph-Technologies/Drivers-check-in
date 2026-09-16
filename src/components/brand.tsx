import Link from 'next/link';

/**
 * DanRaph logo (wordmark + glyph) with the product caption.
 * onDark swaps to the white variant for dark panels.
 */
export function BrandMark({
  size = 'md',
  onDark = false,
}: {
  size?: 'md' | 'lg';
  onDark?: boolean;
}) {
  const imgH = size === 'lg' ? 'h-11' : 'h-8';
  return (
    <span className="inline-flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onDark ? '/logo-white.png' : '/logo.png'}
        alt="DanRaph Integrated Services"
        width={531}
        height={141}
        className={`${imgH} w-auto`}
      />
      <span
        className={`hidden border-l pl-3 text-xs font-bold tracking-wide uppercase sm:block ${
          onDark ? 'border-white/15 text-white/80' : 'border-ink-200 text-ink-500'
        }`}
      >
        Trip Report
      </span>
    </span>
  );
}

/** Marketing-ish footer line used on the sign-in screens. */
export function BrandFooter() {
  return (
    <p className="text-center text-xs text-ink-400">
      DanRaph Transport, Enugu{' '}
      <span className="mx-1 text-ink-300">&middot;</span>{' '}
      <Link href="/admin/login" className="font-semibold text-ink-400 hover:text-ink-700">
        Management sign in
      </Link>
    </p>
  );
}
