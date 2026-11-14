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
  BookOpen,
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
}

interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  shouldFollowUp: boolean;
  followUpQuestion?: string;
}

interface InterviewRoomProps {
  interview: {
    id: string;
    title: string;
    jobRole: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
    status: string;
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
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Question Timer
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech Recognition hook
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // Load or generate question on mount
  const fetchQuestion = useCallback(async () => {
    setIsLoadingQuestion(true);
    setError(null);
    setLastEvaluation(null);
    setAnswerText("");
    setCodeText("");
    resetTranscript();
    setSecondsElapsed(0);

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

      if (res.question) {
        setCurrentQuestion(res.question as QuestionData);
        setTotalQuestions(res.totalQuestions || 5);
        setAiStatus("speaking");
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

  // Question Stopwatch timer
  useEffect(() => {
    if (!isLoadingQuestion && !lastEvaluation && currentQuestion) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoadingQuestion, lastEvaluation, currentQuestion]);

  // Sync speech-to-text transcript into answer text
  useEffect(() => {
    if (transcript) {
      setAnswerText((prev) => {
        // Only append if it doesn't already end with transcript
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

  // Intercept paste event on answer input for anti-cheat audit
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.length > 50) {
      logActivityEvent({
        interviewId: interview.id,
        type: "PASTE",
        description: `Pasted ${pasted.length} characters into answer editor.`,
      });
    }
  };

  // Submit response & trigger evaluation
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
      });

      if (!result.success) {
        setError(result.error || "Failed to submit response.");
        setIsSubmitting(false);
        setAiStatus("idle");
        return;
      }

      if (result.evaluation) {
        setLastEvaluation(result.evaluation);
      }

      if (result.isCompleted) {
        // Completed all questions -> redirect to report after brief review
        setTimeout(() => {
          router.push(`/interview/${interview.id}/report`);
        }, 3000);
      }
    } catch {
      setError("An unexpected error occurred while evaluating your answer.");
    } finally {
      setIsSubmitting(false);
      setAiStatus("idle");
    }
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
          {/* Question Stopwatch */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--surface-border)] font-mono text-xs text-[var(--text-primary)]">
            <Clock size={13} className="text-[var(--text-tertiary)]" />
            <span>{formatTimer(secondsElapsed)}</span>
          </div>

          {/* Anti-cheat proctoring indicator */}
          <ProctoringGuard interviewId={interview.id} />
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): AI Avatar, Question Audio, Status */}
        <div className="lg:col-span-4 flex flex-col gap-5 sticky top-6">
          <div className="h-[320px]">
            <AIAvatar
              status={aiStatus}
              speechText={currentQuestion?.content}
              autoSpeak={true}
            />
          </div>

          {/* Progress Card */}
          <div className="card p-4 border border-[var(--surface-border)] rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Interview Progress</span>
              <span className="font-bold text-[var(--color-primary)]">
                Question {currentQuestion?.orderIndex || 1} of {totalQuestions}
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
          </div>
        </div>

        {/* Right Column (8 cols): Question Content, Input Area & Feedback */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {isLoadingQuestion ? (
            <div className="card-glass p-12 rounded-2xl border border-[var(--surface-border)] flex flex-col items-center justify-center gap-3 text-center min-h-[350px]">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                AI Interviewer is preparing your next question...
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Adapting question complexity based on your previous answers and target role.
              </p>
            </div>
          ) : currentQuestion ? (
            <>
              {/* Question Card */}
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

                {/* Question Text */}
                <h2 className="text-xl md:text-2xl font-bold leading-relaxed tracking-tight text-[var(--text-primary)]">
                  {currentQuestion.content}
                </h2>

                {/* Additional Context or Code Snippet */}
                {currentQuestion.context && (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
                    {currentQuestion.context}
                  </div>
                )}

                {/* Expected Topics Hint */}
                {currentQuestion.expectedTopics?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                      <BookOpen size={12} /> Expected Focus:
                    </span>
                    {currentQuestion.expectedTopics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--surface-border)]"
                      >
                        {topic}
                      </span>
                    ))}
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
              {!lastEvaluation ? (
                <div className="space-y-4">
                  {/* If Coding Question, render Live Code Editor */}
                  {currentQuestion.type === "CODING" && (
                    <div className="space-y-2">
                      <CodeEditor
                        value={codeText}
                        onChange={setCodeText}
                        language={codeLanguage}
                        onLanguageChange={setCodeLanguage}
                      />
                    </div>
                  )}

                  {/* Verbal / Written Answer Box */}
                  <div className="card p-4 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        {currentQuestion.type === "CODING" ? "Explanation / Approach" : "Candidate Response"}
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
                        onPaste={handlePaste}
                        rows={5}
                        placeholder={
                          isListening
                            ? "Listening to your voice... Speak clearly into your microphone."
                            : "Type your answer or click 'Answer with Voice' to speak..."
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
                        You can refine your transcribed text before submitting.
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
                            <span>AI Evaluating...</span>
                          </>
                        ) : (
                          <>
                            <span>Submit Answer</span>
                            <Send size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Instant Feedback Review Before Next Question */
                <div className="card-glass p-6 md:p-8 rounded-2xl border border-[var(--color-primary)] shadow-2xl space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-[var(--color-success)]" />
                      <h3 className="font-bold text-base text-[var(--text-primary)]">
                        Question Evaluation
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-sm">
                      <Sparkles size={14} />
                      <span>{lastEvaluation.score.toFixed(1)} / 10</span>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {lastEvaluation.feedback}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-[var(--color-success-subtle)] border border-[rgba(0,214,143,0.2)]">
                      <span className="font-semibold text-[var(--color-success)] block mb-1">
                        Demonstrated Strengths
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
                        {lastEvaluation.strengths.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--color-warning-subtle)] border border-[rgba(255,170,0,0.2)]">
                      <span className="font-semibold text-[var(--color-warning)] block mb-1">
                        Areas for Improvement
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
                        {lastEvaluation.weaknesses.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={fetchQuestion}
                      className="btn btn-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
                    >
                      <span>
                        {currentQuestion.orderIndex >= totalQuestions
                          ? "View Comprehensive Report"
                          : "Advance to Next Question"}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
