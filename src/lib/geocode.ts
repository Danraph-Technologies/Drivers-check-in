import 'server-only';

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const a =
    Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Best-effort reverse geocode of a GPS point into a short place name
 * ("Trans-Ekulu Extension, Enugu East, Enugu"). Uses the free
 * OpenStreetMap Nominatim service. Any failure returns null; this must
 * never block or fail a trip report.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
      `&format=jsonv2&addressdetails=1&zoom=17`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DanRaph-TripReport/1.0 (internal operations tool)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn(`[geocode] Nominatim returned ${res.status} for ${lat},${lng}`);
      return null;
    }
    const data = (await res.json()) as {
      address?: Record<string, string | undefined>;
      display_name?: string;
    };
    const a = data.address ?? {};

    // Build "Street/Suburb, City/Area, State" from whatever OSM has.
    const first =
      a.road || a.neighbourhood || a.suburb || a.residential || a.hamlet || a.quarter;
    const mid = a.city || a.town || a.municipality || a.county || a.state_district;
    const parts = [first, mid, a.state]
      .map((p) => p?.trim())
      .filter((p): p is string => Boolean(p));

    if (parts.length > 0) {
      // Drop duplicates (city == state etc.) while keeping order.
      const seen = new Set<string>();
      const unique = parts.filter((p) => {
        const key = p.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return unique.join(', ');
    }
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 3).join(',').trim();
    }
    return null;
  } catch (err) {
    console.warn('[geocode] lookup failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
