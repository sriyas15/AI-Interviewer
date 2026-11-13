"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { registerSchema } from "@/lib/validations";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live password requirements
  const passwordCriteria = {
    length: formData.password.length >= 8,
    hasUpper: /[A-Z]/.test(formData.password),
    hasLower: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[^A-Za-z0-9]/.test(formData.password),
    isMatched:
      formData.confirmPassword.length > 0 &&
      formData.password === formData.confirmPassword,
  };

  const validateField = (
    field: "name" | "email" | "password" | "confirmPassword",
    value: string
  ) => {
    const testData = { ...formData, [field]: value };
    const result = registerSchema.safeParse(testData);

    if (result.success) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      return true;
    } else {
      const fieldError = result.error.flatten().fieldErrors[field]?.[0];
      setFieldErrors((prev) => ({ ...prev, [field]: fieldError }));
      return !fieldError;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(null);

    if (fieldErrors[name as keyof typeof fieldErrors]) {
      validateField(
        name as "name" | "email" | "password" | "confirmPassword",
        value
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate using Zod schema
    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: errors.name?.[0],
        email: errors.email?.[0],
        password: errors.password?.[0],
        confirmPassword: errors.confirmPassword?.[0],
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Call Register API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to create account.");
        setIsSubmitting(false);
        return;
      }

      // 2. Automatically sign in upon successful registration
      const loginResult = await signIn("credentials", {
        redirect: false,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        callbackUrl,
      });

      if (loginResult?.error) {
        // If auto-signin fails, redirect to login page with success flag
        router.push("/login?registered=true");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error occurred. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-glass p-8 shadow-2xl border border-[var(--surface-border)] rounded-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Create Your Account
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          Join AI Interviewer to practice with real-time AI simulations
        </p>
      </div>

      {/* General Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-xl bg-[var(--color-error-subtle)] border border-[rgba(255,71,87,0.3)] flex items-start gap-2.5 text-xs text-[var(--color-error)] animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <div className="space-y-4">
        <GoogleSignInButton callbackUrl={callbackUrl} label="Sign up with Google" />

        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-[var(--surface-border)] w-full" />
          <span className="bg-[var(--surface)] px-3 text-xs uppercase tracking-wider text-[var(--text-tertiary)] absolute">
            Or register with email
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={formData.name}
              onChange={handleChange}
              onBlur={() => validateField("name", formData.name)}
              placeholder="e.g. Alex Morgan"
              className={`input ${
                fieldErrors.name
                  ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[rgba(255,71,87,0.2)]"
                  : ""
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => validateField("email", formData.email)}
              placeholder="name@example.com"
              className={`input ${
                fieldErrors.email
                  ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[rgba(255,71,87,0.2)]"
                  : ""
              }`}
              disabled={isSubmitting}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password with Eye Toggle */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => validateField("password", formData.password)}
                placeholder="At least 8 characters"
                className={`input pr-10 ${
                  fieldErrors.password
                    ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[rgba(255,71,87,0.2)]"
                    : ""
                }`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {fieldErrors.password}
              </p>
            )}

            {/* Password Validation Checklist */}
            {formData.password.length > 0 && (
              <div className="mt-2.5 grid grid-cols-2 gap-1.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--surface-border)] text-[11px]">
                <div
                  className={`flex items-center gap-1 ${
                    passwordCriteria.length
                      ? "text-[var(--color-success)]"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {passwordCriteria.length ? (
                    <Check size={12} />
                  ) : (
                    <X size={12} />
                  )}
                  <span>8+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${
                    passwordCriteria.hasUpper && passwordCriteria.hasLower
                      ? "text-[var(--color-success)]"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {passwordCriteria.hasUpper && passwordCriteria.hasLower ? (
                    <Check size={12} />
                  ) : (
                    <X size={12} />
                  )}
                  <span>Uppercase & lowercase</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${
                    passwordCriteria.hasNumber
                      ? "text-[var(--color-success)]"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {passwordCriteria.hasNumber ? (
                    <Check size={12} />
                  ) : (
                    <X size={12} />
                  )}
                  <span>At least 1 number</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${
                    passwordCriteria.hasSpecial
                      ? "text-[var(--color-success)]"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {passwordCriteria.hasSpecial ? (
                    <Check size={12} />
                  ) : (
                    <X size={12} />
                  )}
                  <span>1 special symbol</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password with Eye Toggle */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={() =>
                  validateField("confirmPassword", formData.confirmPassword)
                }
                placeholder="Re-enter your password"
                className={`input pr-10 ${
                  fieldErrors.confirmPassword
                    ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[rgba(255,71,87,0.2)]"
                    : ""
                }`}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-[var(--color-error)]">
                {fieldErrors.confirmPassword}
              </p>
            )}
            {formData.confirmPassword.length > 0 &&
              !fieldErrors.confirmPassword &&
              passwordCriteria.isMatched && (
                <p className="mt-1 text-xs text-[var(--color-success)] flex items-center gap-1">
                  <Check size={12} />
                  <span>Passwords match</span>
                </p>
              )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full py-2.5 mt-2 font-medium flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>
      </div>

      {/* Switch to Login */}
      <div className="mt-6 text-center text-xs text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href={`/login${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="text-[var(--color-primary)] font-medium hover:underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass p-8 flex items-center justify-center min-h-[420px]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

