"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BrainCircuit, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";

function getSafeCallbackUrl(url: string | null): string {
  if (!url) return "/dashboard";
  // Prevent open redirect: must be a local relative path starting with '/', not '//' or '/\'
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const urlError = searchParams.get("error");
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "Authentication failed. Please check your credentials." : null
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError("Invalid email or password.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("Login submission error:", err);
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
        <h1>Welcome Back</h1>
        <p>Sign in to your account to continue</p>
      </div>

      {registered && (
        <div className="auth-alert auth-alert-success">
          <CheckCircle2 size={16} />
          <span>Account created successfully! Please sign in.</span>
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <GoogleButton callbackUrl={callbackUrl} />

      <div className="auth-divider">
        <span>or continue with email</span>
      </div>

      {/* Email / Password Form */}
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
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={isLoading}
          />
          {fieldErrors.email && <p className="form-error">{fieldErrors.email}</p>}
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
              autoComplete="current-password"
              placeholder="••••••••"
              className="input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
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
          {fieldErrors.password && <p className="form-error">{fieldErrors.password}</p>}
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
              <span>Signing In...</span>
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link href="/register">Create an account</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="card-glass auth-card text-center py-12">
          <Loader2 className="animate-spin mx-auto text-primary" size={24} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
