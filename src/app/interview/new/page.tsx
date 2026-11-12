import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, ArrowLeft } from "lucide-react";
import { InterviewSetupForm } from "@/components/interview/interview-setup-form";

// Requires auth — intentionally dynamic
export const instant = false;

export default async function NewInterviewPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="setup-page">
      {/* Nav */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <Link href="/" className="nav-brand">
            <BrainCircuit size={24} strokeWidth={1.5} />
            <span>AI Interviewer</span>
          </Link>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="setup-body">
        <div className="setup-header">
          <h1 className="dashboard-title">
            Configure Your{" "}
            <span className="text-gradient">Interview</span>
          </h1>
          <p className="dashboard-subtitle">
            Set your target role, difficulty, and topics — then jump into a
            live AI-powered practice session.
          </p>
        </div>

        <InterviewSetupForm />
      </div>
    </div>
  );
}
