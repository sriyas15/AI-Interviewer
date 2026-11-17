import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  BrainCircuit,
  ArrowLeft,
  User as UserIcon,
  Mail,
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Trash2,
  Clock,
} from "lucide-react";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";
import { requestDataDeletionAction } from "@/actions/settings";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, pendingDeletion] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        emailVerified: true,
        passwordHash: true,
        createdAt: true,
        _count: {
          select: { interviews: true },
        },
      },
    }),
    db.dataDeletionRequest.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  const isOAuthUser = !user.passwordHash;

  return (
    <div className="setup-page">
      {/* Navigation */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <div className="flex items-center gap-3">
            <Link href="/" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <Link
              href="/dashboard"
              className="btn btn-ghost btn-sm text-xs text-[var(--text-secondary)] flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ProfileDropdown user={user} showDashboardLink />
          </div>
        </div>
      </nav>

      {/* Main Settings Body */}
      <div className="setup-body" style={{ maxWidth: "760px", margin: "2rem auto" }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your personal profile, account credentials, and platform preferences.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* ─── Profile Overview Card ─── */}
          <div className="card p-6 border border-[var(--surface-border)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-4">
              Profile Information
            </h2>

            <div className="flex items-center gap-4">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[var(--surface-border)]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[var(--gradient-primary)] text-white font-bold flex items-center justify-center text-xl">
                  {(user.name?.[0] || user.email[0]).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{user.name || "Candidate"}</span>
                  <span
                    className={`badge text-[10px] ${
                      user.role === "ADMIN" ? "badge-warning" : "badge-primary"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{user.email}</div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Account Verification & Security ─── */}
          <div className="card p-6 border border-[var(--surface-border)] flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Security &amp; Credentials
            </h2>

            {/* Email Verification Status */}
            <div className="flex items-center justify-between p-3.5 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-lg">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-[var(--color-primary-light)]" />
                <div>
                  <div className="text-xs font-semibold">Email Verification</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {user.emailVerified
                      ? `Verified on ${new Date(user.emailVerified).toLocaleDateString()}`
                      : "Unverified email address"}
                  </div>
                </div>
              </div>

              {user.emailVerified ? (
                <span className="badge badge-success inline-flex items-center gap-1 text-[11px]">
                  <CheckCircle2 size={12} /> Verified
                </span>
              ) : (
                <Link
                  href={`/verify-email?email=${encodeURIComponent(user.email)}`}
                  className="btn btn-secondary btn-sm text-xs py-1"
                >
                  Verify Now
                </Link>
              )}
            </div>

            {/* Sign-in Method & Password */}
            <div className="flex items-center justify-between p-3.5 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-lg">
              <div className="flex items-center gap-3">
                <Key size={18} className="text-[var(--color-warning)]" />
                <div>
                  <div className="text-xs font-semibold">Sign-in Method</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {isOAuthUser
                      ? "Authenticated via Google OAuth provider"
                      : "Standard Email and Password"}
                  </div>
                </div>
              </div>

              {!isOAuthUser && (
                <Link
                  href="/forgot-password"
                  className="btn btn-secondary btn-sm text-xs py-1"
                >
                  Change Password
                </Link>
              )}
            </div>

            {/* Platform Role Permissions */}
            <div className="flex items-center justify-between p-3.5 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-lg">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-[var(--color-info)]" />
                <div>
                  <div className="text-xs font-semibold">Role Permissions</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {user.role === "ADMIN"
                      ? "Full system administrator access to all candidate rosters & reports"
                      : "Standard candidate access for mock technical interviews"}
                  </div>
                </div>
              </div>

              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn btn-primary btn-sm text-xs py-1">
                  Admin Portal
                </Link>
              )}
            </div>
          </div>

          {/* ─── Data Privacy & Deletion Request (GDPR / CCPA) ─── */}
          <div className="card p-6 border border-[var(--surface-border)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-error)] flex items-center gap-2">
                  <Trash2 size={16} />
                  <span>Privacy &amp; Data Deletion Request</span>
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Exercise your right to erasure (GDPR Article 17 / CCPA). You can request permanent deletion of all your interview recordings, AI evaluations, code submissions, and activity logs.
                </p>
              </div>
            </div>

            {pendingDeletion && pendingDeletion.status === "PENDING" ? (
              <div className="p-4 bg-[var(--color-warning-subtle)] border border-[rgba(255,170,0,0.3)] rounded-lg text-xs text-[var(--color-warning)] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Clock size={14} />
                  <span>Data Deletion Request Pending</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Submitted on {new Date(pendingDeletion.createdAt).toLocaleDateString()}. Our privacy compliance system processes pending deletion requests within 30 days.
                </p>
              </div>
            ) : pendingDeletion && pendingDeletion.status === "COMPLETED" ? (
              <div className="p-4 bg-[var(--color-success-subtle)] border border-[rgba(0,214,143,0.3)] rounded-lg text-xs text-[var(--color-success)] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>Data Deletion Completed</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Your historical assessment data was purged on {new Date(pendingDeletion.createdAt).toLocaleDateString()}.
                </p>
              </div>
            ) : (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const reason = formData.get("reason") as string;
                  await requestDataDeletionAction(reason);
                }}
                className="space-y-3 pt-2"
              >
                <div className="space-y-1">
                  <label htmlFor="reason" className="text-xs text-[var(--text-secondary)]">
                    Optional reason for deletion:
                  </label>
                  <input
                    id="reason"
                    name="reason"
                    type="text"
                    placeholder="e.g. Completed job search, privacy preferences..."
                    className="input text-xs w-full py-2 px-3"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    This action requests irreversible erasure of your assessment history.
                  </span>
                  <button
                    type="submit"
                    className="btn btn-sm text-xs py-1.5 px-3 bg-[rgba(255,71,87,0.15)] text-[var(--color-error)] border border-[rgba(255,71,87,0.3)] hover:bg-[rgba(255,71,87,0.25)]"
                  >
                    Request Data Deletion
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

