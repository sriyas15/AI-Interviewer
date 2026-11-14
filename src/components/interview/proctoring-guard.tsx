"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { logActivityEvent } from "@/actions/interview";

interface ProctoringGuardProps {
  interviewId: string;
  onSecurityWarning?: (warning: string) => void;
}

export function ProctoringGuard({ interviewId, onSecurityWarning }: ProctoringGuardProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerWarning = useCallback(
    (msg: string) => {
      setWarningMessage(msg);
      setIncidentCount((prev) => prev + 1);
      if (onSecurityWarning) onSecurityWarning(msg);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setWarningMessage(null);
      }, 4500);
    },
    [onSecurityWarning]
  );

  useEffect(() => {
    // 1. Tab Switch / Visibility Change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        logActivityEvent({
          interviewId,
          type: "TAB_SWITCH",
          description: "Candidate switched browser tab or minimized window.",
        });
        triggerWarning("Tab switch detected. Please stay focused on the interview window.");
      }
    };

    // 2. Window Blur (e.g. clicking off screen)
    const handleBlur = () => {
      logActivityEvent({
        interviewId,
        type: "WINDOW_BLUR",
        description: "Browser window lost active focus.",
      });
    };

    // 3. Fullscreen Exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logActivityEvent({
          interviewId,
          type: "FULLSCREEN_EXIT",
          description: "Candidate exited fullscreen view.",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [interviewId, triggerWarning]);

  return (
    <div className="relative">
      {/* Discreet Proctoring Indicator */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--surface-border)]">
        {incidentCount === 0 ? (
          <>
            <ShieldCheck size={13} className="text-[var(--color-success)]" />
            <span>Proctoring Active</span>
          </>
        ) : (
          <>
            <ShieldAlert size={13} className="text-[var(--color-warning)]" />
            <span className="text-[var(--color-warning)]">
              {incidentCount} Flag{incidentCount > 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Floating Alert Toast when incident happens */}
      {warningMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[rgba(255,71,87,0.95)] backdrop-blur-md text-white text-xs font-semibold shadow-2xl animate-shake">
          <AlertTriangle size={16} />
          <span>{warningMessage}</span>
        </div>
      )}
    </div>
  );
}
