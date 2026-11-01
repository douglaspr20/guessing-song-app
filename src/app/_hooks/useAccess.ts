"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useI18n } from "@/i18n/client";
import type { AccessStatus } from "@/lib/client/api";

export type HomeView = "error" | "connect" | "account" | "guest";

/**
 * Qué ve la portada según quién la usa (cuenta, invitado o nadie). Quién es lo lee el servidor al pintarla (`access`,
 * null si no pudo): tras entrar, salir o cambiar algo, `refresh` le pide que lo vuelva a leer (`router.refresh()`).
 * También lee una sola vez el resultado del login de Spotify o Google que viene en la URL (`?error=…`,
 * `?google=linked`) y limpia la dirección.
 */
export function useAccess(access: AccessStatus | null) {
  const { m } = useI18n();
  const t = m.home;
  const toast = useToast();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [loginError, setLoginError] = useState<string | null>(null);

  const refresh = useCallback(async () => startRefresh(() => router.refresh()), [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    // Lee el resultado del login de Spotify o Google una vez al montar (viene en la URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) setLoginError(t.loginErrors[code] ?? t.loginErrors.failed);
    if (params.get("google") === "linked") toast({ text: t.googleLinked });
    if (code || params.has("google")) window.history.replaceState(null, "", "/");
  }, [toast, t]);

  const view: HomeView = !access ? "error" : access.user ? "account" : access.guest ? "guest" : "connect";

  return { loginError, view, refresh };
}
