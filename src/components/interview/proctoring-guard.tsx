"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Maximize, Minimize } from "lucide-react";
import { logActivityEvent } from "@/actions/interview";

interface ProctoringPolicy {
  tabSwitchLimit?: number;
  blockPaste?: boolean;
  fullscreenRequired?: boolean;
}

interface ProctoringGuardProps {
  interviewId: string;
  onSecurityWarning?: (warning: string) => void;
  policy?: ProctoringPolicy | null;
}

export function ProctoringGuard({ interviewId, onSecurityWarning, policy }: ProctoringGuardProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<Record<string, number>>({});

  // Auto-request fullscreen if policy requires it (Item 7)
  useEffect(() => {
    if (policy?.fullscreenRequired && !document.fullscreenElement) {
      const enterFs = async () => {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
          }
        } catch {
          // User interaction required on some browsers
        }
      };
      enterFs();
    }
  }, [policy?.fullscreenRequired]);

  // Throttled logging helper: prevents event spamming (C6)
  const throttledLog = useCallback(
    (type: any, description: string, throttleMs: number = 3500) => {
      const now = Date.now();
      const last = lastEventTimeRef.current[type] || 0;
      if (now - last < throttleMs) {
        return false; // throttled
      }
      lastEventTimeRef.current[type] = now;
      logActivityEvent({
        interviewId,
        type,
        description,
      });
      return true;
    },
    [interviewId]
  );

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

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  };

  useEffect(() => {
    // 1. Tab Switch / Visibility Change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const nextCount = incidentCount + 1;
        const limit = policy?.tabSwitchLimit;
        if (throttledLog("TAB_SWITCH", `Candidate switched away from interview browser tab (incident #${nextCount}).`)) {
          if (limit && nextCount >= limit) {
            triggerWarning(`Security alert: Tab switch limit (${limit}) exceeded. Activity flagged for recruiter.`);
          } else {
            triggerWarning(`Tab switch detected (${nextCount}${limit ? `/${limit}` : ""}). Your activity is logged for recruiter audit.`);
          }
        }
      }
    };

    // 2. Window Blur (e.g. clicking off screen)
    const handleBlur = () => {
      throttledLog("WINDOW_BLUR", "Browser window lost focus.");
    };

    // 3. Fullscreen Change
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        if (throttledLog("FULLSCREEN_EXIT", "Candidate exited fullscreen assessment mode.")) {
          triggerWarning("You exited fullscreen mode. Please return to fullscreen view.");
        }
      }
    };

    // 4. Catch Paste and Copy (C6 / Policy Enforcement)
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (policy?.blockPaste) {
        e.preventDefault();
        throttledLog("PASTE", `Candidate attempt to paste ${text.length} characters was BLOCKED by proctoring policy.`);
        triggerWarning("Paste blocked: External clipboard pasting is prohibited by the recruiter's assessment policy.");
        return;
      }
      if (text.length > 25) {
        if (
          throttledLog(
            "PASTE",
            `Candidate pasted ${text.length} characters into answer/code editor.`
          )
        ) {
          triggerWarning(
            `Paste detected (${text.length} chars). External pasting is monitored and logged.`
          );
        }
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      const selected = window.getSelection()?.toString() || "";
      if (selected.length > 20) {
        throttledLog("COPY", `Candidate copied ${selected.length} characters from interview.`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("copy", handleCopy);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [throttledLog, triggerWarning]);

  return (
    <div className="flex items-center gap-2">
      {/* Fullscreen Toggle Button (C6) */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="btn btn-ghost btn-sm text-[11px] px-2 py-1 flex items-center gap-1 text-[var(--text-secondary)] border border-[var(--surface-border)] rounded-md"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen Mode"}
      >
        {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
        <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
      </button>

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
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-white text-xs font-semibold shadow-2xl animate-shake"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <AlertTriangle size={16} />
          <span>{warningMessage}</span>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="ml-2 opacity-80 hover:opacity-100 text-[11px] underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
