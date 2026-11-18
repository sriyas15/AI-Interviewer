"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrainCircuit, ArrowLeft, ArrowRight, Loader2, Sparkles, Code2, ShieldAlert } from "lucide-react";
import { createPracticeInterviewAction } from "@/actions/interview";

export default function PracticeModePage() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState("Frontend Developer");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartPractice = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await createPracticeInterviewAction({
        jobRole,
        difficulty,
        topics: [jobRole, "Core Competencies", "Algorithms"],
      });
      if (res.success && res.interviewId) {
        router.push(`/interview/${res.interviewId}/start`);
      } else {
        setError(res.error || "Failed to start practice interview session.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full card-glass p-6 md:p-8 rounded-2xl border border-[var(--surface-border)] shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-xs text-[var(--text-tertiary)] hover:text-white flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <span className="badge badge-primary text-[10px] font-bold">Self-Service Practice</span>
        </div>

        <div>
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-3">
            <BrainCircuit size={26} />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Practice Interview Mode</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Simulate a real technical assessment. In practice mode, progressive hints and immediate feedback are available without penalty or recruiter disclosure.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block text-[var(--text-secondary)] mb-1.5">Target Job Role</label>
            <select
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            >
              <option value="Frontend Developer">Frontend Developer (React / TypeScript)</option>
              <option value="Backend Engineer">Backend Engineer (Node.js / Python / Distributed Systems)</option>
              <option value="Full Stack Developer">Full Stack Developer (Web / API / DB)</option>
              <option value="DevOps / Cloud Engineer">DevOps & Cloud Engineer (K8s / CI-CD)</option>
              <option value="Data Engineer">Data Engineer (SQL / Pipelines)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block text-[var(--text-secondary)] mb-1.5">Assessment Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(["EASY", "MEDIUM", "HARD"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setDifficulty(lvl)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    difficulty === lvl
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-white"
                      : "border-[var(--surface-border)] text-[var(--text-tertiary)] hover:border-white/20"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartPractice}
          disabled={isLoading}
          className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Initializing Practice Room...</span>
            </>
          ) : (
            <>
              <span>Begin Practice Session</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
