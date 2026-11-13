import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  BrainCircuit,
  Shield,
  User as UserIcon,
  Play,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Role } from "@prisma/client";

async function DashboardContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const isAdmin = user.role === Role.ADMIN;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Ambient background */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>

      {/* Navigation */}
      <nav className="nav border-b border-[var(--surface-border)]">
        <div className="nav-inner max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary)]">
              <BrainCircuit size={20} strokeWidth={2} />
            </div>
            <span>AI Interviewer</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="btn btn-secondary btn-sm flex items-center gap-1.5 border-[rgba(255,170,0,0.3)] text-[var(--color-warning)]"
              >
                <Shield size={14} />
                <span>Admin Portal</span>
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 relative z-10">
        {/* Profile Banner */}
        <div className="card-glass p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[var(--surface-border)] rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--color-primary)] flex items-center justify-center overflow-hidden shrink-0">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || "User Avatar"}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon size={32} className="text-[var(--text-secondary)]" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold">{user.name || "Candidate"}</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    isAdmin
                      ? "bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border border-[rgba(255,170,0,0.3)]"
                      : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[rgba(108,92,231,0.3)]"
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="btn btn-secondary btn-sm">
              Home
            </Link>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <h2 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">
          Interview Workspace
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Card 1: Practice New Session */}
          <div className="card p-6 flex flex-col justify-between hover:border-[var(--color-primary)] transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center mb-4">
                <Play size={20} />
              </div>
              <h3 className="font-semibold text-base mb-1">Start New Interview</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Choose job role, technical topics, and difficulty level to begin an AI session.
              </p>
            </div>
            <button className="btn btn-primary btn-sm mt-6 w-full flex items-center justify-center gap-2">
              <span>Launch Session</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Card 2: Performance Reports */}
          <div className="card p-6 flex flex-col justify-between hover:border-[var(--color-primary)] transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[var(--color-success-subtle)] text-[var(--color-success)] flex items-center justify-center mb-4">
                <FileText size={20} />
              </div>
              <h3 className="font-semibold text-base mb-1">My Reports & Analytics</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Review scores, AI critique, strengths, and areas of improvement from previous interviews.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm mt-6 w-full flex items-center justify-center gap-2">
              <span>View History</span>
            </button>
          </div>

          {/* Card 3: Role Capabilities */}
          <div className="card p-6 flex flex-col justify-between hover:border-[var(--color-primary)] transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[rgba(52,152,219,0.15)] text-[var(--color-info)] flex items-center justify-center mb-4">
                <Sparkles size={20} />
              </div>
              <h3 className="font-semibold text-base mb-1">Role Permissions</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {isAdmin
                  ? "You have full administrator privileges across candidate sessions and platform analytics."
                  : "You have candidate privileges to take practice sessions and access your personal feedback."}
              </p>
            </div>
            <div className="mt-6 text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
              <Clock size={14} />
              <span>Session secured via NextAuth JWT</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
