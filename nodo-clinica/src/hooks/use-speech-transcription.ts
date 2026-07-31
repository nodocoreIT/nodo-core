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
  /** Si false, no agrega segmentos al store global de la consulta (solo onSegment). */
  syncToConsultationStore?: boolean;
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
  syncToConsultationStore = true,
  onSegment,
  onInterim,
  onError,
}: UseSpeechTranscriptionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const enabledRef = useRef(enabled);
  const syncToStoreRef = useRef(syncToConsultationStore);
  const onSegmentRef = useRef(onSegment);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  // Última transcripción provisoria (aún no confirmada como "final" por el
  // motor de reconocimiento — eso puede tardar 1-3s después de dejar de
  // hablar). Si el usuario detiene el dictado antes de esa confirmación,
  // se vuelca acá para no perderla.
  const pendingInterimRef = useRef("");
  const [isSupported] = useState(() => getSpeechRecognitionCtor() != null);

  enabledRef.current = enabled;
  syncToStoreRef.current = syncToConsultationStore;
  onSegmentRef.current = onSegment;
  onInterimRef.current = onInterim;
  onErrorRef.current = onError;

  function flushPendingInterim() {
    const pending = pendingInterimRef.current.trim();
    pendingInterimRef.current = "";
    if (!pending) return;
    const segment: TranscriptionSegment = {
      speaker: "unknown",
      text: pending,
      timestamp: new Date().toISOString(),
    };
    if (syncToStoreRef.current) {
      useConsultationStore.getState().appendTranscription(segment);
    }
    onSegmentRef.current?.(segment);
    onInterimRef.current?.("");
  }

  useEffect(() => {
    if (!enabled) {
      stopRecognitionInstance(recognitionRef.current);
      recognitionRef.current = null;
      flushPendingInterim();
      if (syncToStoreRef.current) {
        const { isTranscribing, setIsTranscribing } =
          useConsultationStore.getState();
        if (isTranscribing) setIsTranscribing(false);
      }
      return;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      onErrorRef.current?.(
        "Dictado por voz no disponible. Usá Chrome o Edge (también en Android).",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LANG;

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

      pendingInterimRef.current = interim.trim();
      onInterimRef.current?.(interim.trim());

      if (finalTranscript.trim()) {
        pendingInterimRef.current = "";
        onInterimRef.current?.("");
        const segment: TranscriptionSegment = {
          speaker: "unknown",
          text: finalTranscript.trim(),
          timestamp: new Date().toISOString(),
        };
        if (syncToStoreRef.current) {
          useConsultationStore.getState().appendTranscription(segment);
        }
        onSegmentRef.current?.(segment);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== recognition) return;
      const message = speechErrorMessage(event.error);
      onErrorRef.current?.(message);
      if (syncToStoreRef.current) {
        useConsultationStore.getState().setIsTranscribing(false);
      }
      flushPendingInterim();
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !enabledRef.current) return;
      try {
        recognition.start();
      } catch {
        if (syncToStoreRef.current) {
          useConsultationStore.getState().setIsTranscribing(false);
        }
        flushPendingInterim();
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      if (syncToStoreRef.current) {
        useConsultationStore.getState().setIsTranscribing(true);
      }
    } catch {
      recognitionRef.current = null;
      onErrorRef.current?.("No se pudo iniciar el micrófono. Reintentá en unos segundos.");
    }

    return () => {
      stopRecognitionInstance(recognition);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      flushPendingInterim();
    };
  }, [enabled]);

  return { isSupported };
}
