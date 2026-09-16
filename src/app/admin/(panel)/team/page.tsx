import { eq, desc } from 'drizzle-orm';
import { Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { changeOwnPassword, createAdmin, setAdminActive } from '@/app/actions/trips';
import { SubmitButton } from '@/components/submit-button';
import { Pagination } from '@/components/pagination';
import { formatDateTimeWAT } from '@/lib/time';

export const metadata = { title: 'Team' };

export default async function AdminTeam({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; page?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;

  const admins = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(desc(users.createdAt));

  // Admin list pagination.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(admins.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageAdmins = admins.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-4xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-ink-900">
          <ShieldCheck size={22} className="text-brand-600" />
          Admin team
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Other managers who can see everything and file reports.
        </p>
      </header>

      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}
      {sp.saved ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <Check size={17} />
          Password changed.
        </div>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-4 text-base font-bold text-ink-900">Add an admin</h2>
        <form
          action={async (formData: FormData) => {
            'use server';
            const result = await createAdmin(formData);
            if (!result.ok) {
              const { redirect } = await import('next/navigation');
              redirect('/admin/team?error=' + encodeURIComponent(result.error));
            }
          }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <label className="block">
            <span className="label">Name</span>
            <input name="name" required className="field" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required className="field" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="field"
            />
          </label>
          <div className="flex items-end">
            <SubmitButton className="btn btn-primary btn-block" pendingLabel="Adding...">
              Add admin
            </SubmitButton>
          </div>
        </form>
        <p className="mt-2.5 text-xs text-ink-400">
          Share the password privately. They sign in at /admin/login.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="text-base font-bold text-ink-900">Change my password</h2>
        <p className="mt-1 text-sm text-ink-500">
          You are signed in as {session.name}. Confirm your current password, then pick the new
          one. A simple password is fine as long as it is at least 8 characters.
        </p>
        <form
          action={async (formData: FormData) => {
            'use server';
            const result = await changeOwnPassword(formData);
            const { redirect } = await import('next/navigation');
            redirect(
              result.ok ? '/admin/team?saved=1' : '/admin/team?error=' + encodeURIComponent(result.error),
            );
          }}
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <label className="block">
            <span className="label">Current password</span>
            <input name="currentPassword" type="password" required className="field" />
          </label>
          <label className="block">
            <span className="label">New password</span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="field"
            />
          </label>
          <label className="block">
            <span className="label">Repeat new password</span>
            <input name="confirmPassword" type="password" required minLength={8} className="field" />
          </label>
          <div className="sm:col-span-3">
            <SubmitButton pendingLabel="Saving...">Change password</SubmitButton>
          </div>
        </form>
      </section>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Added</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageAdmins.map((a) => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-50'}>
                <td className="font-semibold whitespace-nowrap">{a.name}</td>
                <td className="text-ink-600">{a.email}</td>
                <td className="whitespace-nowrap text-ink-500">{formatDateTimeWAT(a.createdAt)}</td>
                <td>
                  {a.isActive ? (
                    <span className="chip chip-ok">Active</span>
                  ) : (
                    <span className="chip chip-info">Deactivated</span>
                  )}
                </td>
                <td className="text-right">
                  {a.isActive ? (
                    <form
                      action={async () => {
                        'use server';
                        const fd = new FormData();
                        fd.set('userId', a.id);
                        fd.set('active', 'false');
                        await setAdminActive(fd);
                      }}
                    >
                      <SubmitButton
                        className="text-sm font-semibold text-red-700 hover:underline underline-offset-2"
                        pendingLabel="Working..."
                      >
                        Deactivate
                      </SubmitButton>
                    </form>
                  ) : (
                    <form
                      action={async () => {
                        'use server';
                        const fd = new FormData();
                        fd.set('userId', a.id);
                        fd.set('active', 'true');
                        await setAdminActive(fd);
                      }}
                    >
                      <SubmitButton
                        className="text-sm font-semibold text-brand-700 hover:underline underline-offset-2"
                        pendingLabel="Working..."
                      >
                        Reactivate
                      </SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath="/admin/team"
        page={page}
        totalPages={totalPages}
        totalItems={admins.length}
        pageSize={PAGE_SIZE}
      />
    </main>
  );
}