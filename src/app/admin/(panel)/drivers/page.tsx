import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { ArrowRight, BadgeCheck, KeyRound, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { db } from '@/db';
import { drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { createDriver } from '@/app/actions/trips';
import { SubmitButton } from '@/components/submit-button';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'Drivers' };

export default async function AdminDrivers({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // Both queries go out as ONE database round trip (neon-http batch).
  const [rows, busList] = await db.batch([
    db
      .select({
        id: drivers.id,
        name: users.name,
        phone: drivers.phone,
        status: drivers.status,
        isActive: users.isActive,
        hasPin: sql<boolean>`${drivers.pinHash} IS NOT NULL`,
        busLabel: buses.label,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
      .orderBy(users.name),
    db
      .select({ id: buses.id, label: buses.label })
      .from(buses)
      .where(eq(buses.status, 'active'))
      .orderBy(buses.label),
  ] as const);

  const activeCount = rows.filter((r) => r.status === 'active' && r.isActive).length;

  // Drivers list pagination.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink-900">
          <Users size={22} className="text-brand-600" />
          Drivers
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {activeCount} active of {rows.length} total
        </p>
      </header>

      {sp.added ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <BadgeCheck size={17} />
          Driver added. They can now sign in with their phone number and choose a PIN.
        </div>
      ) : null}
      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink-900">
          <UserPlus size={17} className="text-brand-600" />
          Add a driver
        </h2>
        <form
          action={async (formData: FormData) => {
            'use server';
            const result = await createDriver(formData);
            if (result.ok) {
              redirect('/admin/drivers?added=1');
            }
            redirect('/admin/drivers?error=' + encodeURIComponent(result.error));
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="block">
            <span className="label">Full name</span>
            <input name="name" required placeholder="Chidi Okafor" className="field" />
          </label>
          <label className="block">
            <span className="label">Phone number</span>
            <input name="phone" type="tel" required placeholder="0803 123 4567" className="field" />
          </label>
          <label className="block">
            <span className="label">Bus</span>
            <select name="busId" defaultValue="" className="field">
              <option value="">No bus yet</option>
              {busList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <SubmitButton className="btn btn-primary btn-block" pendingLabel="Adding...">
              Add driver
            </SubmitButton>
          </div>
        </form>
      </section>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Bus</th>
              <th>PIN</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((d) => (
              <tr key={d.id} className={d.status === 'inactive' || !d.isActive ? 'opacity-50' : ''}>
                <td className="font-semibold whitespace-nowrap">{d.name}</td>
                <td className="whitespace-nowrap text-ink-600 tabular-nums">{d.phone}</td>
                <td className="whitespace-nowrap">
                  {d.busLabel ? (
                    <span className="chip chip-info">{d.busLabel}</span>
                  ) : (
                    <span className="text-ink-400">-</span>
                  )}
                </td>
                <td>
                  {d.hasPin ? (
                    <span className="chip chip-ok">
                      <KeyRound size={11} />
                      Set
                    </span>
                  ) : (
                    <span className="chip chip-warn">Not yet</span>
                  )}
                </td>
                <td>
                  {d.status === 'active' && d.isActive ? (
                    <span className="chip chip-ok">Active</span>
                  ) : (
                    <span className="chip chip-info">Inactive</span>
                  )}
                </td>
                <td className="text-right">
                  <Link
                    href={`/admin/drivers/${d.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Manage
                    <ArrowRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-500">
                  No drivers yet. Add your first driver above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath="/admin/drivers"
        page={page}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
      />
    </main>
  );
}