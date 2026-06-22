"use client";

import { useEffect, useRef, useState } from "react";
import { useConsultationStore } from "@/store/consultation-store";
import type { TranscriptionSegment } from "@/types";
import {
  getSpeechRecognitionCtor,
  speechErrorMessage,
  SPEECH_LANG,
} from "@/lib/clinic/speech-recognition";

interface UseSpeechTranscriptionOptions {
  enabled: boolean;
  onSegment?: (segment: TranscriptionSegment) => void;
  /** Texto provisional mientras hablás (antes del resultado final). */
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
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
  onInterim,
  onError,
}: UseSpeechTranscriptionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(enabled);
  const onSegmentRef = useRef(onSegment);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  const [isSupported] = useState(() => getSpeechRecognitionCtor() != null);

  enabledRef.current = enabled;
  onSegmentRef.current = onSegment;
  onInterimRef.current = onInterim;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) {
      stopRecognitionInstance(recognitionRef.current);
      recognitionRef.current = null;
      onInterimRef.current?.("");
      const { isTranscribing, setIsTranscribing } =
        useConsultationStore.getState();
      if (isTranscribing) setIsTranscribing(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      onErrorRef.current?.(
        "Dictado por voz no disponible. Usá Chrome o Edge en escritorio.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LANG;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += piece;
        } else {
          interim += piece;
        }
      }

      onInterimRef.current?.(interim.trim());

      if (finalTranscript.trim()) {
        onInterimRef.current?.("");
        const segment: TranscriptionSegment = {
          speaker: "unknown",
          text: finalTranscript.trim(),
          timestamp: new Date().toISOString(),
        };
        useConsultationStore.getState().appendTranscription(segment);
        onSegmentRef.current?.(segment);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      const message = speechErrorMessage(event.error);
      onErrorRef.current?.(message);
      useConsultationStore.getState().setIsTranscribing(false);
      onInterimRef.current?.("");
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !enabledRef.current) return;
      try {
        recognition.start();
      } catch {
        useConsultationStore.getState().setIsTranscribing(false);
        onInterimRef.current?.("");
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      useConsultationStore.getState().setIsTranscribing(true);
    } catch {
      recognitionRef.current = null;
      onErrorRef.current?.("No se pudo iniciar el micrófono. Reintentá en unos segundos.");
    }

    return () => {
      stopRecognitionInstance(recognition);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      onInterimRef.current?.("");
    };
  }, [enabled]);

  return { isSupported };
}
