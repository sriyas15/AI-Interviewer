"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, RotateCcw, BrainCircuit } from "lucide-react";

export type AIStatus = "idle" | "speaking" | "listening" | "thinking";

interface AIAvatarProps {
  status: AIStatus;
  speechText?: string;
  autoSpeak?: boolean;
}

export function AIAvatar({ status, speechText, autoSpeak = true }: AIAvatarProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    if (isMuted || !text) {
      setIsPlayingAudio(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Daniel"))
    );
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  // Read question text when it updates
  useEffect(() => {
    if (autoSpeak && speechText) {
      speakText(speechText);
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechText, autoSpeak, speakText]);

  const toggleMute = () => {
    if (!isMuted) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      setIsMuted(true);
    } else {
      setIsMuted(false);
      if (speechText) speakText(speechText);
    }
  };

  const replay = () => {
    if (speechText) speakText(speechText);
  };

  const getStatusColor = () => {
    switch (status) {
      case "speaking":
        return "var(--color-primary)";
      case "listening":
        return "var(--color-success)";
      case "thinking":
        return "var(--color-warning)";
      default:
        return "var(--color-info)";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "speaking":
        return "AI Speaking";
      case "listening":
        return "Listening to Candidate";
      case "thinking":
        return "Evaluating Response...";
      default:
        return "AI Interviewer Ready";
    }
  };

  return (
    <div className="card-glass p-5 rounded-2xl border border-[var(--surface-border)] flex flex-col items-center justify-between text-center relative overflow-hidden h-full">
      {/* Top Status Bar */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: getStatusColor() }}
          />
          <span className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: getStatusColor() }}>
            {getStatusLabel()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={replay}
            title="Replay AI Voice"
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? "Unmute Voice" : "Mute Voice"}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {isMuted ? <VolumeX size={14} className="text-[var(--color-error)]" /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {/* Animated Orb / Avatar Sphere */}
      <div className="my-6 relative flex items-center justify-center">
        {/* Glow rings */}
        <div
          className={`absolute w-32 h-32 rounded-full transition-all duration-700 opacity-20 ${
            status === "speaking"
              ? "scale-125 animate-ping"
              : status === "thinking"
              ? "scale-110 animate-spin"
              : "scale-100"
          }`}
          style={{ background: getStatusColor() }}
        />
        <div
          className="absolute w-28 h-28 rounded-full blur-xl opacity-30 transition-all duration-500"
          style={{ background: getStatusColor() }}
        />

        {/* Central Core Sphere */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center relative shadow-2xl transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(30,30,50,0.9), rgba(15,15,25,0.95))",
            border: `2px solid ${getStatusColor()}`,
            boxShadow: `0 0 25px ${getStatusColor()}40`,
          }}
        >
          <BrainCircuit size={36} style={{ color: getStatusColor() }} />
        </div>

        {/* Audio Waveform Bars (Active when speaking) */}
        {(status === "speaking" || isPlayingAudio) && (
          <div className="absolute -bottom-4 flex items-end gap-1 h-5">
            <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
            <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ height: "100%", animationDelay: "150ms" }} />
            <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ height: "40%", animationDelay: "300ms" }} />
            <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ height: "80%", animationDelay: "100ms" }} />
            <span className="w-1 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ height: "50%", animationDelay: "250ms" }} />
          </div>
        )}
      </div>

      {/* Helpful Hint */}
      <p className="text-[11px] text-[var(--text-tertiary)] max-w-xs">
        {status === "listening"
          ? "Speak clearly into your microphone or type your response below."
          : status === "speaking"
          ? "AI is reading the question. Listen carefully or read the prompt on screen."
          : status === "thinking"
          ? "AI is analyzing your explanation and evaluating core technical accuracy."
          : "Take a moment to formulate your answer, then click submit."}
      </p>
    </div>
  );
}
