"use client";

import { useState } from "react";
import { updateCandidateDecisionAction } from "@/actions/admin";
import { CandidateDecision } from "@prisma/client";
import {
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  UserCheck,
  History,
  Loader2,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  originalScore: number | null;
  overrideScore: number | null;
  previousDecision: CandidateDecision | null;
  newDecision: CandidateDecision | null;
  notes: string | null;
  createdAt: Date;
  admin: {
    name: string | null;
    email: string;
  };
}

interface RecruiterDecisionCardProps {
  interviewId: string;
  currentDecision: CandidateDecision;
  currentScore: number | null;
  currentNotes: string | null;
  originalAiScore: number | null;
  auditLogs: AuditLogEntry[];
}

export function RecruiterDecisionCard({
  interviewId,
  currentDecision,
  currentScore,
  currentNotes,
  originalAiScore,
  auditLogs,
}: RecruiterDecisionCardProps) {
  const [decision, setDecision] = useState<CandidateDecision>(currentDecision);
  const [score, setScore] = useState<string>(
    typeof currentScore === "number" ? String(currentScore) : ""
  );
  const [notes, setNotes] = useState<string>(currentNotes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSaveDecision(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const numericScore = score.trim() !== "" ? Number(score) : undefined;

    const res = await updateCandidateDecisionAction({
      interviewId,
      decision,
      humanScore: numericScore,
      notes,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage("Recruiter decision and score override recorded in audit log.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error || "Failed to save human review.");
    }
  }

  return (
    <div
      className="card card-glass"
      style={{
        padding: "1.5rem",
        border: "1px solid var(--surface-border)",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <UserCheck size={18} style={{ color: "var(--color-primary)" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Human Recruiter Decision &amp; Audit (A6)</h3>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          AI suggests, a human decides
        </span>
      </div>

      {successMessage && (
        <div className="auth-alert auth-alert-success" style={{ margin: 0 }}>
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="auth-alert auth-alert-error" style={{ margin: 0 }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveDecision} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Decision Toggle Buttons */}
        <div>
          <label className="form-label" style={{ marginBottom: "0.5rem" }}>
            Hiring Recommendation Decision *
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setDecision(CandidateDecision.ADVANCE)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border:
                  decision === CandidateDecision.ADVANCE
                    ? "2px solid var(--color-success)"
                    : "1px solid var(--surface-border)",
                backgroundColor:
                  decision === CandidateDecision.ADVANCE
                    ? "rgba(0, 214, 143, 0.15)"
                    : "var(--bg-secondary)",
                color:
                  decision === CandidateDecision.ADVANCE
                    ? "var(--color-success)"
                    : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              <CheckCircle2 size={15} />
              <span>Advance (Select)</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision(CandidateDecision.HOLD)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border:
                  decision === CandidateDecision.HOLD
                    ? "2px solid var(--color-warning)"
                    : "1px solid var(--surface-border)",
                backgroundColor:
                  decision === CandidateDecision.HOLD
                    ? "rgba(255, 170, 0, 0.15)"
                    : "var(--bg-secondary)",
                color:
                  decision === CandidateDecision.HOLD
                    ? "var(--color-warning)"
                    : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              <Clock size={15} />
              <span>Hold (Waitlist)</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision(CandidateDecision.REJECT)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border:
                  decision === CandidateDecision.REJECT
                    ? "2px solid var(--color-error)"
                    : "1px solid var(--surface-border)",
                backgroundColor:
                  decision === CandidateDecision.REJECT
                    ? "rgba(255, 71, 87, 0.15)"
                    : "var(--bg-secondary)",
                color:
                  decision === CandidateDecision.REJECT
                    ? "var(--color-error)"
                    : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              <XCircle size={15} />
              <span>Reject</span>
            </button>
          </div>
        </div>

        {/* Score Override and Notes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
          <div>
            <label className="form-label">
              Recruiter Score Override (%)
              {typeof originalAiScore === "number" && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginLeft: "4px" }}>
                  (AI: {originalAiScore}%)
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder={typeof originalAiScore === "number" ? String(originalAiScore) : "0-100"}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="form-label">Recruiter Rationale &amp; Audit Notes</label>
            <input
              type="text"
              placeholder="e.g. Strong system design tradeoffs despite minor syntax issue..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving Review...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Save Human Decision</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Audit Log Timeline */}
      {auditLogs.length > 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--surface-border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            <History size={13} />
            <span>Recruiter Review Audit Trail ({auditLogs.length})</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  fontSize: "0.72rem",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(0,0,0,0.25)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-primary)" }}>{log.admin.name || log.admin.email}</strong>{" "}
                  set decision to{" "}
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        log.newDecision === "ADVANCE"
                          ? "var(--color-success)"
                          : log.newDecision === "HOLD"
                          ? "var(--color-warning)"
                          : "var(--color-error)",
                    }}
                  >
                    {log.newDecision}
                  </span>
                  {log.overrideScore !== null && ` (score: ${log.overrideScore}%)`}
                  {log.notes && ` — "${log.notes}"`}
                </div>
                <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

