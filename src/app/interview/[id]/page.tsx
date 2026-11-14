import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, ArrowLeft, Radio, Sparkles } from "lucide-react";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewRoomPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          response: {
            include: {
              evaluation: true,
            },
          },
        },
      },
    },
  });

  if (!interview) {
    notFound();
  }

  if (interview.userId !== session.user.id) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* Interview Room Header */}
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface)] px-6 py-3.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn btn-ghost btn-sm text-xs">
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-[var(--surface-border)]" />
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BrainCircuit size={18} className="text-[var(--color-primary)]" />
            <span>{interview.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)] border border-[rgba(0,214,143,0.3)] font-medium">
            <Radio size={12} className="animate-pulse" />
            <span>Live Session</span>
          </div>
        </div>
      </header>

      {/* Main Room Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-subtle)] border border-[rgba(108,92,231,0.3)] flex items-center justify-center text-[var(--color-primary)] shadow-glow">
          <Sparkles size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Interview Session Initialized</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            You are ready to practice for <strong className="text-[var(--text-primary)]">{interview.jobRole}</strong>.
            The AI Question & Voice Evaluation engine is ready to be connected next.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {interview.topics.map((t) => (
            <span
              key={t}
              className="px-3 py-1 rounded-lg text-xs bg-[var(--bg-tertiary)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="pt-4 flex gap-3">
          <Link href={`/interview/${interview.id}/start`} className="btn btn-secondary btn-sm">
            Back to Equipment Lobby
          </Link>
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Return to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
