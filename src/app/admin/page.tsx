import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  Shield,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminPortal } from "@/components/admin/admin-portal";

export const instant = false;

async function AdminContent() {
  const user = await getCurrentUser();

  // Enforce ADMIN role access control
  if (!user || user.role !== Role.ADMIN) {
    redirect("/dashboard?error=unauthorized");
  }

  // Fetch candidates and interview sessions
  const [candidates, interviews] = await Promise.all([
    db.user.findMany({
      where: { role: Role.CANDIDATE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        interviews: {
          select: {
            id: true,
            status: true,
            totalScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.interview.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        jobRole: true,
        difficulty: true,
        topics: true,
        status: true,
        totalScore: true,
        createdAt: true,
        completedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        report: {
          select: {
            overallScore: true,
          },
        },
        _count: {
          select: {
            questions: true,
            activities: true,
          },
        },
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
        <div className="nav-inner max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
            >
              <ArrowLeft size={14} />
              <span>Back to Candidate Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
              <Shield size={16} />
              <span>Admin Management Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
              Logged in as <strong className="text-[var(--text-primary)]">{user.email}</strong>
            </span>
            <SignOutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Recruiter &amp; Admin Workspace</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Access the complete candidate roster, audit interview submissions, examine proctoring activity, and inspect AI evaluation reports.
          </p>
        </div>

        {/* Interactive Candidate Roster & Interviews Portal */}
        <AdminPortal candidates={candidates} interviews={interviews} />
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
