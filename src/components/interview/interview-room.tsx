"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Code2,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { AIAvatar, AIStatus } from "./ai-avatar";
import { CodeEditor } from "./code-editor";
import { ProctoringGuard } from "./proctoring-guard";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  getOrGenerateNextQuestion,
  submitAnswerAndEvaluate,
  logActivityEvent,
} from "@/actions/interview";

interface QuestionData {
  id: string;
  orderIndex: number;
  type: "TECHNICAL" | "BEHAVIORAL" | "CODING" | "SYSTEM_DESIGN";
  content: string;
  context: string | null;
  expectedTopics: string[];
  hints?: string[];
  testCases?: any;
  starterCode?: any;
}

interface InterviewRoomProps {
  interview: {
    id: string;
    title: string;
    jobRole: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
    status: string;
    durationMinutes?: number;
    startedAt?: string | Date | null;
  };
}

export function InterviewRoom({ interview }: InterviewRoomProps) {
  const router = useRouter();

  // Current session states
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(5);
  const [answerText, setAnswerText] = useState<string>("");
  const [codeText, setCodeText] = useState<string>("");
  const [codeLanguage, setCodeLanguage] = useState<string>("javascript");
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State Machine: Follow-up tracking (C2)
  const [followUpCount, setFollowUpCount] = useState<number>(0);
  const [activeFollowUpPrompt, setActiveFollowUpPrompt] = useState<string | null>(null);

  // Real Test Case summary from CodeEditor (Item 1)
  const [testCaseSummary, setTestCaseSummary] = useState<{ passed: number; total: number } | null>(null);

  // Runtime Proctoring Policy (Item 7)
  const [proctoringPolicy, setProctoringPolicy] = useState<any>(null);

  // Capped Hints State with Per-Question Hints & Scoring Penalty
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [revealedHints, setRevealedHints] = useState<string[]>([]);
  const [showHintConfirm, setShowHintConfirm] = useState<boolean>(false);

  // Autosave Draft Notification (C3)
  const [draftRestored, setDraftRestored] = useState<boolean>(false);

  // Question Stopwatch & Stage Time Limit (C2)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const STAGE_TIME_LIMIT_SECS = 360; // 6 mins per stage
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Overall Assessment Countdown Timer
  const totalAssessmentDurationSecs = (interview.durationMinutes || 30) * 60;
  const [assessmentTimeRemaining, setAssessmentTimeRemaining] = useState<number>(() => {
    if (interview.startedAt) {
      const elapsedSecs = Math.floor((Date.now() - new Date(interview.startedAt).getTime()) / 1000);
      return Math.max(0, totalAssessmentDurationSecs - elapsedSecs);
    }
    return totalAssessmentDurationSecs;
  });

  // Speech Recognition hook (C8)
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Draft Key Helper (C3)
  const getDraftKey = (qId: string) => `interview_draft_${interview.id}_${qId}`;

  // Load next question or initialize
  const fetchQuestion = useCallback(async () => {
    setIsLoadingQuestion(true);
    setIsTransitioning(false);
    setError(null);
    setAnswerText("");
    setCodeText("");
    resetTranscript();
    setSecondsElapsed(0);
    setFollowUpCount(0);
    setActiveFollowUpPrompt(null);
    setTestCaseSummary(null);
    setHintsUsed(0);
    setRevealedHints([]);

    try {
      const res = await getOrGenerateNextQuestion(interview.id);

      if (!res.success) {
        setError(res.error || "Failed to load question.");
        setIsLoadingQuestion(false);
        return;
      }

      if (res.isCompleted) {
        router.push(`/interview/${interview.id}/report`);
        return;
      }

      if (res.proctoringPolicy) {
        setProctoringPolicy(res.proctoringPolicy);
      }

      if (res.question) {
        setCurrentQuestion(res.question as QuestionData);
        setTotalQuestions(res.totalQuestions || 5);
        setAiStatus("speaking");

        // Restore autosaved draft if exists (C3)
        try {
          const savedDraft = localStorage.getItem(getDraftKey(res.question.id));
          if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            if (parsed.answerText || parsed.codeText) {
              setAnswerText(parsed.answerText || "");
              setCodeText(parsed.codeText || "");
              setDraftRestored(true);
              setTimeout(() => setDraftRestored(false), 3500);
            }
          }
        } catch {
          // ignore draft read errors
        }
      }
    } catch {
      setError("Failed to load interview question. Please try refreshing.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [interview.id, resetTranscript, router]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  // Question Stopwatch timer & Stage Limit (C2)
  useEffect(() => {
    if (!isLoadingQuestion && !isTransitioning && currentQuestion) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoadingQuestion, isTransitioning, currentQuestion]);

  // Autosave Draft to LocalStorage whenever candidate types (C3)
  useEffect(() => {
    if (!currentQuestion || isLoadingQuestion || isTransitioning) return;

    if (answerText.trim() || codeText.trim()) {
      try {
        localStorage.setItem(
          getDraftKey(currentQuestion.id),
          JSON.stringify({ answerText, codeText, timestamp: Date.now() })
        );
      } catch {
        // quota errors ignored
      }
    }
  }, [answerText, codeText, currentQuestion, isLoadingQuestion, isTransitioning]);

  // Sync speech-to-text transcript into answer text (C8)
  useEffect(() => {
    if (transcript) {
      setAnswerText((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Sync AI status with mic state
  useEffect(() => {
    if (isListening) {
      setAiStatus("listening");
    } else if (aiStatus === "listening") {
      setAiStatus("idle");
    }
  }, [isListening, aiStatus]);

  // Overall Assessment Countdown Timer (enforces total assessment duration)
  useEffect(() => {
    const timer = setInterval(() => {
      setAssessmentTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit and conclude assessment when total time expires
          router.push(`/interview/${interview.id}/report`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interview.id, router]);

  // Submit response & trigger state machine transition (C2)
  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    if (isListening) stopListening();

    setIsSubmitting(true);
    setAiStatus("thinking");
    setError(null);

    const fullAnswer = answerText.trim() + (interimTranscript ? ` ${interimTranscript.trim()}` : "");

    try {
      const result = await submitAnswerAndEvaluate({
        interviewId: interview.id,
        questionId: currentQuestion.id,
        content: fullAnswer,
        code: currentQuestion.type === "CODING" ? codeText : null,
        language: currentQuestion.type === "CODING" ? codeLanguage : null,
        durationMs: secondsElapsed * 1000,
        hintsUsed,
        isFollowUp: !!activeFollowUpPrompt,
        followUpPrompt: activeFollowUpPrompt,
        testCasesPassed: currentQuestion.type === "CODING" ? testCaseSummary?.passed : undefined,
        testCasesTotal: currentQuestion.type === "CODING" ? testCaseSummary?.total : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to submit response.");
        setIsSubmitting(false);
        setAiStatus("idle");
        return;
      }

      // Clear autosaved draft upon successful submission (C3)
      try {
        localStorage.removeItem(getDraftKey(currentQuestion.id));
      } catch {
        // ignore
      }

      // Check if AI generated a follow-up and we haven't reached the 2-follow-up cap (C2)
      if (
        result.evaluation?.shouldFollowUp &&
        followUpCount < 2 &&
        result.evaluation.followUpQuestion
      ) {
        setFollowUpCount((prev) => prev + 1);
        setActiveFollowUpPrompt(result.evaluation.followUpQuestion);
        setAnswerText("");
        setAiStatus("speaking");
        setIsSubmitting(false);
        return;
      }

      // Candidate completed this question - clear follow-up state
      setActiveFollowUpPrompt(null);
      setFollowUpCount(0);
      setTestCaseSummary(null);

      // The room doesn't render per-question scores or feedback to avoid biasing the candidate or leaking rubrics.
      setIsTransitioning(true);

      if (result.isCompleted) {
        setTimeout(() => {
          router.push(`/interview/${interview.id}/report`);
        }, 1800);
      } else {
        setTimeout(() => {
          fetchQuestion();
        }, 1500);
      }
    } catch {
      setError("An unexpected error occurred while saving your answer.");
    } finally {
      setIsSubmitting(false);
      setAiStatus("idle");
    }
  };

  // Capped Hints Request Handler using per-question bank hints & logged penalty
  const handleUnlockHint = () => {
    if (hintsUsed >= 3 || !currentQuestion) return;

    const nextLevel = hintsUsed + 1;
    const qHints = currentQuestion.hints || [];
    let newHintText = "";

    if (nextLevel <= qHints.length && qHints[nextLevel - 1]) {
      newHintText = `[Hint ${nextLevel}] ${qHints[nextLevel - 1]}`;
    } else if (nextLevel === 1) {
      newHintText = `[Hint 1: Direction] Clarify constraints and formulate initial edge-case bounds for ${interview.jobRole}.`;
    } else if (nextLevel === 2) {
      newHintText = `[Hint 2: Strategy] Analyze space/time algorithmic trade-offs. Consider whether pre-computation, memoization, or pointer manipulation applies.`;
    } else {
      newHintText = `[Hint 3: Scaffold] Structure your modular functions, validate edge inputs, and draft clear invariants before submitting.`;
    }

    setHintsUsed(nextLevel);
    setRevealedHints((prev) => [...prev, newHintText]);
    setShowHintConfirm(false);

    // Log hint penalty activity event
    logActivityEvent({
      interviewId: interview.id,
      type: "HINT_REQUESTED",
      description: `Candidate requested Hint Level ${nextLevel} (-${nextLevel * 5}% scoring penalty applied).`,
    });
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "CODING":
        return { label: "Live Coding", color: "var(--color-primary)" };
      case "SYSTEM_DESIGN":
        return { label: "System Design", color: "var(--color-warning)" };
      case "BEHAVIORAL":
        return { label: "Behavioral", color: "var(--color-info)" };
      default:
        return { label: "Technical Deep-Dive", color: "var(--color-success)" };
    }
  };

  const timeRemainingSecs = Math.max(0, STAGE_TIME_LIMIT_SECS - secondsElapsed);
  const isTimeRunningLow = timeRemainingSecs <= 60;
  const isAssessmentTimeLow = assessmentTimeRemaining <= 300; // Under 5 minutes left

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Top Session Action Bar */}
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface)] px-6 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-tight">{interview.title}</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--surface-border)]">
            {interview.jobRole}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Draft Restored Pill (C3) */}
          {draftRestored && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
              <CheckCircle2 size={11} /> Unsaved draft restored
            </span>
          )}

          {/* Overall Assessment Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs ${
              isAssessmentTimeLow
                ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse font-bold"
                : "bg-[var(--bg-secondary)] border-[var(--surface-border)] text-[var(--text-primary)]"
            }`}
            title="Total Assessment Time Remaining"
          >
            <Clock size={13} className={isAssessmentTimeLow ? "text-red-400" : "text-[var(--color-primary)]"} />
            <span>Total: {formatTimer(assessmentTimeRemaining)}</span>
          </div>

          {/* Question Stopwatch */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--surface-border)] bg-[var(--bg-tertiary)] font-mono text-xs text-[var(--text-secondary)]"
            title="Current question elapsed time"
          >
            <span>Q: {formatTimer(secondsElapsed)}</span>
          </div>

          {/* Anti-cheat proctoring guard with fullscreen & throttling (C6 / Policy) */}
          <ProctoringGuard interviewId={interview.id} policy={proctoringPolicy} />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): AI Avatar, Question Audio, Status */}
        <div className="lg:col-span-4 flex flex-col gap-5 sticky top-6">
          <div className="h-[320px]">
            <AIAvatar
              status={aiStatus}
              speechText={activeFollowUpPrompt || currentQuestion?.content}
              autoSpeak={true}
            />
          </div>

          {/* Progress Card */}
          <div className="card p-4 border border-[var(--surface-border)] rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Assessment Progress</span>
              <span className="font-bold text-[var(--color-primary)]">
                Stage {currentQuestion?.orderIndex || 1} of {totalQuestions}
              </span>
            </div>

            <div className="w-full bg-[var(--bg-secondary)] h-2 rounded-full overflow-hidden border border-[var(--surface-border)]">
              <div
                className="h-full bg-[var(--gradient-primary)] transition-all duration-500"
                style={{
                  width: `${(((currentQuestion?.orderIndex || 1) - 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>

            {/* Capped Hints Section (C5) */}
            <div className="pt-2 border-t border-[var(--surface-border)] flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <Lightbulb size={13} style={{ color: hintsUsed > 0 ? "var(--color-warning)" : "inherit" }} />
                <span>Hints: <strong>{hintsUsed}/3</strong></span>
              </div>

              {hintsUsed < 3 && !isTransitioning && (
                <button
                  type="button"
                  onClick={() => setShowHintConfirm(true)}
                  className="btn btn-ghost btn-sm text-[11px] py-0.5 px-2 text-amber-400 hover:text-amber-300"
                >
                  Request Hint (-{(hintsUsed + 1) * 5}%)
                </button>
              )}
            </div>
          </div>

          {/* Revealed Hints Box (C5) */}
          {revealedHints.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs text-amber-200">
              <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                <Lightbulb size={13} />
                <span>Unlocked Guidance:</span>
              </div>
              {revealedHints.map((hint, hIdx) => (
                <p key={hIdx} className="text-[11px] leading-relaxed">
                  {hint}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (8 cols): Question Content, Input Area & Actions */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {isLoadingQuestion || isTransitioning ? (
            <div className="card-glass p-12 rounded-2xl border border-[var(--surface-border)] flex flex-col items-center justify-center gap-3 text-center min-h-[350px]">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {isTransitioning ? "Answer recorded. Advancing to next stage..." : "AI Interviewer is preparing your next question..."}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {isTransitioning ? "Transcripts and code saved successfully." : "Adapting question complexity based on your performance."}
              </p>
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question Card (C7: Clean question view with NO leaked rubric/expected focus) */}
              <div className="card-glass p-6 md:p-8 rounded-2xl border border-[var(--surface-border)] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
                      style={{
                        color: getQuestionTypeLabel(currentQuestion.type).color,
                        backgroundColor: "var(--bg-tertiary)",
                        border: `1px solid ${getQuestionTypeLabel(currentQuestion.type).color}40`,
                      }}
                    >
                      {getQuestionTypeLabel(currentQuestion.type).label}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      Question #{currentQuestion.orderIndex}
                    </span>
                  </div>
                </div>

                {/* Primary Question Text */}
                <h2 className="text-xl md:text-2xl font-bold leading-relaxed tracking-tight text-[var(--text-primary)]">
                  {currentQuestion.content}
                </h2>

                {/* Additional Context or Code Snippet */}
                {currentQuestion.context && (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
                    {currentQuestion.context}
                  </div>
                )}

                {/* Follow-up Question Callout (C2: State Machine Follow-Up Active) */}
                {activeFollowUpPrompt && (
                  <div className="p-4 rounded-xl bg-purple-500/15 border border-purple-500/35 space-y-1.5 animate-slide-up">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                      <Sparkles size={13} className="text-purple-400" />
                      <span>AI Follow-Up Inquiry (Follow-up {followUpCount} of 2)</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {activeFollowUpPrompt}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Please address this follow-up detail in your response below before moving forward.
                    </p>
                  </div>
                )}
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3.5 rounded-xl bg-[var(--color-error-subtle)] border border-[rgba(255,71,87,0.3)] text-xs text-[var(--color-error)] flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Response Workspace */}
              <div className="space-y-4">
                {/* If Coding Question, render Live Code Editor with Test Cases (C4) */}
                {currentQuestion.type === "CODING" && (
                  <div className="space-y-2">
                    <CodeEditor
                      value={codeText}
                      onChange={setCodeText}
                      language={codeLanguage}
                      onLanguageChange={setCodeLanguage}
                      sampleTestCases={currentQuestion.testCases || undefined}
                      onTestResultsChange={(s) => setTestCaseSummary({ passed: s.passed, total: s.total })}
                    />
                  </div>
                )}

                {/* Verbal / Written Answer Box (C8: Typing always works, voice as fallback) */}
                <div className="card p-4 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {currentQuestion.type === "CODING"
                        ? "Explanation & Tradeoffs (Type or Speak)"
                        : "Candidate Response (Type or Speak)"}
                    </span>

                    {/* Microphone Voice Capture Toggle */}
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={isListening ? stopListening : startListening}
                        className={`btn btn-sm text-xs py-1.5 px-3 flex items-center gap-2 transition-all ${
                          isListening
                            ? "bg-[var(--color-error)] text-white shadow-lg animate-pulse"
                            : "btn-secondary text-[var(--color-primary)] border-[rgba(108,92,231,0.3)]"
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff size={13} />
                            <span>Stop Recording</span>
                          </>
                        ) : (
                          <>
                            <Mic size={13} />
                            <span>Answer with Voice (STT)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={5}
                      placeholder={
                        isListening
                          ? "Listening to your voice... Speak clearly into your microphone."
                          : "Type your answer or click 'Answer with Voice' to speak... (Autosaved continuously)"
                      }
                      className="input w-full p-3 resize-y min-h-[120px] text-sm leading-relaxed"
                    />
                    {interimTranscript && (
                      <p className="text-xs text-[var(--color-primary)] italic px-2 mt-1 animate-pulse">
                        Transcribing: &quot;{interimTranscript}&quot;
                      </p>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                      <HelpCircle size={13} />
                      Closing or refreshing the tab will not lose your work (autosaved).
                    </span>

                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      disabled={isSubmitting || (!answerText.trim() && !codeText.trim())}
                      className="btn btn-primary px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>AI Recording...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {activeFollowUpPrompt
                              ? "Submit Follow-Up Answer"
                              : "Submit & Proceed"}
                          </span>
                          <Send size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>

      {/* ─── MODAL: Hint Confirmation (C5) ─── */}
      {showHintConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card card-glass"
            style={{ width: "100%", maxWidth: "420px", padding: "1.5rem", borderRadius: "var(--radius-lg)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: "var(--color-warning)" }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Request Hint Level {hintsUsed + 1}?</h3>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Requesting Hint {hintsUsed + 1} will reveal structured guidance, but will deduct{" "}
              <strong style={{ color: "var(--color-warning)" }}>{(hintsUsed + 1) * 5}%</strong> from this question&apos;s score.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setShowHintConfirm(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockHint}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)", color: "#000000" }}
              >
                Accept Penalty &amp; Reveal Hint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
