"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0a0a0f", color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ maxWidth: "420px", width: "100%", padding: "2rem", backgroundColor: "#12121a", border: "1px solid #262636", borderRadius: "1rem", textAlign: "center" }}>
            <div style={{ display: "inline-flex", padding: "0.75rem", borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", marginBottom: "1rem" }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>System Critical Error</h2>
            <p style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
              A critical application error interrupted the current request. Please refresh or try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                width: "100%",
                padding: "0.625rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#6366f1",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <RotateCcw size={14} />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
