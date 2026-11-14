import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, ArrowLeft } from "lucide-react";
import { InterviewLobby } from "@/components/interview/interview-lobby";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewStartPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const interview = await db.interview.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      jobRole: true,
      difficulty: true,
      topics: true,
      status: true,
      userId: true,
      createdAt: true,
    },
  });

  if (!interview) {
    notFound();
  }

  // Security check: Only the candidate who owns the interview can access it
  if (interview.userId !== session.user.id) {
    redirect("/dashboard");
  }

  // If already finished, redirect to dashboard/report
  if (interview.status === "COMPLETED") {
    redirect("/dashboard");
  }

  return (
    <div className="setup-page">
      {/* Top Navigation */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <Link href="/" className="nav-brand">
            <BrainCircuit size={24} strokeWidth={1.5} />
            <span>AI Interviewer</span>
          </Link>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            <span>Exit to Dashboard</span>
          </Link>
        </div>
      </nav>

      {/* Main Body */}
      <div className="setup-body" style={{ maxWidth: "1024px" }}>
        <InterviewLobby interview={interview} />
      </div>
    </div>
  );
}
