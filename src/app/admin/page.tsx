import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  Shield,
  Users,
  BrainCircuit,
  ArrowLeft,
  Calendar,
  Loader2,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

async function AdminContent() {
  const user = await getCurrentUser();

  // Enforce ADMIN role access control
  if (!user || user.role !== Role.ADMIN) {
    redirect("/dashboard?error=unauthorized");
  }

  // Fetch metrics for admin
  const [totalUsers, totalInterviews, recentUsers] = await Promise.all([
    db.user.count(),
    db.interview.count(),
    db.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Ambient background */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Navigation */}
      <nav className="nav border-b border-[var(--surface-border)]">
        <div className="nav-inner max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
              <Shield size={16} />
              <span>Admin Management Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SignOutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">System Administration</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Restricted role-based panel. Only users with role{" "}
            <span className="font-mono text-[var(--color-warning)]">ADMIN</span>{" "}
            can access this environment.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="card p-6 border border-[var(--surface-border)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
                Total Registered Users
              </span>
              <Users size={18} className="text-[var(--color-primary)]" />
            </div>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </div>

          <div className="card p-6 border border-[var(--surface-border)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
                Total Interviews Created
              </span>
              <BrainCircuit size={18} className="text-[var(--color-success)]" />
            </div>
            <div className="text-3xl font-bold">{totalInterviews}</div>
          </div>

          <div className="card p-6 border border-[var(--surface-border)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
                Current Admin User
              </span>
              <Shield size={18} className="text-[var(--color-warning)]" />
            </div>
            <div className="text-sm font-medium truncate">
              {user.name || user.email}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {user.email}
            </div>
          </div>
        </div>

        {/* Recent Registered Users */}
        <div className="card p-6 border border-[var(--surface-border)]">
          <h2 className="text-base font-semibold mb-4">Recent Platform Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--bg-secondary)]">
                    <td className="py-3 px-3 font-medium">{u.name || "N/A"}</td>
                    <td className="py-3 px-3 text-[var(--text-secondary)]">
                      {u.email}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          u.role === Role.ADMIN
                            ? "bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border border-[rgba(255,170,0,0.3)]"
                            : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[rgba(108,92,231,0.3)]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--text-secondary)] flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
