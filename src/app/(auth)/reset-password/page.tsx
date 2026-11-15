"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { resetPasswordAction } from "@/actions/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    !token ? "Missing or invalid password reset token." : null
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Live password validation checks
  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Reset token is missing. Please request a new link.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not satisfy all security requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await resetPasswordAction({
        token,
        password,
        confirmPassword,
      });

      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/login?reset=true");
        }, 2500);
      } else {
        setError(res.error || "Failed to reset password.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="card-glass auth-card animate-slide-up">
      <div className="auth-header">
        <Link href="/" className="brand-icon" aria-label="Home">
          <BrainCircuit size={32} />
        </Link>
        <h1>Create New Password</h1>
        <p>Set a strong, new password for your account</p>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {isSuccess && (
        <div className="auth-alert auth-alert-success">
          <CheckCircle2 size={16} />
          <span>Password reset successfully! Redirecting to login...</span>
        </div>
      )}

      {isSuccess ? (
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link href="/login?reset=true" className="btn btn-primary" style={{ width: "100%" }}>
            <span>Sign In Now</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              New Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || !token}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Criteria checklist */}
            {password.length > 0 && (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.25rem",
                }}
              >
                <span
                  style={{
                    color: passwordChecks.length ? "var(--color-success)" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {passwordChecks.length ? <Check size={12} /> : <X size={12} />} 8+ chars
                </span>
                <span
                  style={{
                    color: passwordChecks.uppercase ? "var(--color-success)" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {passwordChecks.uppercase ? <Check size={12} /> : <X size={12} />} 1 uppercase
                </span>
                <span
                  style={{
                    color: passwordChecks.lowercase ? "var(--color-success)" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {passwordChecks.lowercase ? <Check size={12} /> : <X size={12} />} 1 lowercase
                </span>
                <span
                  style={{
                    color: passwordChecks.number ? "var(--color-success)" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {passwordChecks.number ? <Check size={12} /> : <X size={12} />} 1 number
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading || !token}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={isLoading || !token}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Updating Password...</span>
              </>
            ) : (
              "Save New Password"
            )}
          </button>
        </form>
      )}

      <div className="auth-footer">
        Back to <Link href="/login">Sign In</Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass auth-card text-center py-12">
          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
