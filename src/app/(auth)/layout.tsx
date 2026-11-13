import Link from "next/link";
import { BrainCircuit, ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Orbs */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Top Bar */}
      <header className="p-6 relative z-10 flex items-center justify-between max-w-6xl mx-auto w-full">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary)] border border-[rgba(108,92,231,0.3)]">
            <BrainCircuit size={22} strokeWidth={2} />
          </div>
          <span>AI Interviewer</span>
        </Link>

        <Link
          href="/"
          className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Bottom Minimal Footer */}
      <footer className="py-4 text-center text-xs text-[var(--text-tertiary)] relative z-10">
        &copy; 2026 AI Interviewer. All rights reserved.
      </footer>
    </div>
  );
}
