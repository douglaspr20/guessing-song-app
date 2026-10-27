"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useI18n } from "@/i18n/client";
import { api, errorText, type AccessStatus } from "@/lib/client/api";

export type HomeView = "loading" | "error" | "connect" | "account" | "guest";

/**
 * Quién usa la app (cuenta, invitado o nadie) y qué ve la portada. También lee una sola vez el resultado
 * del login de Spotify o Google que viene en la URL (`?error=…`, `?google=linked`) y limpia la dirección.
 */
export function useAccess() {
  const { m } = useI18n();
  const t = m.home;
  const toast = useToast();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  /** No se pudo saber quién usa la app (API caída): se dice y se ofrece reintentar. */
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAccess(await api<AccessStatus>("/api/access/status"));
      setAccessError(null);
    } catch (err) {
      setAccess(null);
      setAccessError(errorText(err));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    // Lee el resultado del login de Spotify o Google una vez al montar (viene en la URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) setLoginError(t.loginErrors[code] ?? t.loginErrors.failed);
    if (params.get("google") === "linked") toast({ text: t.googleLinked });
    if (code || params.has("google")) window.history.replaceState(null, "", "/");
    refresh();
  }, [refresh, toast, t]);

  const view: HomeView = accessError
    ? "error"
    : !access
      ? "loading"
      : access.user
        ? "account"
        : access.guest
          ? "guest"
          : "connect";

  return { access, accessError, loginError, view, refresh };
}
