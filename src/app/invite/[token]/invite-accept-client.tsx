"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { startInvitedInterviewAction } from "@/actions/invitation";
import { ArrowRight, Loader2, AlertCircle, AlertTriangle, UserCheck } from "lucide-react";

interface InviteAcceptClientProps {
  token: string;
  candidateEmail: string;
  candidateName?: string | null;
  currentSessionEmail?: string | null;
}

export function InviteAcceptClient({
  token,
  candidateEmail,
  candidateName,
  currentSessionEmail,
}: InviteAcceptClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMismatchedUser =
    currentSessionEmail &&
    currentSessionEmail.toLowerCase().trim() !== candidateEmail.toLowerCase().trim();

  async function handleStart() {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Authenticate candidate with single-use invite token session
      const signInResult = await signIn("invite-token", { token, redirect: false });
      if (signInResult?.error) {
        setError("Failed to authenticate invitation token. Link may have expired.");
        setIsLoading(false);
        return;
      }

      // 2. Atomically claim invitation and initialize session
      const result = await startInvitedInterviewAction(token);

      if (!result.success || !result.interviewId) {
        setError(result.error || "Failed to initialize interview. Please try again.");
        setIsLoading(false);
        return;
      }

      // 3. Route candidate into the pre-flight Lobby (/start) for equipment checks & consent
      router.push(`/interview/${result.interviewId}/start`);
    } catch (err: any) {
      console.error("handleStart error:", err);
      setError("An unexpected error occurred while launching the assessment.");
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Account Mismatch Warning */}
      {isMismatchedUser ? (
        <div
          className="auth-alert auth-alert-warning"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.85rem 1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "#f59e0b" }}>
            <AlertTriangle size={18} />
            <span>Different Account Detected</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
            You are currently signed in as <strong>{currentSessionEmail}</strong>. This assessment was issued exclusively to <strong>{candidateEmail}</strong>.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/invite/${token}` })}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem" }}
            >
              Sign Out &amp; Switch
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.75rem" }}
            >
              {isLoading ? "Starting..." : `Proceed as ${candidateEmail}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {currentSessionEmail && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                color: "var(--color-success)",
                backgroundColor: "rgba(0, 214, 143, 0.1)",
                padding: "0.4rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(0, 214, 143, 0.2)",
              }}
            >
              <UserCheck size={14} />
              <span>
                Verified Account: <strong>{candidateEmail}</strong>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={isLoading}
            className="btn btn-primary btn-lg"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              fontWeight: 600,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Setting up your session...</span>
              </>
            ) : (
              <>
                <span>Begin Assessment Now</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </>
      )}

      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
        Clicking begin will launch your interactive interview and initialize the test environment.
      </p>
    </div>
  );
}

