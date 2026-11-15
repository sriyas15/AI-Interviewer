"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  verifyEmailAction,
  resendVerificationEmailAction,
} from "@/actions/auth";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "prompt">(
    token ? "loading" : "prompt"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState(emailParam || "");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let mounted = true;

    async function verify() {
      try {
        const res = await verifyEmailAction(token!);
        if (!mounted) return;
        if (res.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(res.error || "Verification failed.");
        }
      } catch (err) {
        if (!mounted) return;
        console.error("Verification error:", err);
        setStatus("error");
        setErrorMessage("An unexpected error occurred.");
      }
    }

    verify();

    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    setResendStatus(null);
    setErrorMessage(null);

    try {
      const res = await resendVerificationEmailAction(resendEmail);
      if (res.success) {
        setResendStatus(
          "Verification link has been sent! Please check your inbox or terminal log."
        );
        if (res.previewUrl) {
          setPreviewUrl(res.previewUrl);
        }
      } else {
        setErrorMessage(res.error || "Failed to resend verification email.");
      }
    } catch (err) {
      console.error("Resend error:", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="card-glass auth-card animate-slide-up">
      <div className="auth-header">
        <Link href="/" className="brand-icon" aria-label="Home">
          <BrainCircuit size={32} />
        </Link>
        <h1>
          {status === "success"
            ? "Email Verified!"
            : status === "loading"
            ? "Verifying Email..."
            : "Verify Your Email"}
        </h1>
        <p>
          {status === "success"
            ? "Your email address has been confirmed successfully."
            : status === "loading"
            ? "Please wait while we confirm your email token."
            : "Confirm your email address to access all candidate features."}
        </p>
      </div>

      {status === "loading" && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <Loader2
            className="animate-spin"
            size={36}
            style={{ margin: "0 auto", color: "var(--color-primary)" }}
          />
          <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Validating verification token...
          </p>
        </div>
      )}

      {status === "success" && (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "rgba(0, 214, 143, 0.15)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            <CheckCircle2 size={32} />
          </div>

          <p style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", marginBottom: "1.75rem" }}>
            You can now sign in with your email and password to access your dashboard and take interviews.
          </p>

          <Link
            href="/login?verified=true"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.75rem" }}
          >
            <span>Proceed to Sign In</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {(status === "error" || status === "prompt") && (
        <div>
          {errorMessage && (
            <div className="auth-alert auth-alert-error">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {resendStatus && (
            <div className="auth-alert auth-alert-success">
              <CheckCircle2 size={16} />
              <span>{resendStatus}</span>
            </div>
          )}

          {previewUrl && (
            <div
              style={{
                background: "rgba(108, 92, 231, 0.1)",
                border: "1px dashed var(--color-primary)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem",
                marginBottom: "1rem",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--color-primary-light)" }}>
                [Dev Quick-Link]:
              </span>{" "}
              <a
                href={previewUrl}
                style={{ color: "#a855f7", textDecoration: "underline", wordBreak: "break-all" }}
              >
                Click here to verify directly
              </a>
            </div>
          )}

          <div
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--surface-border)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <Mail size={20} style={{ color: "var(--color-primary)", marginTop: "2px", flexShrink: 0 }} />
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
              If you didn&apos;t receive a verification link or your link expired, enter your email below to request a new link.
            </p>
          </div>

          <form onSubmit={handleResend}>
            <div className="form-group">
              <label className="form-label" htmlFor="resend-email">
                Email Address
              </label>
              <input
                id="resend-email"
                type="email"
                required
                className="input"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                disabled={isResending}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Sending Link...</span>
                </>
              ) : (
                "Resend Verification Link"
              )}
            </button>
          </form>

          <div className="auth-footer">
            Remember your credentials? <Link href="/login">Sign in</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass auth-card text-center py-12">
          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

