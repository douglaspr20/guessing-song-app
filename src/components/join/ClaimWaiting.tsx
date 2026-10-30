"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import access from "@/components/access.module.css";
import form from "@/components/styles/form.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/client/api";
import styles from "./JoinFlow.module.css";

/** Cada cuánto pregunta si el anfitrión ya lo dejó entrar (como el sondeo de la partida, sin depender de Ably). */
const POLL_MS = 2_500;

/**
 * Tercer paso, solo si el nombre ya estaba dentro desde otro navegador: se espera a que el anfitrión deje entrar.
 * Al aceptar, este navegador pasa a ser ese sitio y entra solo; si lo rechazan o caduca, se vuelve al nombre.
 */
export function ClaimWaiting({
  titleId,
  gameId,
  name,
  onGone,
  onCancel,
}: {
  titleId: string;
  gameId: string;
  name: string;
  onGone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { m } = useI18n();
  const j = m.join;

  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const { status } = await api<{ status: "pending" | "accepted" | "gone" }>(`/api/join/claim?game=${encodeURIComponent(gameId)}`);
        if (!live) return;
        if (status === "accepted") router.push(`/play/${gameId}`);
        else if (status === "gone") onGone();
      } catch {
        // Sin conexión un momento: se vuelve a preguntar en el siguiente turno.
      }
    };
    const timer = setInterval(check, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [gameId, router, onGone]);

  const cancel = async () => {
    await api(`/api/join/claim?game=${encodeURIComponent(gameId)}`, { method: "DELETE" }).catch(() => undefined);
    onCancel();
  };

  return (
    <div className={access.body} role="status" aria-live="polite">
      <div>
        <h1 className={access.title} id={titleId}>
          {j.waitTitle}
        </h1>
        <p className={access.lede}>{j.waitLede(name)}</p>
      </div>
      <p className={styles.waitName}>{name}</p>
      <div className={form.actions}>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={cancel}>
          {j.waitCancel}
        </button>
      </div>
    </div>
  );
}
