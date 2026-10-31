"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Lo que usamos del reconocimiento de voz del navegador (Web Speech API; en Chrome y Safari lleva prefijo). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

export type DictationError = "denied" | "noSpeech" | "failed";

/**
 * Dictar en un campo: `start(campo, alOír)` escucha una frase en `lang` y va pasando lo que entiende (también lo
 * provisional, para que se vea escribirse). Solo escucha un campo a la vez. Sin soporte en el navegador
 * (Firefox, algunos navegadores dentro de apps) `supported` es false y no hay que enseñar el botón.
 */
export function useDictation(lang: string) {
  // En el servidor no hay `window`: se da por no soportado y se corrige al hidratar.
  const supported = useSyncExternalStore(noSubscribe, () => !!recognitionCtor(), () => false);
  const [listening, setListening] = useState<string | null>(null);
  const [error, setError] = useState<DictationError | null>(null);
  const current = useRef<Recognition | null>(null);

  const stop = useCallback(() => current.current?.stop(), []);

  const start = useCallback(
    (field: string, onText: (text: string) => void) => {
      current.current?.abort();
      const Ctor = recognitionCtor();
      if (!Ctor) return;
      const r = new Ctor();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        onText(text.trim());
      };
      r.onerror = (e) => {
        if (e.error === "aborted") return;
        setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "no-speech" ? "noSpeech" : "failed");
      };
      r.onend = () => {
        if (current.current !== r) return;
        current.current = null;
        setListening(null);
      };
      current.current = r;
      setError(null);
      setListening(field);
      try {
        r.start();
      } catch {
        current.current = null;
        setListening(null);
        setError("failed");
      }
    },
    [lang],
  );

  // Al desmontar (se envió la respuesta o acabó el turno) se deja de escuchar.
  useEffect(() => () => current.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
