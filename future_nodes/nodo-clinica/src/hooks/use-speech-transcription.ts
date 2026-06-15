"use client";

import { useEffect, useRef } from "react";
import { useConsultationStore } from "@/store/consultation-store";
import type { TranscriptionSegment } from "@/types";

interface UseSpeechTranscriptionOptions {
  enabled: boolean;
  onSegment?: (segment: TranscriptionSegment) => void;
}

function stopRecognitionInstance(rec: SpeechRecognition | null) {
  if (!rec) return;
  try {
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    rec.stop();
  } catch {
    /* already stopped */
  }
}

export function useSpeechTranscription({
  enabled,
  onSegment,
}: UseSpeechTranscriptionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(enabled);
  const onSegmentRef = useRef(onSegment);

  enabledRef.current = enabled;
  onSegmentRef.current = onSegment;

  useEffect(() => {
    if (!enabled) {
      stopRecognitionInstance(recognitionRef.current);
      recognitionRef.current = null;
      const { isTranscribing, setIsTranscribing } =
        useConsultationStore.getState();
      if (isTranscribing) setIsTranscribing(false);
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API no disponible en este navegador");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-ES";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        const segment: TranscriptionSegment = {
          speaker: "unknown",
          text: finalTranscript.trim(),
          timestamp: new Date().toISOString(),
        };
        useConsultationStore.getState().appendTranscription(segment);
        onSegmentRef.current?.(segment);
      }
    };

    recognition.onerror = () => {
      if (recognitionRef.current !== recognition) return;
      useConsultationStore.getState().setIsTranscribing(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !enabledRef.current) return;
      try {
        recognition.start();
      } catch {
        useConsultationStore.getState().setIsTranscribing(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      useConsultationStore.getState().setIsTranscribing(true);
    } catch {
      recognitionRef.current = null;
    }

    return () => {
      stopRecognitionInstance(recognition);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, [enabled]);

  return {};
}
