"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { requestPasswordResetAction } from "@/actions/auth";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage(null);
    setPreviewUrl(null);

    try {
      const res = await requestPasswordResetAction({ email: email.trim() });
      if (res.success) {
        setStatus("success");
        setMessage(
          "If an account exists with that email address, a password reset link has been sent. Please check your inbox or terminal log."
        );
        if (res.previewUrl) {
          setPreviewUrl(res.previewUrl);
        }
      } else {
        setStatus("error");
        setMessage(res.error || "Failed to process request.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <div className="card-glass auth-card animate-slide-up">
      <div className="auth-header">
        <Link href="/" className="brand-icon" aria-label="Home">
          <BrainCircuit size={32} />
        </Link>
        <h1>Reset Password</h1>
        <p>Enter your email to receive a password reset link</p>
      </div>

      {status === "error" && message && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{message}</span>
        </div>
      )}

      {status === "success" && message && (
        <div className="auth-alert auth-alert-success">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {previewUrl && (
        <div
          style={{
            background: "rgba(108, 92, 231, 0.1)",
            border: "1px dashed var(--color-primary)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem",
            marginBottom: "1.25rem",
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
            Click here to reset password directly
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Sending Reset Link...</span>
            </>
          ) : (
            <>
              <Mail size={16} />
              <span>Send Reset Link</span>
            </>
          )}
        </button>
      </form>

      <div className="auth-footer" style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
        <Link
          href="/login"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass auth-card text-center py-12">
          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
