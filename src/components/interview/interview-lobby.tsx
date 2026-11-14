"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import { startInterviewSession } from "@/actions/interview";

interface InterviewLobbyProps {
  interview: {
    id: string;
    title: string;
    jobRole: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
    status: string;
  };
}

const DIFFICULTY_BADGES = {
  EASY: {
    label: "Easy",
    bg: "var(--color-success-subtle)",
    text: "var(--color-success)",
    border: "rgba(0, 214, 143, 0.3)",
  },
  MEDIUM: {
    label: "Medium",
    bg: "var(--color-warning-subtle)",
    text: "var(--color-warning)",
    border: "rgba(255, 170, 0, 0.3)",
  },
  HARD: {
    label: "Hard",
    bg: "var(--color-error-subtle)",
    text: "var(--color-error)",
    border: "rgba(255, 71, 87, 0.3)",
  },
};

export function InterviewLobby({ interview }: InterviewLobbyProps) {
  const router = useRouter();

  // Media states
  const [micStatus, setMicStatus] = useState<"untested" | "requesting" | "ready" | "denied">("untested");
  const [cameraStatus, setCameraStatus] = useState<"off" | "on" | "denied">("off");
  const [micVolume, setMicVolume] = useState<number>(0);
  const [soundTested, setSoundTested] = useState<boolean>(false);
  const [confirmedRules, setConfirmedRules] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up all streams and audio listeners when leaving the page
  const cleanupMedia = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // 1. Microphone Test & Volume Meter
  const requestMicrophone = async () => {
    try {
      setMicStatus("requesting");
      setError(null);

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Keep tracks alive
      if (!streamRef.current) {
        streamRef.current = audioStream;
      } else {
        audioStream.getAudioTracks().forEach((track) => streamRef.current?.addTrack(track));
      }

      // Initialize Web Audio API Analyser for Volume
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize 0 - 100 with sensitivity amplification
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setMicVolume(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
      setMicStatus("ready");
    } catch (err) {
      console.warn("Microphone access denied:", err);
      setMicStatus("denied");
      setError("Microphone permission was denied. Please allow microphone access in your browser settings.");
    }
  };

  // 2. Camera Preview Toggle
  const toggleCamera = async () => {
    if (cameraStatus === "on") {
      // Turn off camera tracks
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.stop();
          streamRef.current?.removeTrack(track);
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraStatus("off");
      return;
    }

    try {
      setError(null);
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
      });

      if (!streamRef.current) {
        streamRef.current = videoStream;
      } else {
        videoStream.getVideoTracks().forEach((track) => streamRef.current?.addTrack(track));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      setCameraStatus("on");
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err);
      setCameraStatus("denied");
      setError("Camera permission was denied or no webcam was detected.");
    }
  };

  // 3. Speaker / Audio Test Synthesizer
  const playTestSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      setSoundTested(true);
    } catch (err) {
      console.warn("Audio test sound failed:", err);
    }
  };

  // 4. Start Interview Session
  const handleStartInterview = async () => {
    setError(null);
    setIsLaunching(true);

    try {
      const result = await startInterviewSession(interview.id);

      if (!result.success) {
        setError(result.error || "Unable to start session.");
        setIsLaunching(false);
        return;
      }

      cleanupMedia();
      router.push(`/interview/${interview.id}`);
    } catch {
      setError("An unexpected error occurred while launching your session.");
      setIsLaunching(false);
    }
  };

  const badge = DIFFICULTY_BADGES[interview.difficulty] || DIFFICULTY_BADGES.MEDIUM;

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {/* Header Info Banner */}
      <div className="card-glass p-6 md:p-8 rounded-2xl border border-[var(--surface-border)] shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider border"
                style={{
                  background: badge.bg,
                  color: badge.text,
                  borderColor: badge.border,
                }}
              >
                {badge.label} Difficulty
              </span>
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock size={13} />
                ~20-30 Mins
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {interview.title}
            </h1>

            <p className="text-sm text-[var(--text-secondary)]">
              Target Role: <strong className="text-[var(--text-primary)] font-semibold">{interview.jobRole}</strong>
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col md:items-end gap-2">
            <span className="text-xs text-[var(--text-tertiary)] font-medium">Evaluation Focus:</span>
            <div className="flex flex-wrap gap-1.5 max-w-sm">
              {interview.topics.map((topic) => (
                <span
                  key={topic}
                  className="px-2.5 py-0.5 rounded-lg text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--surface-border)]"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-[var(--color-error-subtle)] border border-[rgba(255,71,87,0.3)] flex items-start gap-3 text-sm text-[var(--color-error)]">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Device Readiness & Environment Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Hardware Readiness Check */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="card p-6 border border-[var(--surface-border)] rounded-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles size={18} className="text-[var(--color-primary)]" />
                Equipment & Hardware Test
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Ensure your microphone, camera, and speakers are connected and functioning properly.
              </p>
            </div>

            {/* 1. Camera Mirror Test */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Video size={14} />
                  Camera Preview (Optional)
                </span>
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="btn btn-secondary btn-sm text-xs py-1.5 px-3"
                >
                  {cameraStatus === "on" ? (
                    <>
                      <VideoOff size={13} />
                      <span>Disable Camera</span>
                    </>
                  ) : (
                    <>
                      <Video size={13} />
                      <span>Test Camera</span>
                    </>
                  )}
                </button>
              </div>

              <div className="w-full aspect-video bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-xl overflow-hidden relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    cameraStatus === "on" ? "block" : "hidden"
                  }`}
                />
                {cameraStatus !== "on" && (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto text-[var(--text-tertiary)]">
                      <VideoOff size={22} />
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {cameraStatus === "denied"
                        ? "Camera access blocked. You can still proceed with audio only."
                        : "Camera is currently off. Click 'Test Camera' to preview your video."}
                    </p>
                  </div>
                )}
                {cameraStatus === "on" && (
                  <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-[var(--color-success)] flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                    Camera Active
                  </div>
                )}
              </div>
            </div>

            {/* 2. Microphone Test with Live Meter */}
            <div className="space-y-3 pt-2 border-t border-[var(--surface-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Mic size={14} />
                  Microphone Input (Required for voice)
                </span>
                {micStatus !== "ready" && (
                  <button
                    type="button"
                    onClick={requestMicrophone}
                    disabled={micStatus === "requesting"}
                    className="btn btn-secondary btn-sm text-xs py-1.5 px-3"
                  >
                    {micStatus === "requesting" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Mic size={13} />
                    )}
                    <span>{micStatus === "requesting" ? "Connecting..." : "Test Mic"}</span>
                  </button>
                )}
              </div>

              {micStatus === "ready" ? (
                <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[rgba(0,214,143,0.3)] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[var(--color-success)] font-medium">
                      <CheckCircle2 size={15} />
                      <span>Microphone Connected</span>
                    </div>
                    <span className="text-[var(--text-tertiary)] text-[11px]">Speak to test level</span>
                  </div>

                  {/* Audio Volume Bar */}
                  <div className="w-full bg-[var(--bg-primary)] h-2 rounded-full overflow-hidden border border-[var(--surface-border)]">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--color-success)] via-[var(--color-warning)] to-[var(--color-primary)] transition-all duration-75"
                      style={{ width: `${Math.max(5, micVolume)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <MicOff size={16} className="text-[var(--text-tertiary)]" />
                    <span>Microphone not yet tested</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-tertiary)]">Click &apos;Test Mic&apos;</span>
                </div>
              )}
            </div>

            {/* 3. Speaker / Audio Test */}
            <div className="space-y-3 pt-2 border-t border-[var(--surface-border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Volume2 size={14} />
                  Speaker / Audio Playback
                </span>
                <button
                  type="button"
                  onClick={playTestSound}
                  className="btn btn-secondary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Volume2 size={13} />
                  <span>Play Test Chime</span>
                </button>
              </div>

              {soundTested && (
                <div className="p-2.5 rounded-lg bg-[var(--color-success-subtle)] border border-[rgba(0,214,143,0.2)] text-[11px] text-[var(--color-success)] flex items-center gap-2">
                  <Check size={14} />
                  <span>Audio chime played. If you heard the tone, your speaker is ready!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Guidelines, Proctoring, and Launch */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Rules & Proctoring Card */}
          <div className="card p-6 border border-[var(--surface-border)] rounded-2xl flex flex-col gap-5">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldAlert size={18} className="text-[var(--color-warning)]" />
              Interview Guidelines
            </h2>

            <div className="space-y-3.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 text-[var(--color-primary)] font-bold text-[11px] mt-0.5">
                  1
                </div>
                <p>
                  <strong className="text-[var(--text-primary)]">Quiet Setting:</strong> Choose a well-lit and quiet space with minimal ambient background noise.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 text-[var(--color-primary)] font-bold text-[11px] mt-0.5">
                  2
                </div>
                <p>
                  <strong className="text-[var(--text-primary)]">Anti-Cheat Monitoring:</strong> Tab switching, leaving full screen, and clipboard copy/pastes are recorded as activity events.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 text-[var(--color-primary)] font-bold text-[11px] mt-0.5">
                  3
                </div>
                <p>
                  <strong className="text-[var(--text-primary)]">Voice or Code/Text:</strong> You can respond verbally using speech-to-text, or switch to typing code/text at any point.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 text-[var(--color-primary)] font-bold text-[11px] mt-0.5">
                  4
                </div>
                <p>
                  <strong className="text-[var(--text-primary)]">Take Your Time:</strong> Formulate your thoughts before submitting. You will receive real-time follow-ups.
                </p>
              </div>
            </div>

            {/* Connection Check */}
            <div className="pt-3 border-t border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1.5">
                <Wifi size={14} className="text-[var(--color-success)]" />
                Network Connection
              </span>
              <span className="text-[var(--color-success)] font-medium">Optimal</span>
            </div>

            {/* Confirmation Checkbox */}
            <label className="pt-2 flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedRules}
                onChange={(e) => setConfirmedRules(e.target.checked)}
                className="mt-0.5 rounded border-[var(--surface-border)] bg-[var(--bg-secondary)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                I have checked my microphone/speakers and agree to the simulation interview conditions.
              </span>
            </label>

            {/* Launch Action */}
            <button
              type="button"
              onClick={handleStartInterview}
              disabled={isLaunching || !confirmedRules}
              className="btn btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
            >
              {isLaunching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Initializing AI Room...</span>
                </>
              ) : (
                <>
                  <span>Enter Interview Room</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
