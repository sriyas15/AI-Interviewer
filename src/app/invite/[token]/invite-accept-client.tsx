"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { startInvitedInterviewAction } from "@/actions/invitation";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface InviteAcceptClientProps {
  token: string;
}

export function InviteAcceptClient({ token }: InviteAcceptClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Authenticate candidate with single-use invite token session
      await signIn("invite-token", { token, redirect: false });

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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
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

      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
        Clicking begin will launch your interactive interview and initialize the test environment.
      </p>
    </div>
  );
}

