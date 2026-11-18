"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to telemetry / console
    console.error("[Application Error Boundary caught error]:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="card-glass max-w-md w-full p-8 border border-[var(--surface-border)] rounded-2xl shadow-2xl text-center flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
          <AlertCircle size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            An unexpected error occurred while rendering this page. Your session progress has been saved.
          </p>
          {error.digest && (
            <p className="text-[10px] text-[var(--text-tertiary)] font-mono">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary flex-1 py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            <span>Try Again</span>
          </button>
          <Link
            href="/dashboard"
            className="btn btn-secondary flex-1 py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

