"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { loginSchema } from "@/lib/validations";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const registered = searchParams.get("registered");
  const authError = searchParams.get("error");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    authError === "OAuthAccountNotLinked"
      ? "An account with this email already exists with a different sign-in method."
      : authError === "unauthorized"
      ? "You do not have administrative permission to view that page."
      : null
  );

  const validateField = (field: "email" | "password", value: string) => {
    const testData = { ...formData, [field]: value };
    const result = loginSchema.safeParse(testData);

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

    // Clear error dynamically if user fixes it
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      validateField(name as "email" | "password", value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate using Zod schema
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        password: errors.password?.[0],
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await signIn("credentials", {
        redirect: false,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        callbackUrl,
      });

      if (response?.error) {
        setErrorMessage("Invalid email or password. Please try again.");
        setIsSubmitting(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrorMessage("An unexpected authentication error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-glass p-8 shadow-2xl border border-[var(--surface-border)] rounded-2xl">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Welcome Back
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5">
          Sign in to access your interview practice sessions
        </p>
      </div>

      {/* Success Notification if redirected after registration */}
      {registered && (
        <div className="mb-5 p-3 rounded-xl bg-[var(--color-success-subtle)] border border-[rgba(0,214,143,0.3)] flex items-center gap-2.5 text-xs text-[var(--color-success)]">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>Account created successfully! You can now log in below.</span>
        </div>
      )}

      {/* General Error Banner */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-xl bg-[var(--color-error-subtle)] border border-[rgba(255,71,87,0.3)] flex items-start gap-2.5 text-xs text-[var(--color-error)] animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <div className="space-y-4">
        <GoogleSignInButton callbackUrl={callbackUrl} label="Sign in with Google" />

        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-[var(--surface-border)] w-full" />
          <span className="bg-[var(--surface)] px-3 text-xs uppercase tracking-wider text-[var(--text-tertiary)] absolute">
            Or continue with email
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
              <p className="mt-1 text-xs text-[var(--color-error)] flex items-center gap-1">
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          {/* Password with Eye Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => validateField("password", formData.password)}
                placeholder="Enter your password"
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
              <p className="mt-1 text-xs text-[var(--color-error)] flex items-center gap-1">
                <span>{fieldErrors.password}</span>
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
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>

      {/* Switch to Register */}
      <div className="mt-6 text-center text-xs text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href={`/register${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="text-[var(--color-primary)] font-medium hover:underline"
        >
          Sign up now
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass p-8 flex items-center justify-center min-h-[350px]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

