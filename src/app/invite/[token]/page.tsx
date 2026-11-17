import { getInvitationData } from "@/actions/invitation";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
} from "lucide-react";
import { InviteAcceptClient } from "./invite-accept-client";

export const instant = false;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const [{ invitation, accountStatus, error }, session] = await Promise.all([
    getInvitationData(token),
    auth(),
  ]);

  if (error === "INVITATION_NOT_FOUND" || !invitation) {
    return notFound();
  }

  const isExpired = error === "INVITATION_EXPIRED" || invitation.status === "EXPIRED";
  const isRevoked = invitation.status === "REVOKED";
  const isCompleted = invitation.status === "COMPLETED";

  return (
    <div className="auth-wrapper">
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>

      <div
        className="card-glass auth-card animate-slide-up"
        style={{ maxWidth: "560px", padding: "2.5rem 2rem" }}
      >
        <div className="auth-header">
          <div className="brand-icon">
            <BrainCircuit size={32} />
          </div>
          <h1>Technical Assessment Invitation</h1>
          <p>
            You have been invited by{" "}
            <strong>{invitation.invitedBy.name || invitation.invitedBy.email}</strong> to complete an
            interactive technical interview.
          </p>
        </div>

        {/* Status Alerts if not active */}
        {isExpired && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: "1.5rem" }}>
            <AlertCircle size={18} />
            <div>
              <strong>Invitation Expired:</strong> This single-use assessment link has expired.
              Please reach out to your recruiter to request a fresh invitation.
            </div>
          </div>
        )}

        {isRevoked && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: "1.5rem" }}>
            <AlertCircle size={18} />
            <div>
              <strong>Invitation Revoked:</strong> This invitation was canceled by the recruiter.
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="auth-alert auth-alert-success" style={{ marginBottom: "1.5rem" }}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Assessment Completed:</strong> You have already submitted this interview.
              Your evaluation is under review by the recruiting team.
            </div>
          </div>
        )}

        {/* Assessment Overview Card */}
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            marginBottom: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Target Job Role
            </span>
            <span
              className={`badge ${
                invitation.difficulty === "EASY"
                  ? "badge-success"
                  : invitation.difficulty === "MEDIUM"
                  ? "badge-warning"
                  : "badge-error"
              }`}
            >
              {invitation.difficulty} Difficulty
            </span>
          </div>

          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {invitation.jobRole}
          </div>

          {invitation.template?.title && (
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              Curriculum: <strong>{invitation.template.title}</strong>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              marginTop: "0.25rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--surface-border)",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Clock size={14} style={{ color: "var(--color-primary)" }} />
              <span>Duration: {invitation.template?.duration || 45} mins</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Calendar size={14} style={{ color: "var(--color-warning)" }} />
              <span>Valid Until: {new Date(invitation.expiresAt).toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Layers size={14} style={{ color: "var(--color-info)" }} />
              <span>Candidate: {invitation.candidateEmail}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Shield size={14} style={{ color: "var(--color-success)" }} />
              <span>Proctored Session</span>
            </div>
          </div>
        </div>

        {/* Start Assessment Action */}
        {!isExpired && !isRevoked && !isCompleted && (
          <InviteAcceptClient
            token={token}
            candidateEmail={invitation.candidateEmail}
            candidateName={invitation.candidateName || ""}
            sessionEmail={session?.user?.email || null}
            accountExists={accountStatus?.exists || false}
            hasPassword={accountStatus?.hasPassword || false}
          />
        )}

        <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          <Lock size={12} style={{ display: "inline", marginRight: "4px" }} />
          This is an exclusive single-use assessment link generated for <strong>{invitation.candidateEmail}</strong>.
        </div>
      </div>
    </div>
  );
}

