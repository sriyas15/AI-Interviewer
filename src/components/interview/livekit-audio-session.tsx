"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, RemoteTrackPublication, RemoteTrack, Track } from "livekit-client";
import { Mic, MicOff, Volume2, Wifi, WifiOff, Loader2 } from "lucide-react";

interface LiveKitAudioSessionProps {
  interviewId: string;
  onInterviewerSpeakingChange?: (isSpeaking: boolean) => void;
  onCandidateSpeakingChange?: (isSpeaking: boolean) => void;
}

export function LiveKitAudioSession({
  interviewId,
  onInterviewerSpeakingChange,
  onCandidateSpeakingChange,
}: LiveKitAudioSessionProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  const connectToRoom = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Fetch participant token and wsUrl from secure server route
      const res = await fetch(`/api/livekit/token?interviewId=${encodeURIComponent(interviewId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${res.status}`);
      }

      const { token, wsUrl } = await res.json();
      if (!token || !wsUrl) {
        throw new Error("Missing LiveKit connection parameters");
      }

      // 2. Initialize LiveKit WebRTC client room
      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Handle remote audio subscription (AI interviewer voice output)
      lkRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          if (audioContainerRef.current) {
            audioContainerRef.current.appendChild(audioElement);
          }
        }
      });

      lkRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      });

      // Handle active speakers (for interruption and voice indicators)
      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const isCandidateSpeaking = speakers.some((s) => s.isLocal);
        const isInterviewerSpeaking = speakers.some((s) => !s.isLocal);

        setIsSpeaking(isCandidateSpeaking);
        onCandidateSpeakingChange?.(isCandidateSpeaking);
        onInterviewerSpeakingChange?.(isInterviewerSpeaking);
      });

      lkRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
      });

      // 3. Connect to the room
      await lkRoom.connect(wsUrl, token);

      // 4. Enable microphone publication
      await lkRoom.localParticipant.setMicrophoneEnabled(true);

      setRoom(lkRoom);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err: any) {
      console.warn("LiveKit connection notice:", err.message);
      setError("WebRTC Voice Agent is operating in offline mode.");
      setIsConnecting(false);
    }
  }, [interviewId, onCandidateSpeakingChange, onInterviewerSpeakingChange]);

  useEffect(() => {
    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [connectToRoom]);

  const toggleMute = async () => {
    if (!room) return;
    const nextMute = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!nextMute);
    setIsMuted(nextMute);
  };

  return (
    <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--bg-secondary)] text-xs">
      <div ref={audioContainerRef} className="hidden" />

      {isConnecting ? (
        <span className="flex items-center gap-1.5 text-[var(--text-tertiary)] px-2">
          <Loader2 size={13} className="animate-spin text-[var(--color-primary)]" />
          <span>Connecting voice...</span>
        </span>
      ) : isConnected ? (
        <>
          <span className="flex items-center gap-1.5 text-[var(--color-success)] px-1.5 font-medium">
            <Wifi size={13} />
            <span>HD Voice Connected</span>
          </span>

          {isSpeaking && (
            <span className="flex items-center gap-1 text-[var(--color-primary)] font-semibold animate-pulse">
              <Volume2 size={13} />
              <span>Speaking</span>
            </span>
          )}

          <button
            type="button"
            onClick={toggleMute}
            className={`btn btn-xs flex items-center gap-1 ${
              isMuted ? "btn-danger" : "btn-secondary"
            }`}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
            <span>{isMuted ? "Muted" : "Mute"}</span>
          </button>
        </>
      ) : (
        <span className="flex items-center gap-1.5 text-[var(--text-tertiary)] px-2" title={error || "Voice fallback active"}>
          <WifiOff size={13} />
          <span>Speech Synthesis Fallback</span>
        </span>
      )}
    </div>
  );
}
