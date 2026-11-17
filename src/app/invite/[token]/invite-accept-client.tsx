"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import {
  startInvitedInterviewAction,
  registerCandidateFromInviteAction,
} from "@/actions/invitation";
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User,
  LogOut,
  Check,
  X,
} from "lucide-react";

interface InviteAcceptClientProps {
  token: string;
  candidateEmail: string;
  candidateName: string;
  sessionEmail: string | null;
  accountExists: boolean;
  hasPassword: boolean;
}

export function InviteAcceptClient({
  token,
  candidateEmail,
  candidateName,
  sessionEmail,
  accountExists,
  hasPassword,
}: InviteAcceptClientProps) {
  const router = useRouter();

  // Authentication state
  const isMatchingUser =
    !!sessionEmail &&
    sessionEmail.toLowerCase().trim() === candidateEmail.toLowerCase().trim();
  const isMismatchedUser =
    !!sessionEmail &&
    sessionEmail.toLowerCase().trim() !== candidateEmail.toLowerCase().trim();

  // Form states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(candidateName || "");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live password validation checks
  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // ─────────────────────────────────────────────────────────────
  // Action: Launch interview for authenticated matching candidate
  // ─────────────────────────────────────────────────────────────
  async function handleLaunchAssessment() {
    setIsLoading(true);
    setError(null);
    setLoadingStep("Claiming invitation token & initializing session...");

    try {
      const res = await startInvitedInterviewAction(token);

      if (!res.success || !res.interviewId) {
        setError(res.error || "Failed to initialize interview. Please try again.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      setLoadingStep("Redirecting to system check & lobby...");
      // Always route to /start so candidate does mic/camera test & accepts consent
      router.push(`/interview/${res.interviewId}/start`);
    } catch (err: any) {
      console.error("handleLaunchAssessment error:", err);
      setError("An unexpected error occurred while launching the assessment.");
      setIsLoading(false);
      setLoadingStep(null);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action: Sign in existing candidate with password & launch
  // ─────────────────────────────────────────────────────────────
  async function handleSignInAndLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStep("Authenticating your credentials...");

    try {
      const signInRes = await signIn("credentials", {
        email: candidateEmail.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (!signInRes || signInRes.error) {
        setError("Incorrect password. Please verify your password or use Forgot Password.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      setLoadingStep("Setting up your assessment session...");
      const launchRes = await startInvitedInterviewAction(token);

      if (!launchRes.success || !launchRes.interviewId) {
        setError(launchRes.error || "Failed to initialize interview.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      router.push(`/interview/${launchRes.interviewId}/start`);
    } catch (err: any) {
      console.error("handleSignInAndLaunch error:", err);
      setError("Failed to sign in. Please try again.");
      setIsLoading(false);
      setLoadingStep(null);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action: Register new candidate, sign in, and launch
  // ─────────────────────────────────────────────────────────────
  async function handleRegisterAndLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Please ensure your password satisfies all security criteria.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setLoadingStep("Creating candidate profile...");

    try {
      // 1. Create account with verified email
      const regRes = await registerCandidateFromInviteAction({
        token,
        name: name.trim(),
        password,
        confirmPassword,
      });

      if (!regRes.success) {
        setError(regRes.error || "Failed to create candidate account.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      // 2. Sign in immediately to establish session cookie
      setLoadingStep("Signing in to secure session...");
      const signInRes = await signIn("credentials", {
        email: candidateEmail.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (!signInRes || signInRes.error) {
        setError("Account created, but sign in failed. Please sign in to continue.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      // 3. Atomically claim invite & create interview
      setLoadingStep("Initializing assessment session...");
      const launchRes = await startInvitedInterviewAction(token);

      if (!launchRes.success || !launchRes.interviewId) {
        setError(launchRes.error || "Failed to start interview.");
        setIsLoading(false);
        setLoadingStep(null);
        return;
      }

      router.push(`/interview/${launchRes.interviewId}/start`);
    } catch (err: any) {
      console.error("handleRegisterAndLaunch error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
      setLoadingStep(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && (
        <div className="auth-alert auth-alert-error animate-slide-up">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENARIO 1: Matching Signed-in User
         ───────────────────────────────────────────────────────────── */}
      {isMatchingUser && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(0, 214, 143, 0.1)",
              border: "1px solid rgba(0, 214, 143, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <CheckCircle2 size={16} style={{ color: "var(--color-success)", flexShrink: 0 }} />
            <div style={{ fontSize: "0.8125rem", color: "var(--text-primary)" }}>
              Authenticated as <strong>{sessionEmail}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchAssessment}
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
                <span>{loadingStep || "Initializing..."}</span>
              </>
            ) : (
              <>
                <span>Begin Assessment (System Check)</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENARIO 2: Mismatched Signed-in User
         ───────────────────────────────────────────────────────────── */}
      {isMismatchedUser && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 170, 0, 0.1)",
              border: "1px solid rgba(255, 170, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-warning)", fontWeight: 600, fontSize: "0.875rem" }}>
              <AlertCircle size={16} />
              <span>Account Mismatch</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              You are signed in as <strong>{sessionEmail}</strong>, but this invitation was sent to <strong>{candidateEmail}</strong>.
              To claim and complete this assessment, please sign out and continue as the invited candidate.
            </p>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: window.location.href })}
            className="btn btn-secondary"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <LogOut size={16} />
            <span>Sign Out &amp; Switch Account</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENARIO 3: Signed-out with Existing Account
         ───────────────────────────────────────────────────────────── */}
      {!sessionEmail && accountExists && (
        <form onSubmit={handleSignInAndLaunch} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--surface-border)",
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Welcome back! An account with <strong>{candidateEmail}</strong> is already registered. Enter your password to sign in and begin your assessment.
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter your account password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
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
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a
              href="/forgot-password"
              target="_blank"
              style={{ fontSize: "0.75rem", color: "var(--color-primary-light)", textDecoration: "underline" }}
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
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
                <span>{loadingStep || "Signing in..."}</span>
              </>
            ) : (
              <>
                <span>Sign In &amp; Begin Assessment</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCENARIO 4: Signed-out without Account (New Candidate)
         ───────────────────────────────────────────────────────────── */}
      {!sessionEmail && !accountExists && (
        <form onSubmit={handleRegisterAndLaunch} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(108, 92, 231, 0.1)",
              border: "1px solid rgba(108, 92, 231, 0.25)",
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Set a password below to create your candidate account and securely store your assessment results.
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Your full name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              readOnly
              className="input"
              value={candidateEmail}
              disabled
              style={{ opacity: 0.8, cursor: "not-allowed", backgroundColor: "var(--bg-secondary)" }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-password">
              Create Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="At least 8 characters"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="confirm-password">
              Confirm Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="Re-enter your password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
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
            disabled={isLoading}
            className="btn btn-primary btn-lg"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              fontWeight: 600,
              marginTop: "0.25rem",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{loadingStep || "Creating account..."}</span>
              </>
            ) : (
              <>
                <span>Create Account &amp; Begin Assessment</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Footer note */}
      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-tertiary)", margin: 0 }}>
        Next: You will complete a quick audio/camera check and review proctoring guidelines before questions begin.
      </p>
    </div>
  );
}
