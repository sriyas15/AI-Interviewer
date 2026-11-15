"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainCircuit, AlertCircle, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { registerUser } from "@/actions/auth";

function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Live password validation checks
  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  function validate(): boolean {
    const errors: Record<string, string[]> = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = ["Name must be at least 2 characters"];
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errors.email = ["Please enter a valid email address"];
    }

    if (!isPasswordValid) {
      errors.password = ["Password does not meet all security requirements"];
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = ["Passwords do not match"];
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });

      if (!result.success) {
        setError(result.error || "Registration failed.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setIsLoading(false);
        return;
      }

      // Successful registration - redirect to verify-email prompt
      if (result.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      } else {
        router.push("/login?registered=true");
      }
    } catch (err) {
      console.error("Registration submission error:", err);
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
        <h1>Create an Account</h1>
        <p>Start practicing technical interviews with AI</p>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <GoogleButton text="Sign up with Google" />

      <div className="auth-divider">
        <span>or register with email</span>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="name">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: [] }));
            }}
            disabled={isLoading}
          />
          {fieldErrors.name?.[0] && (
            <p className="form-error">{fieldErrors.name[0]}</p>
          )}
        </div>

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
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: [] }));
            }}
            disabled={isLoading}
          />
          {fieldErrors.email?.[0] && (
            <p className="form-error">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: [] }));
              }}
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
          {fieldErrors.password?.[0] && (
            <p className="form-error">{fieldErrors.password[0]}</p>
          )}

          {/* Password criteria checklist */}
          {password.length > 0 && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
              <span style={{ color: passwordChecks.length ? "var(--color-success)" : "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {passwordChecks.length ? <Check size={12} /> : <X size={12} />} 8+ chars
              </span>
              <span style={{ color: passwordChecks.uppercase ? "var(--color-success)" : "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {passwordChecks.uppercase ? <Check size={12} /> : <X size={12} />} 1 uppercase
              </span>
              <span style={{ color: passwordChecks.lowercase ? "var(--color-success)" : "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {passwordChecks.lowercase ? <Check size={12} /> : <X size={12} />} 1 lowercase
              </span>
              <span style={{ color: passwordChecks.number ? "var(--color-success)" : "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {passwordChecks.number ? <Check size={12} /> : <X size={12} />} 1 number
              </span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <div className="password-input-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="input"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: [] }));
              }}
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
          {fieldErrors.confirmPassword?.[0] && (
            <p className="form-error">{fieldErrors.confirmPassword[0]}</p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Creating Account...</span>
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass auth-card text-center py-12">
          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
