"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// SpeechRecognition type definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = "";
          let finalChunk = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              finalChunk += item[0].transcript + " ";
            } else {
              currentInterim += item[0].transcript;
            }
          }

          if (finalChunk) {
            setTranscript((prev) => prev + finalChunk);
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (e) => {
          console.warn("[SPEECH_RECOGNITION] Error:", e);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    try {
      setInterimTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript("");
    } catch (e) {
      console.warn("Could not stop speech recognition:", e);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}
