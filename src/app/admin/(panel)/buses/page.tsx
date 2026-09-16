import { sql } from 'drizzle-orm';
import { BusFront, TriangleAlert } from 'lucide-react';
import { db } from '@/db';
import { buses, drivers } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { createBus, updateBus } from '@/app/actions/trips';
import { SubmitButton } from '@/components/submit-button';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'Buses' };

export default async function AdminBuses({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const rows = await db
    .select({
      id: buses.id,
      label: buses.label,
      seatCapacity: buses.seatCapacity,
      status: buses.status,
      notes: buses.notes,
      driverCount: sql<number>`(
        SELECT count(*)::int FROM ${drivers}
        WHERE ${drivers.assignedBusId} = ${buses.id} AND ${drivers.status} = 'active'
      )`,
    })
    .from(buses)
    .orderBy(buses.label);

  // Buses list pagination.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-4xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink-900">
          <BusFront size={22} className="text-brand-600" />
          Buses
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Add each bus here first, then assign it to a driver.
        </p>
      </header>

      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-4 text-base font-bold text-ink-900">Add a bus</h2>
        <form
          action={async (formData: FormData) => {
            'use server';
            const result = await createBus(formData);
            if (!result.ok) {
              const { redirect } = await import('next/navigation');
              redirect('/admin/buses?error=' + encodeURIComponent(result.error));
            }
          }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <label className="block">
            <span className="label">Label</span>
            <input name="label" required placeholder="PMT 4018" className="field" />
          </label>
          <label className="block">
            <span className="label">Seat capacity</span>
            <input
              type="number"
              name="seatCapacity"
              min={1}
              max={200}
              required
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Notes</span>
            <input name="notes" placeholder="optional" className="field" />
          </label>
          <div className="flex items-end">
            <SubmitButton className="btn btn-primary btn-block" pendingLabel="Adding...">
              Add bus
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="space-y-3">
        {pageRows.map((b) => (
          <form
            key={b.id}
            action={async (formData: FormData) => {
              'use server';
              const result = await updateBus(formData);
              if (!result.ok) {
                const { redirect } = await import('next/navigation');
                redirect('/admin/buses?error=' + encodeURIComponent(result.error));
              }
            }}
            className="card grid items-end gap-3 p-4 sm:grid-cols-5"
          >
            <input type="hidden" name="busId" value={b.id} />
            <label className="block">
              <span className="label">Label</span>
              <input name="label" defaultValue={b.label} required className="field" />
            </label>
            <label className="block">
              <span className="label">Seats</span>
              <input
                type="number"
                name="seatCapacity"
                min={1}
                defaultValue={b.seatCapacity}
                required
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select name="status" defaultValue={b.status} className="field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Notes</span>
              <input name="notes" defaultValue={b.notes ?? ''} className="field" />
            </label>
            <div>
              <SubmitButton className="btn btn-outline btn-block" pendingLabel="Saving...">
                Save
              </SubmitButton>
              <p className="mt-1.5 text-xs text-ink-400">
                {b.driverCount} active driver{b.driverCount === 1 ? '' : 's'} assigned
              </p>
            </div>
          </form>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-300 bg-white/70 px-4 py-10 text-center text-sm font-medium text-ink-500">
            No buses yet. Add your first bus above.
          </p>
        ) : null}
      </div>
      <Pagination
        basePath="/admin/buses"
        page={page}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
      />
    </main>
  );
}