import { NextResponse } from 'next/server';
import { voidTrip, restoreTrip } from '@/app/actions/trips';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { voided?: boolean; reason?: string };
  try {
    body = (await request.json()) as { voided?: boolean; reason?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
  const reason = String(body.reason ?? '');
  const result = body.voided ? await restoreTrip(id, reason) : await voidTrip(id, reason);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
